import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import type Stripe from "stripe";
import { env } from "~/env";
import { getSiteSettings } from "~/server/kv";
import { createOrderFromPayment } from "~/server/order-actions";
import { getCartItems, getCartSummary } from "~/server/cart-actions";
import { validateDiscountCode } from "~/server/discount-actions";
import { calculateDiscountedTotal } from "~/lib/discount-utils";

// Same customer info shape as /api/checkout/create-intent so admins can validate
// the full checkout flow end-to-end without diverging on input schema.
const customerInfoSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  address1: z.string().min(1),
  address2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  zipCode: z.string().min(1),
  country: z.string().min(1),
});

const requestBodySchema = z.object({
  customerInfo: customerInfoSchema,
  discountCode: z.string().optional(),
  isGift: z.boolean().optional().default(false),
});

/**
 * POST /api/checkout/test-place-order
 *
 * Test mode endpoint — bypasses Stripe entirely and either creates a test order
 * (outcome=success) or returns a simulated payment failure (outcome=failure).
 * Double-gated:
 *   1. env.TEST_MODE_ALLOWED must be true (set per-environment on Vercel)
 *   2. settings.testMode.enabled must be true (runtime admin toggle in KV)
 *
 * Test orders are saved with a synthetic "pi_test_" payment_intent_id and
 * flagged `is_test=true` so they can be filtered from the admin view.
 */
export async function POST(request: Request) {
  // Gate 1: environment capability — absent in prod, present on staging
  if (!env.TEST_MODE_ALLOWED) {
    return NextResponse.json(
      { message: "Test mode is not available in this environment" },
      { status: 403 },
    );
  }

  // Gate 2: runtime admin toggle — defaults to disabled
  const settings = await getSiteSettings();
  if (!settings.testMode.enabled) {
    return NextResponse.json(
      { message: "Test mode is not enabled" },
      { status: 403 },
    );
  }

  // Validate body
  const body = await request.json().catch(() => null);
  const parsed = requestBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid request body" },
      { status: 400 },
    );
  }
  const { customerInfo, discountCode, isGift } = parsed.data;

  // Short-circuit for failure outcome — simulate a payment error without
  // touching the DB. Cart remains intact so the user can retry or change outcome.
  if (settings.testMode.outcome === "failure") {
    return NextResponse.json(
      { ok: false, message: "Simulated payment failure (test mode)" },
      { status: 402 },
    );
  }

  // Success outcome — build a synthetic PaymentIntent and reuse the same
  // createOrderFromPayment function the real webhook calls. This keeps the
  // order creation logic in one place.
  const [items, summary] = await Promise.all([getCartItems(), getCartSummary()]);
  if (items.length === 0) {
    return NextResponse.json({ message: "Cart is empty" }, { status: 400 });
  }

  // Replicate discount validation from create-intent so test orders reflect
  // real discount logic. Intentionally skips incrementDiscountUsage — test
  // orders shouldn't pollute discount usage counts on real discount codes.
  let finalTotal = parseFloat(summary.total);
  const discountMeta: Record<string, string> = {};
  if (discountCode) {
    const discountResult = await validateDiscountCode(discountCode);
    if (!discountResult.valid || !discountResult.discount) {
      return NextResponse.json(
        { message: discountResult.error || "Invalid discount code" },
        { status: 400 },
      );
    }
    const { discountAmount, finalTotal: discounted } = calculateDiscountedTotal(
      finalTotal,
      discountResult.discount.discount,
      discountResult.discount.discountType,
    );
    finalTotal = discounted;
    discountMeta.discountId = String(discountResult.discount.id);
    discountMeta.discountCode = discountResult.discount.code;
    discountMeta.discountAmount = String(discountAmount);
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("cart_session")?.value ?? "";
  if (!sessionToken) {
    return NextResponse.json(
      { message: "No active cart session" },
      { status: 400 },
    );
  }

  // Generate a synthetic payment intent ID with "pi_test_" prefix for easy
  // DB identification. crypto.randomUUID() guarantees uniqueness.
  const syntheticId = `pi_test_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;

  // Build the minimum Stripe.PaymentIntent-shaped object that
  // createOrderFromPayment reads. We cast through unknown because we're not
  // constructing a full Stripe SDK type.
  const syntheticPI = {
    id: syntheticId,
    amount: Math.round(finalTotal * 100),
    metadata: {
      customerEmail: customerInfo.email,
      customerName: `${customerInfo.firstName} ${customerInfo.lastName}`,
      shippingAddress: JSON.stringify({
        address1: customerInfo.address1,
        address2: customerInfo.address2,
        city: customerInfo.city,
        state: customerInfo.state,
        zipCode: customerInfo.zipCode,
        country: customerInfo.country,
      }),
      cartSessionToken: sessionToken,
      itemCount: String(summary.itemCount),
      checkoutType: "test",
      stripeCustomerId: "",
      isGift: String(isGift),
      ...discountMeta,
    },
  } as unknown as Stripe.PaymentIntent;

  try {
    const newOrder = await createOrderFromPayment(syntheticPI, { isTest: true });
    return NextResponse.json({
      ok: true,
      paymentIntentId: syntheticId,
      orderId: newOrder.id,
    });
  } catch (error) {
    console.error("Test order creation failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create test order";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

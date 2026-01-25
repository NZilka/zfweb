import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
// Import both payment intent creation functions - one for new cards, one for saved
import {
  createPaymentIntent,
  createPaymentIntentWithSavedMethod,
} from "~/server/stripe";
import { getCartItems, getCartSummary } from "~/server/cart-actions";
import { getOrCreateStripeCustomer } from "~/server/stripe-customer";
import {
  validateDiscountCode,
  calculateDiscountedTotal,
} from "~/server/discount-actions";
import { z } from "zod";
import { cookies } from "next/headers";

// Customer info validation schema (matches CheckoutForm)
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

// Request body schema - includes optional savePaymentMethod flag and discount code
const requestBodySchema = z.object({
  customerInfo: customerInfoSchema,
  // Whether user wants to save payment method for future use (only for logged-in users)
  savePaymentMethod: z.boolean().optional().default(false),
  // ID of saved payment method to use (if user selected a saved card)
  savedPaymentMethodId: z.string().optional(),
  // Optional discount code to apply
  discountCode: z.string().optional(),
});

// POST /api/checkout/create-intent
// Creates a Stripe payment intent for the current cart
// Per stripe-recommendations: creates Stripe Customer BEFORE payment intent
export async function POST(request: Request) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const bodyResult = requestBodySchema.safeParse(body);

    if (!bodyResult.success) {
      // Log validation errors for debugging
      console.error("Checkout validation errors:", bodyResult.error.flatten());
      // Return specific field errors to help diagnose issues
      const fieldErrors = bodyResult.error.flatten().fieldErrors;
      const errorMessages = Object.entries(fieldErrors)
        .map(([field, errors]) => `${field}: ${errors?.join(", ")}`)
        .join("; ");
      return NextResponse.json(
        { message: `Invalid request: ${errorMessages || "validation failed"}` },
        { status: 400 }
      );
    }

    // Extract validated fields including optional saved payment method ID and discount
    const { customerInfo, savePaymentMethod, savedPaymentMethodId, discountCode } =
      bodyResult.data;
    const customerName = `${customerInfo.firstName} ${customerInfo.lastName}`;

    // Get cart items and verify cart is not empty
    const [items, summary] = await Promise.all([
      getCartItems(),
      getCartSummary(),
    ]);

    if (items.length === 0) {
      return NextResponse.json(
        { message: "Cart is empty" },
        { status: 400 }
      );
    }

    // Validate and apply discount code if provided
    let discountInfo: {
      id: number;
      code: string;
      amount: number;
    } | null = null;
    let finalTotal = parseFloat(summary.total);

    if (discountCode) {
      const discountResult = await validateDiscountCode(discountCode);

      if (!discountResult.valid || !discountResult.discount) {
        return NextResponse.json(
          { message: discountResult.error || "Invalid discount code" },
          { status: 400 }
        );
      }

      // Calculate discounted total
      const { discountAmount, finalTotal: discounted } = calculateDiscountedTotal(
        parseFloat(summary.total),
        discountResult.discount.discount,
        discountResult.discount.discountType
      );

      discountInfo = {
        id: discountResult.discount.id,
        code: discountResult.discount.code,
        amount: discountAmount,
      };
      finalTotal = discounted;
    }

    // Calculate amount in cents for Stripe (using discounted total)
    const amountInCents = Math.round(finalTotal * 100);

    if (amountInCents < 50) {
      // Stripe minimum is 50 cents
      return NextResponse.json(
        { message: "Order total must be at least $0.50" },
        { status: 400 }
      );
    }

    // Get session token for order association and guest checkout
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("cart_session")?.value ?? "";

    // Check if user is authenticated via Clerk
    const { userId: clerkUserId } = await auth();

    // Step 1: Create or retrieve Stripe Customer BEFORE creating payment intent
    // This follows the stripe-recommendations pattern for state consistency
    let stripeCustomer;
    if (clerkUserId) {
      // Authenticated user - link to Clerk account
      stripeCustomer = await getOrCreateStripeCustomer({
        type: "user",
        clerkUserId,
        email: customerInfo.email,
        name: customerName,
      });
    } else {
      // Guest checkout - link to session token
      stripeCustomer = await getOrCreateStripeCustomer({
        type: "guest",
        sessionToken,
        email: customerInfo.email,
        name: customerName,
      });
    }

    // Metadata for webhook processing - shared between new and saved payment flows
    const paymentMetadata: Record<string, string> = {
      customerEmail: customerInfo.email,
      customerName,
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
      checkoutType: clerkUserId ? "registered" : "guest",
      stripeCustomerId: stripeCustomer.customerId,
    };

    // Add discount info to metadata if discount applied
    if (discountInfo) {
      paymentMetadata.discountId = String(discountInfo.id);
      paymentMetadata.discountCode = discountInfo.code;
      paymentMetadata.discountAmount = String(discountInfo.amount);
    }

    // Step 2: Create payment intent - different flow for saved vs new payment method
    let clientSecret: string | null;
    let paymentIntentId: string;

    if (savedPaymentMethodId && clerkUserId) {
      // User selected a saved payment method - attach it to the intent
      // Only allowed for logged-in users (guests don't have saved methods)
      const result = await createPaymentIntentWithSavedMethod({
        amount: amountInCents,
        customerId: stripeCustomer.customerId,
        paymentMethodId: savedPaymentMethodId,
        metadata: paymentMetadata,
      });
      clientSecret = result.clientSecret;
      paymentIntentId = result.paymentIntentId;
    } else {
      // New payment method flow - collect card details via Stripe Elements
      const result = await createPaymentIntent({
        amount: amountInCents,
        customerId: stripeCustomer.customerId,
        // Only save payment method if user is logged in and requested it
        setupFutureUsage:
          clerkUserId && savePaymentMethod ? "on_session" : undefined,
        metadata: paymentMetadata,
      });
      clientSecret = result.clientSecret;
      paymentIntentId = result.paymentIntentId;
    }

    return NextResponse.json({
      clientSecret,
      paymentIntentId,
      // Return whether this is a new customer (for analytics/tracking)
      isNewCustomer: stripeCustomer.isNew,
      // Indicate if using saved payment method (affects confirmation flow)
      usingSavedMethod: !!savedPaymentMethodId,
    });
  } catch (error: any) {
    console.error("Error creating payment intent:", error);
    return NextResponse.json(
      { message: error.message ?? "Failed to create payment intent" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createPaymentIntent } from "~/server/stripe";
import { getCartItems, getCartSummary } from "~/server/cart-actions";
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

// POST /api/checkout/create-intent
// Creates a Stripe payment intent for the current cart
export async function POST(request: Request) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const customerInfoResult = customerInfoSchema.safeParse(body.customerInfo);

    if (!customerInfoResult.success) {
      return NextResponse.json(
        { message: "Invalid customer information" },
        { status: 400 }
      );
    }

    const customerInfo = customerInfoResult.data;

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

    // Calculate amount in cents for Stripe
    const amountInCents = Math.round(parseFloat(summary.total) * 100);

    if (amountInCents < 50) {
      // Stripe minimum is 50 cents
      return NextResponse.json(
        { message: "Order total must be at least $0.50" },
        { status: 400 }
      );
    }

    // Get session token for order association
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("cart_session")?.value ?? "";

    // Create payment intent with metadata for order fulfillment
    const { clientSecret, paymentIntentId } = await createPaymentIntent(
      amountInCents,
      {
        // Store customer and cart info for webhook processing
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
      }
    );

    return NextResponse.json({ clientSecret, paymentIntentId });
  } catch (error: any) {
    console.error("Error creating payment intent:", error);
    return NextResponse.json(
      { message: error.message ?? "Failed to create payment intent" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createPaymentIntent } from "~/server/stripe";
import { getCartItems, getCartSummary } from "~/server/cart-actions";
import { getOrCreateStripeCustomer } from "~/server/stripe-customer";
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

// Request body schema - includes optional savePaymentMethod flag
const requestBodySchema = z.object({
  customerInfo: customerInfoSchema,
  // Whether user wants to save payment method for future use (only for logged-in users)
  savePaymentMethod: z.boolean().optional().default(false),
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
      return NextResponse.json(
        { message: "Invalid request body" },
        { status: 400 }
      );
    }

    const { customerInfo, savePaymentMethod } = bodyResult.data;
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

    // Calculate amount in cents for Stripe
    const amountInCents = Math.round(parseFloat(summary.total) * 100);

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

    // Step 2: Create payment intent with customer attached
    const { clientSecret, paymentIntentId } = await createPaymentIntent({
      amount: amountInCents,
      customerId: stripeCustomer.customerId,
      // Only save payment method if user is logged in and requested it
      setupFutureUsage:
        clerkUserId && savePaymentMethod ? "on_session" : undefined,
      metadata: {
        // Store customer and cart info for webhook processing
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
        // Include customer type for webhook processing
        checkoutType: clerkUserId ? "registered" : "guest",
        // Store Stripe customer ID for reference
        stripeCustomerId: stripeCustomer.customerId,
      },
    });

    return NextResponse.json({
      clientSecret,
      paymentIntentId,
      // Return whether this is a new customer (for analytics/tracking)
      isNewCustomer: stripeCustomer.isNew,
    });
  } catch (error: any) {
    console.error("Error creating payment intent:", error);
    return NextResponse.json(
      { message: error.message ?? "Failed to create payment intent" },
      { status: 500 }
    );
  }
}

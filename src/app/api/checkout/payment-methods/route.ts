import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSavedPaymentMethods } from "~/server/stripe";
import { getStripeCustomerForUser } from "~/server/kv";
import { getCustomerByClerkId } from "~/server/queries";
import { isKvConfigured } from "~/server/kv";

// GET /api/checkout/payment-methods
// Returns saved payment methods for the authenticated user
// Returns empty array for guests or users without saved methods
export async function GET() {
  try {
    // Must be authenticated to have saved payment methods
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ paymentMethods: [] });
    }

    // Try to get Stripe customer ID from KV first (faster)
    let stripeCustomerId: string | null = null;

    if (isKvConfigured()) {
      stripeCustomerId = await getStripeCustomerForUser(clerkUserId);
    }

    // Fall back to database if not in KV
    if (!stripeCustomerId) {
      const customer = await getCustomerByClerkId(clerkUserId);
      stripeCustomerId = customer?.stripe_customer_id ?? null;
    }

    // No Stripe customer yet - return empty
    if (!stripeCustomerId) {
      return NextResponse.json({ paymentMethods: [] });
    }

    // Fetch saved payment methods from Stripe
    const paymentMethods = await getSavedPaymentMethods(stripeCustomerId);

    return NextResponse.json({
      paymentMethods,
      stripeCustomerId,
    });
  } catch (error: any) {
    console.error("Error fetching payment methods:", error);
    return NextResponse.json(
      { paymentMethods: [], error: error.message },
      { status: 500 }
    );
  }
}

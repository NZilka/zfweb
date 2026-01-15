import "server-only";
import Stripe from "stripe";
import { env } from "~/env";

// Server-side Stripe instance
// Used for creating payment intents, handling webhooks, etc.
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-12-15.clover",
  typescript: true,
});

// Create a payment intent for checkout
// Returns client secret for use with Stripe Elements
export async function createPaymentIntent(
  amount: number, // Amount in cents
  metadata?: Record<string, string>
) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: "usd",
    automatic_payment_methods: {
      enabled: true,
    },
    metadata,
  });

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  };
}

// Verify webhook signature and parse event
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    env.STRIPE_WEBHOOK_SECRET
  );
}

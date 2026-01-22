import "server-only";
import Stripe from "stripe";
import { env } from "~/env";

// Lazy-loaded Stripe instance to avoid initialization errors when not configured
let stripeInstance: Stripe | null = null;

// Get or create the Stripe instance
// Throws if Stripe is not configured
function getStripeInstance(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.");
  }

  if (!stripeInstance) {
    stripeInstance = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
      typescript: true,
    });
  }

  return stripeInstance;
}

// Check if Stripe is configured on server
export function isStripeConfiguredServer(): boolean {
  return !!env.STRIPE_SECRET_KEY && !!env.STRIPE_WEBHOOK_SECRET;
}

// Options for creating a payment intent
export type CreatePaymentIntentOptions = {
  amount: number; // Amount in cents
  metadata?: Record<string, string>;
  // Stripe customer ID - links payment to customer for saved methods
  customerId?: string;
  // Whether to save payment method for future use (requires customerId)
  setupFutureUsage?: "off_session" | "on_session";
};

// Create a payment intent for checkout
// Returns client secret for use with Stripe Elements
export async function createPaymentIntent(options: CreatePaymentIntentOptions) {
  const stripe = getStripeInstance();

  const { amount, metadata, customerId, setupFutureUsage } = options;

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: "usd",
    automatic_payment_methods: {
      enabled: true,
    },
    metadata,
    // Link payment to Stripe customer if provided
    ...(customerId && { customer: customerId }),
    // Enable saving payment method for future use if requested
    ...(setupFutureUsage && { setup_future_usage: setupFutureUsage }),
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
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Stripe webhook secret not configured. Set STRIPE_WEBHOOK_SECRET environment variable.");
  }

  const stripe = getStripeInstance();
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    env.STRIPE_WEBHOOK_SECRET
  );
}

// Retrieve a PaymentIntent by ID (for thin webhook payloads)
// Fetches fresh data from Stripe API instead of using stale webhook payload
export async function retrievePaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeInstance();
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

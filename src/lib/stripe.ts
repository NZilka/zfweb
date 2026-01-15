import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { env } from "~/env";

// Singleton promise for Stripe instance
// Only loads once, reuses the same instance for subsequent calls
let stripePromise: Promise<Stripe | null> | null = null;

// Get the Stripe client instance for client-side use
// Used with Elements provider for payment forms
// Returns null if Stripe is not configured
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    // Return null promise if Stripe is not configured
    if (!key) {
      stripePromise = Promise.resolve(null);
    } else {
      stripePromise = loadStripe(key);
    }
  }
  return stripePromise;
}

// Check if Stripe is configured
export function isStripeConfigured(): boolean {
  return !!env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
}

import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { env } from "~/env";

// Singleton promise for Stripe instance
// Only loads once, reuses the same instance for subsequent calls
let stripePromise: Promise<Stripe | null> | null = null;

// Get the Stripe client instance for client-side use
// Used with Elements provider for payment forms
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
}

import "server-only";
import Stripe from "stripe";
import { env } from "~/env";
import {
  setPaymentStateCache,
  setOrderStateCache,
  getStripeCustomerForUser,
  getStripeCustomerForSession,
  type PaymentStateCache,
  type OrderStateCache,
  isKvConfigured,
} from "~/server/kv";
import { getOrderByPaymentIntent } from "~/server/order-actions";

// Lazy-loaded Stripe instance
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY environment variable."
    );
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
      typescript: true,
    });
  }
  return stripeInstance;
}

// Map Stripe PaymentIntent status to our simplified status
function mapPaymentStatus(
  status: Stripe.PaymentIntent.Status
): PaymentStateCache["lastPaymentStatus"] {
  switch (status) {
    case "succeeded":
      return "succeeded";
    case "processing":
    case "requires_action":
    case "requires_confirmation":
    case "requires_payment_method":
      return "processing";
    case "canceled":
    case "requires_capture":
    default:
      return "failed";
  }
}

// Extract payment method details from PaymentIntent
function extractPaymentMethod(
  paymentIntent: Stripe.PaymentIntent
): PaymentStateCache["paymentMethod"] {
  // Payment method might be expanded or just an ID
  const pm = paymentIntent.payment_method;
  if (!pm || typeof pm === "string") {
    return null;
  }

  // It's an expanded PaymentMethod object
  if (pm.card) {
    return {
      brand: pm.card.brand,
      last4: pm.card.last4,
    };
  }

  return null;
}

// Core sync function - syncs payment state to KV for a Stripe customer
// This is the single source of truth pattern from stripe-recommendations
// Call this after any payment-related event to keep KV in sync
export async function syncPaymentStateToKV(
  stripeCustomerId: string
): Promise<PaymentStateCache | null> {
  // Skip if KV is not configured
  if (!isKvConfigured()) {
    console.log("[syncPaymentStateToKV] KV not configured, skipping sync");
    return null;
  }

  const stripe = getStripe();

  // Fetch the most recent PaymentIntent for this customer
  const paymentIntents = await stripe.paymentIntents.list({
    customer: stripeCustomerId,
    limit: 1,
    expand: ["data.payment_method"],
  });

  // No payment intents found - set empty state
  if (paymentIntents.data.length === 0) {
    const emptyState: PaymentStateCache = {
      lastPaymentIntentId: null,
      lastPaymentStatus: null,
      lastOrderId: null,
      paymentMethod: null,
      updatedAt: Date.now(),
    };
    await setPaymentStateCache(stripeCustomerId, emptyState);
    return emptyState;
  }

  const latestPaymentIntent = paymentIntents.data[0];

  // Try to find associated order in our database
  let orderId: number | null = null;
  if (latestPaymentIntent.status === "succeeded") {
    const order = await getOrderByPaymentIntent(latestPaymentIntent.id);
    orderId = order?.id ?? null;
  }

  // Build and cache the payment state
  const paymentState: PaymentStateCache = {
    lastPaymentIntentId: latestPaymentIntent.id,
    lastPaymentStatus: mapPaymentStatus(latestPaymentIntent.status),
    lastOrderId: orderId,
    paymentMethod: extractPaymentMethod(latestPaymentIntent),
    updatedAt: Date.now(),
  };

  await setPaymentStateCache(stripeCustomerId, paymentState);

  console.log(
    `[syncPaymentStateToKV] Synced state for customer ${stripeCustomerId}:`,
    paymentState.lastPaymentStatus
  );

  return paymentState;
}

// Sync payment state by PaymentIntent ID
// Useful when you have the payment intent but not the customer ID
export async function syncPaymentStateByPaymentIntent(
  paymentIntentId: string
): Promise<PaymentStateCache | null> {
  // Skip if KV is not configured
  if (!isKvConfigured()) {
    console.log(
      "[syncPaymentStateByPaymentIntent] KV not configured, skipping sync"
    );
    return null;
  }

  const stripe = getStripe();

  // Fetch the PaymentIntent with payment method expanded
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["payment_method"],
  });

  // Must have a customer to sync
  if (!paymentIntent.customer) {
    console.log(
      `[syncPaymentStateByPaymentIntent] PaymentIntent ${paymentIntentId} has no customer`
    );
    return null;
  }

  const customerId =
    typeof paymentIntent.customer === "string"
      ? paymentIntent.customer
      : paymentIntent.customer.id;

  // Now sync using the customer ID
  return syncPaymentStateToKV(customerId);
}

// Sync order state to KV after successful payment
// Called from webhook when order is created
export async function syncOrderStateToKV(
  paymentIntentId: string,
  order: {
    id: number;
    status: string;
    total: string;
  },
  itemCount: number,
  stripeCustomerId: string
): Promise<OrderStateCache> {
  const orderState: OrderStateCache = {
    orderId: order.id,
    status: order.status,
    total: order.total,
    itemCount,
    customerId: stripeCustomerId,
    createdAt: Date.now(),
  };

  // Only cache if KV is configured
  if (isKvConfigured()) {
    await setOrderStateCache(paymentIntentId, orderState);
    console.log(
      `[syncOrderStateToKV] Cached order ${order.id} for payment ${paymentIntentId}`
    );
  }

  return orderState;
}

// Helper to sync state for authenticated user
// Looks up Stripe customer ID from KV and syncs
export async function syncPaymentStateForUser(
  clerkUserId: string
): Promise<PaymentStateCache | null> {
  // Skip if KV is not configured
  if (!isKvConfigured()) {
    return null;
  }

  const stripeCustomerId = await getStripeCustomerForUser(clerkUserId);
  if (!stripeCustomerId) {
    console.log(
      `[syncPaymentStateForUser] No Stripe customer found for user ${clerkUserId}`
    );
    return null;
  }

  return syncPaymentStateToKV(stripeCustomerId);
}

// Helper to sync state for guest session
// Looks up Stripe customer ID from session token and syncs
export async function syncPaymentStateForSession(
  sessionToken: string
): Promise<PaymentStateCache | null> {
  // Skip if KV is not configured
  if (!isKvConfigured()) {
    return null;
  }

  const stripeCustomerId = await getStripeCustomerForSession(sessionToken);
  if (!stripeCustomerId) {
    console.log(
      `[syncPaymentStateForSession] No Stripe customer found for session`
    );
    return null;
  }

  return syncPaymentStateToKV(stripeCustomerId);
}

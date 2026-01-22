import "server-only";
import Stripe from "stripe";
import { env } from "~/env";
import { db } from "~/server/db";
import { customer } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import {
  getStripeCustomerForUser,
  setStripeCustomerForUser,
  getStripeCustomerForSession,
  setStripeCustomerForSession,
} from "~/server/kv";

// Lazy-loaded Stripe instance (same pattern as stripe.ts)
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

// Options for getting or creating a Stripe customer
export type GetOrCreateCustomerOptions =
  | {
      // For authenticated users - use Clerk user ID
      type: "user";
      clerkUserId: string;
      email: string;
      name?: string;
    }
  | {
      // For guest checkout - use cart session token
      type: "guest";
      sessionToken: string;
      email: string;
      name?: string;
    };

// Result from getOrCreateStripeCustomer
export type StripeCustomerResult = {
  customerId: string;
  isNew: boolean;
};

// Get or create a Stripe Customer
// For authenticated users: checks KV cache and DB, creates if needed
// For guests: checks KV cache by session token, creates if needed
export async function getOrCreateStripeCustomer(
  options: GetOrCreateCustomerOptions
): Promise<StripeCustomerResult> {
  const stripe = getStripe();

  if (options.type === "user") {
    // Authenticated user flow
    return getOrCreateStripeCustomerForUser(stripe, options);
  } else {
    // Guest checkout flow
    return getOrCreateStripeCustomerForGuest(stripe, options);
  }
}

// Handle authenticated user - check KV, then DB, then create new
async function getOrCreateStripeCustomerForUser(
  stripe: Stripe,
  options: { clerkUserId: string; email: string; name?: string }
): Promise<StripeCustomerResult> {
  const { clerkUserId, email, name } = options;

  // 1. Check KV cache first (fastest)
  const cachedCustomerId = await getStripeCustomerForUser(clerkUserId);
  if (cachedCustomerId) {
    return { customerId: cachedCustomerId, isNew: false };
  }

  // 2. Check database for existing customer record
  const existingCustomer = await db.query.customer.findFirst({
    where: (model, { eq }) => eq(model.clerk_user_id, clerkUserId),
  });

  if (existingCustomer?.stripe_customer_id) {
    // Found in DB - cache in KV for next time
    await setStripeCustomerForUser(clerkUserId, existingCustomer.stripe_customer_id);
    return { customerId: existingCustomer.stripe_customer_id, isNew: false };
  }

  // 3. Create new Stripe customer
  const stripeCustomer = await stripe.customers.create({
    email,
    name,
    metadata: {
      // Store Clerk user ID in Stripe metadata for reference
      clerkUserId,
    },
  });

  // 4. Update or create customer record in DB
  if (existingCustomer) {
    // Update existing customer with Stripe ID
    await db
      .update(customer)
      .set({ stripe_customer_id: stripeCustomer.id })
      .where(eq(customer.id, existingCustomer.id));
  } else {
    // Create new customer record
    // Parse name into first/last (simple split)
    const nameParts = (name || "").split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    await db.insert(customer).values({
      clerk_user_id: clerkUserId,
      stripe_customer_id: stripeCustomer.id,
      email,
      firstName,
      last_name: lastName,
      isUser: true,
    });
  }

  // 5. Cache in KV
  await setStripeCustomerForUser(clerkUserId, stripeCustomer.id);

  return { customerId: stripeCustomer.id, isNew: true };
}

// Handle guest checkout - check KV by session, then create new
async function getOrCreateStripeCustomerForGuest(
  stripe: Stripe,
  options: { sessionToken: string; email: string; name?: string }
): Promise<StripeCustomerResult> {
  const { sessionToken, email, name } = options;

  // 1. Check KV cache by session token
  const cachedCustomerId = await getStripeCustomerForSession(sessionToken);
  if (cachedCustomerId) {
    return { customerId: cachedCustomerId, isNew: false };
  }

  // 2. For guests, we don't check DB - just create new Stripe customer
  // This is because guests don't have persistent accounts
  const stripeCustomer = await stripe.customers.create({
    email,
    name,
    metadata: {
      // Mark as guest checkout
      checkoutType: "guest",
      sessionToken: sessionToken.substring(0, 16), // Truncate for privacy
    },
  });

  // 3. Cache in KV with session token (temporary, expires with session)
  await setStripeCustomerForSession(sessionToken, stripeCustomer.id);

  return { customerId: stripeCustomer.id, isNew: true };
}

// Link an existing Stripe customer to a Clerk user
// Used when a guest creates an account after checkout
export async function linkStripeCustomerToUser(
  clerkUserId: string,
  stripeCustomerId: string,
  email: string,
  name?: string
): Promise<void> {
  const stripe = getStripe();

  // 1. Update Stripe customer metadata to include Clerk user ID
  await stripe.customers.update(stripeCustomerId, {
    metadata: {
      clerkUserId,
      checkoutType: "registered", // Upgrade from guest
    },
  });

  // 2. Check if customer record exists
  const existingCustomer = await db.query.customer.findFirst({
    where: (model, { eq }) => eq(model.clerk_user_id, clerkUserId),
  });

  if (existingCustomer) {
    // Update existing record with Stripe ID
    await db
      .update(customer)
      .set({ stripe_customer_id: stripeCustomerId })
      .where(eq(customer.id, existingCustomer.id));
  } else {
    // Create new customer record
    const nameParts = (name || "").split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    await db.insert(customer).values({
      clerk_user_id: clerkUserId,
      stripe_customer_id: stripeCustomerId,
      email,
      firstName,
      last_name: lastName,
      isUser: true,
    });
  }

  // 3. Cache in KV
  await setStripeCustomerForUser(clerkUserId, stripeCustomerId);
}

// Get customer's saved payment methods from Stripe
// Returns list of payment methods for display in checkout
export async function getCustomerPaymentMethods(
  stripeCustomerId: string
): Promise<Stripe.PaymentMethod[]> {
  const stripe = getStripe();

  const paymentMethods = await stripe.paymentMethods.list({
    customer: stripeCustomerId,
    type: "card",
  });

  return paymentMethods.data;
}

// Get customer by Clerk user ID from database
export async function getCustomerByClerkId(clerkUserId: string) {
  return db.query.customer.findFirst({
    where: (model, { eq }) => eq(model.clerk_user_id, clerkUserId),
  });
}

// Get customer by Stripe customer ID from database
export async function getCustomerByStripeId(stripeCustomerId: string) {
  return db.query.customer.findFirst({
    where: (model, { eq }) => eq(model.stripe_customer_id, stripeCustomerId),
  });
}

import "server-only";
import { Redis } from "@upstash/redis";
import { env } from "~/env";

// Singleton Redis client instance
// Lazy-loaded to avoid initialization errors during build
let redisInstance: Redis | null = null;

// Check if Upstash KV is configured
export function isKvConfigured(): boolean {
  return !!env.UPSTASH_REDIS_REST_URL && !!env.UPSTASH_REDIS_REST_TOKEN;
}

// Get or create the Redis client instance
// Uses Upstash REST API for serverless-friendly access
// Throws if KV is not configured
function getRedis(): Redis {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error(
      "Upstash KV is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables."
    );
  }

  if (!redisInstance) {
    redisInstance = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redisInstance;
}

// KV key prefixes for different data types
// Centralizing prefixes prevents key collisions and aids debugging
export const KV_PREFIXES = {
  // Maps Clerk userId to Stripe customerId (permanent)
  STRIPE_USER: "stripe:user:",
  // Maps cart session token to Stripe customerId (temporary, for guests)
  STRIPE_SESSION: "stripe:session:",
  // Stores payment state cache for a Stripe customer
  STRIPE_CUSTOMER: "stripe:customer:",
  // Stores order state cache by payment intent ID
  ORDER_PAYMENT: "order:payment:",
  // Site-wide settings (maintenance mode, announcements, etc.)
  SITE_SETTINGS: "site:settings",
} as const;

// Type definitions for cached data structures
// These match the stripe-recommendations patterns adapted for e-commerce

// Cached payment state for a Stripe Customer
export type PaymentStateCache = {
  lastPaymentIntentId: string | null;
  lastPaymentStatus: "succeeded" | "processing" | "failed" | null;
  lastOrderId: number | null;
  paymentMethod: {
    brand: string | null;
    last4: string | null;
  } | null;
  updatedAt: number; // Unix timestamp
};

// Cached order state (for quick lookups)
export type OrderStateCache = {
  orderId: number;
  status: string;
  total: string;
  itemCount: number;
  customerId: string; // Stripe customer ID
  createdAt: number;
};

// Logo variant stores both UploadThing URL and key for upload management
export type LogoVariant = {
  url: string | null;
  key: string | null;
};

// Individual carousel media item (image or video) with ordering
export type CarouselItem = {
  type: "image" | "video";
  url: string;
  key: string; // UploadThing key for file cleanup
  alt?: string; // Optional alt text for accessibility
  order: number; // Sort position
};

// Carousel configuration for the shop homepage
export type CarouselSettings = {
  enabled: boolean; // Whether custom carousel is active (false = auto-generate from products)
  items: CarouselItem[]; // Uploaded images/videos
  autoScrollInterval: number; // Milliseconds between slides, default 3000
};

// Site-wide settings for maintenance mode, announcements, and branding
export type SiteSettings = {
  maintenanceMode: {
    enabled: boolean;
    message: string | null;
    imageUrl: string | null;
    imageKey: string | null; // UploadThing key for cleanup
  };
  announcementBanner: {
    enabled: boolean;
    text: string | null;
    scrolling: boolean; // Whether text should scroll/marquee
  };
  // Site logo with large (nav) and small (favicon/mobile) variants
  logo: {
    large: LogoVariant;
    small: LogoVariant;
  };
  // Shop homepage carousel configuration
  carousel: CarouselSettings;
  updatedAt: number; // Unix timestamp
};

// Default TTL for cached data (30 days in seconds)
const DEFAULT_TTL = 30 * 24 * 60 * 60;

// Generic get function with type safety
export async function kvGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  return redis.get<T>(key);
}

// Generic set function with optional TTL
export async function kvSet<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  const redis = getRedis();
  if (ttlSeconds) {
    await redis.set(key, value, { ex: ttlSeconds });
  } else {
    await redis.set(key, value);
  }
}

// Delete a key
export async function kvDelete(key: string): Promise<void> {
  const redis = getRedis();
  await redis.del(key);
}

// Check if a key exists
export async function kvExists(key: string): Promise<boolean> {
  const redis = getRedis();
  const result = await redis.exists(key);
  return result === 1;
}

// Stripe user mapping functions
// Maps Clerk user ID to Stripe customer ID (permanent mapping)
export async function setStripeCustomerForUser(
  clerkUserId: string,
  stripeCustomerId: string
): Promise<void> {
  const key = `${KV_PREFIXES.STRIPE_USER}${clerkUserId}`;
  await kvSet(key, stripeCustomerId);
}

export async function getStripeCustomerForUser(
  clerkUserId: string
): Promise<string | null> {
  const key = `${KV_PREFIXES.STRIPE_USER}${clerkUserId}`;
  return kvGet<string>(key);
}

// Guest session mapping functions
// Maps cart session token to Stripe customer ID (temporary, with TTL)
export async function setStripeCustomerForSession(
  sessionToken: string,
  stripeCustomerId: string
): Promise<void> {
  const key = `${KV_PREFIXES.STRIPE_SESSION}${sessionToken}`;
  // Guest session mappings expire after 30 days
  await kvSet(key, stripeCustomerId, DEFAULT_TTL);
}

export async function getStripeCustomerForSession(
  sessionToken: string
): Promise<string | null> {
  const key = `${KV_PREFIXES.STRIPE_SESSION}${sessionToken}`;
  return kvGet<string>(key);
}

// Payment state cache functions
// Stores the latest payment state for a Stripe customer
export async function setPaymentStateCache(
  stripeCustomerId: string,
  state: PaymentStateCache
): Promise<void> {
  const key = `${KV_PREFIXES.STRIPE_CUSTOMER}${stripeCustomerId}`;
  await kvSet(key, state, DEFAULT_TTL);
}

export async function getPaymentStateCache(
  stripeCustomerId: string
): Promise<PaymentStateCache | null> {
  const key = `${KV_PREFIXES.STRIPE_CUSTOMER}${stripeCustomerId}`;
  return kvGet<PaymentStateCache>(key);
}

// Order state cache functions
// Stores order state by payment intent ID for quick lookups
export async function setOrderStateCache(
  paymentIntentId: string,
  state: OrderStateCache
): Promise<void> {
  const key = `${KV_PREFIXES.ORDER_PAYMENT}${paymentIntentId}`;
  await kvSet(key, state, DEFAULT_TTL);
}

export async function getOrderStateCache(
  paymentIntentId: string
): Promise<OrderStateCache | null> {
  const key = `${KV_PREFIXES.ORDER_PAYMENT}${paymentIntentId}`;
  return kvGet<OrderStateCache>(key);
}

// Utility to check KV connection health
export async function checkKvConnection(): Promise<boolean> {
  try {
    const redis = getRedis();
    const result = await redis.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

// Site settings functions
// Default maintenance message prepopulated for new setups
export const DEFAULT_MAINTENANCE_MESSAGE =
  "We're currently performing scheduled maintenance. Please check back soon!";

// Default logo variant — no logo uploaded
export const DEFAULT_LOGO_VARIANT: LogoVariant = { url: null, key: null };

// Default carousel settings — disabled so carousel auto-generates from products
export const DEFAULT_CAROUSEL_SETTINGS: CarouselSettings = {
  enabled: false,
  items: [],
  autoScrollInterval: 3000,
};

// Default settings when none exist - maintenance is OFF by default
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  maintenanceMode: {
    enabled: false,
    message: DEFAULT_MAINTENANCE_MESSAGE,
    imageUrl: null,
    imageKey: null,
  },
  announcementBanner: {
    enabled: false,
    text: null,
    scrolling: false,
  },
  logo: {
    large: { ...DEFAULT_LOGO_VARIANT },
    small: { ...DEFAULT_LOGO_VARIANT },
  },
  carousel: { ...DEFAULT_CAROUSEL_SETTINGS },
  updatedAt: Date.now(),
};

// Get site settings (returns defaults if not set or KV not configured)
// Merges missing top-level keys from defaults for backward compatibility
// when new fields (e.g. logo) are added to SiteSettings after existing KV data
export async function getSiteSettings(): Promise<SiteSettings> {
  if (!isKvConfigured()) {
    return DEFAULT_SITE_SETTINGS;
  }
  try {
    const settings = await kvGet<SiteSettings>(KV_PREFIXES.SITE_SETTINGS);
    if (!settings) return DEFAULT_SITE_SETTINGS;
    // Fill in any missing top-level keys from defaults (backward compat)
    return {
      ...DEFAULT_SITE_SETTINGS,
      ...settings,
      logo: settings.logo ?? DEFAULT_SITE_SETTINGS.logo,
      carousel: settings.carousel ?? DEFAULT_SITE_SETTINGS.carousel,
    };
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

// Save site settings (no TTL - permanent storage)
export async function setSiteSettings(settings: SiteSettings): Promise<void> {
  await kvSet(KV_PREFIXES.SITE_SETTINGS, {
    ...settings,
    updatedAt: Date.now(),
  });
}

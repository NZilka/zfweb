/**
 * Server-side PostHog queries for admin analytics
 * Uses PostHog Node SDK to fetch visitor and event metrics
 */
import "server-only";
import { PostHog } from "posthog-node";

// Initialize PostHog client for server-side queries
const getPostHogClient = () => {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new PostHog(apiKey, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    // Disable automatic flushing for query-only usage
    flushAt: 1,
    flushInterval: 0,
  });
};

/**
 * Get unique visitor count for a date range
 * Uses PostHog insights API to query unique users
 */
export async function getVisitorCount(
  startDate: Date,
  endDate: Date
): Promise<number> {
  const client = getPostHogClient();
  if (!client) {
    console.warn("PostHog API key not configured, returning 0 visitors");
    return 0;
  }

  try {
    // PostHog Node SDK doesn't have direct query API access
    // For production, you would use the PostHog REST API directly
    // This is a placeholder that returns 0 until API is configured
    // TODO: Implement PostHog query API call for unique visitors
    await client.shutdown();
    return 0;
  } catch (error) {
    console.error("Error fetching PostHog visitor count:", error);
    return 0;
  }
}

/**
 * Get product view counts for analytics
 * Returns map of product_id -> view count
 */
export async function getProductViewCounts(
  startDate: Date,
  endDate: Date
): Promise<Map<number, number>> {
  const client = getPostHogClient();
  if (!client) {
    return new Map();
  }

  try {
    // TODO: Implement PostHog query API call for product_viewed events
    // Grouped by product_id property
    await client.shutdown();
    return new Map();
  } catch (error) {
    console.error("Error fetching PostHog product views:", error);
    return new Map();
  }
}

/**
 * Get category view counts for analytics
 * Returns map of category_id -> view count
 */
export async function getCategoryViewCounts(
  startDate: Date,
  endDate: Date
): Promise<Map<number, number>> {
  const client = getPostHogClient();
  if (!client) {
    return new Map();
  }

  try {
    // TODO: Implement PostHog query API call for category_viewed events
    // Grouped by category_id property
    await client.shutdown();
    return new Map();
  } catch (error) {
    console.error("Error fetching PostHog category views:", error);
    return new Map();
  }
}

/**
 * Calculate conversion rate from visitors to orders
 */
export async function getConversionRate(
  startDate: Date,
  endDate: Date,
  orderCount: number
): Promise<number> {
  const visitors = await getVisitorCount(startDate, endDate);
  if (visitors === 0) return 0;
  return (orderCount / visitors) * 100;
}

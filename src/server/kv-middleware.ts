/**
 * KV utilities for middleware/proxy use
 * This file does NOT use server-only directive since middleware has different context
 * Only exposes read operations needed for maintenance mode checks
 */
import { Redis } from "@upstash/redis";
import type { SiteSettings } from "./kv";

// Default maintenance message prepopulated for new setups
const DEFAULT_MAINTENANCE_MESSAGE =
  "We're currently performing scheduled maintenance. Please check back soon!";

// Default settings to use when KV is unavailable or not configured
// Maintenance is OFF by default — includes logo field for SiteSettings compat
const DEFAULT_SITE_SETTINGS: SiteSettings = {
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
    large: { url: null, key: null },
    small: { url: null, key: null },
  },
  carousel: {
    enabled: false,
    items: [],
    autoScrollInterval: 3000,
  },
  updatedAt: Date.now(),
};

// KV key for site settings
const SITE_SETTINGS_KEY = "site:settings";

/**
 * Get site settings from KV for middleware use
 * Returns defaults if KV is not configured or on error
 * Safe to call from middleware context
 */
export async function getMaintenanceSettings(): Promise<SiteSettings> {
  // Check if Upstash is configured via environment variables
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return DEFAULT_SITE_SETTINGS;
  }

  try {
    // Create Redis client for this request
    // Each middleware invocation creates a new client for serverless compatibility
    const redis = new Redis({ url, token });
    const settings = await redis.get<SiteSettings>(SITE_SETTINGS_KEY);
    return settings ?? DEFAULT_SITE_SETTINGS;
  } catch (error) {
    // Log error but don't fail - return defaults so site remains accessible
    console.error("Error fetching maintenance settings:", error);
    return DEFAULT_SITE_SETTINGS;
  }
}

/**
 * Settings Server Actions
 * Handles saving and retrieving site-wide settings (maintenance mode, announcements, carousel)
 */
"use server";

import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import {
  getSiteSettings,
  setSiteSettings,
  type SiteSettings,
  isKvConfigured,
} from "./kv";
import { utapi } from "./uploadthing";

// Validation schema for maintenance mode settings
// Uses refine to enforce message requirement when enabled
const maintenanceModeSchema = z
  .object({
    enabled: z.boolean(),
    message: z.string().max(1000).nullable(),
    imageUrl: z.string().url().nullable().or(z.literal("")),
    imageKey: z.string().nullable(),
  })
  .refine(
    // Message is required when enabling maintenance mode
    (data) => !data.enabled || (data.message && data.message.trim().length > 0),
    { message: "A maintenance message is required when enabling maintenance mode" }
  );

// Validation schema for announcement banner settings
const announcementBannerSchema = z.object({
  enabled: z.boolean(),
  text: z.string().max(500).nullable(),
  scrolling: z.boolean(),
});

// Validation schema for a single logo variant (url + UploadThing key)
const logoVariantSchema = z.object({
  url: z.string().url().nullable().or(z.literal("")),
  key: z.string().nullable(),
});

// Validation schema for site logo settings (large + small variants)
const logoSchema = z.object({
  large: logoVariantSchema,
  small: logoVariantSchema,
});

// UploadThing URL prefix — all legitimate uploads are served from this domain
const UPLOADTHING_URL_PREFIX = "https://utfs.io/";

// Validation schema for a single carousel media item
// Validates URL is from UploadThing domain and key matches URL to prevent
// arbitrary file key injection (which could lead to unauthorized file deletion)
const carouselItemSchema = z
  .object({
    type: z.enum(["image", "video"]),
    url: z.string().url(),
    key: z.string().min(1),
    alt: z.string().max(200).optional(),
    order: z.number().int().min(0),
  })
  .refine((item) => item.url.startsWith(UPLOADTHING_URL_PREFIX), {
    message: "Carousel media URL must be from UploadThing",
  })
  .refine((item) => item.url.includes(item.key), {
    message: "Carousel media URL must match the file key",
  });

// Validation schema for carousel settings
// Max 30 items, auto-scroll interval between 1-10 seconds
const carouselSchema = z.object({
  enabled: z.boolean(),
  items: z.array(carouselItemSchema).max(30),
  autoScrollInterval: z.number().int().min(1000).max(10000),
});

// Combined settings update schema — each section is optional for partial updates
const updateSettingsSchema = z.object({
  maintenanceMode: maintenanceModeSchema.optional(),
  announcementBanner: announcementBannerSchema.optional(),
  logo: logoSchema.optional(),
  carousel: carouselSchema.optional(),
});

type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// Result type for actions
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Get current site settings
 * Returns default settings if KV is not configured or on error
 */
export async function getSettings(): Promise<SiteSettings> {
  return getSiteSettings();
}

/**
 * Check if KV storage is available for settings
 */
export async function checkSettingsAvailable(): Promise<boolean> {
  return isKvConfigured();
}

/**
 * Update site settings (partial update supported)
 * Only updates the fields provided in the input
 * Requires authentication — server actions are publicly callable endpoints
 */
export async function updateSettings(
  input: UpdateSettingsInput
): Promise<ActionResult> {
  // Auth check — prevent unauthenticated access to settings mutation
  const user = await auth();
  if (!user.userId) {
    return { success: false, error: "Unauthorized" };
  }

  // Check if KV is configured
  if (!isKvConfigured()) {
    return {
      success: false,
      error: "Settings storage is not configured. Please set up Upstash KV.",
    };
  }

  // Validate input
  const parsed = updateSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid settings data",
    };
  }

  try {
    // Get current settings
    const currentSettings = await getSiteSettings();

    // Merge with updates — only overwrite sections that were provided
    const updatedSettings: SiteSettings = {
      ...currentSettings,
      maintenanceMode: parsed.data.maintenanceMode
        ? {
            ...currentSettings.maintenanceMode,
            ...parsed.data.maintenanceMode,
            // Normalize empty string to null for imageUrl
            imageUrl: parsed.data.maintenanceMode.imageUrl || null,
          }
        : currentSettings.maintenanceMode,
      announcementBanner: parsed.data.announcementBanner
        ? {
            ...currentSettings.announcementBanner,
            ...parsed.data.announcementBanner,
          }
        : currentSettings.announcementBanner,
      // Logo merge: normalize empty URL strings to null
      logo: parsed.data.logo
        ? {
            large: {
              url: parsed.data.logo.large.url || null,
              key: parsed.data.logo.large.key,
            },
            small: {
              url: parsed.data.logo.small.url || null,
              key: parsed.data.logo.small.key,
            },
          }
        : currentSettings.logo,
      // Carousel merge: replace entire carousel config when provided
      carousel: parsed.data.carousel ?? currentSettings.carousel,
      updatedAt: Date.now(),
    };

    // Clean up removed carousel files from UploadThing
    // Only deletes keys that existed in the STORED carousel items (server-trusted data)
    // and are no longer present in the new items. Schema validation above ensures
    // new items have valid UploadThing URLs with matching keys, preventing injection.
    if (parsed.data.carousel) {
      const oldKeys = new Set(currentSettings.carousel.items.map((i) => i.key));
      const newKeys = new Set(parsed.data.carousel.items.map((i) => i.key));
      const removedKeys = [...oldKeys].filter((k) => !newKeys.has(k));
      if (removedKeys.length > 0) {
        // Fire-and-forget: don't block save on file cleanup
        utapi.deleteFiles(removedKeys).catch((err) => {
          console.error("Failed to clean up removed carousel files:", err);
        });
      }
    }

    // Save updated settings
    await setSiteSettings(updatedSettings);

    return { success: true };
  } catch (error) {
    console.error("Error updating settings:", error);
    return {
      success: false,
      error: "Failed to save settings. Please try again.",
    };
  }
}

/**
 * Toggle maintenance mode on/off
 * Convenience action for quick toggling
 */
export async function toggleMaintenanceMode(
  enabled: boolean
): Promise<ActionResult> {
  return updateSettings({
    maintenanceMode: {
      enabled,
      message: null,
      imageUrl: null,
      imageKey: null,
    },
  });
}

/**
 * Toggle announcement banner on/off
 * Convenience action for quick toggling
 */
export async function toggleAnnouncementBanner(
  enabled: boolean
): Promise<ActionResult> {
  const currentSettings = await getSiteSettings();
  return updateSettings({
    announcementBanner: {
      ...currentSettings.announcementBanner,
      enabled,
    },
  });
}

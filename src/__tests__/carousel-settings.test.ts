/**
 * Unit tests for carousel settings functionality
 * Tests carousel schema validation, item ordering, backward compatibility, and security
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the kv module before importing settings-actions
vi.mock("~/server/kv", () => ({
  isKvConfigured: vi.fn(() => true),
  getSiteSettings: vi.fn(),
  setSiteSettings: vi.fn(),
  DEFAULT_SITE_SETTINGS: {
    maintenanceMode: {
      enabled: false,
      message:
        "We're currently performing scheduled maintenance. Please check back soon!",
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
  },
}));

// Mock uploadthing utapi — needed for carousel file cleanup
vi.mock("~/server/uploadthing", () => ({
  utapi: { deleteFiles: vi.fn(() => Promise.resolve()) },
}));

// Mock Clerk auth — updateSettings requires authentication
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => Promise.resolve({ userId: "test-user-id" })),
}));

// Import after mocking
import { updateSettings } from "~/server/settings-actions";
import {
  getSiteSettings,
  setSiteSettings,
  isKvConfigured,
  DEFAULT_SITE_SETTINGS,
} from "~/server/kv";
import { utapi } from "~/server/uploadthing";
import { auth } from "@clerk/nextjs/server";

describe("carousel-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated user
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-id" } as any);
  });

  describe("authentication", () => {
    it("rejects unauthenticated requests", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      const result = await updateSettings({
        carousel: {
          enabled: true,
          items: [],
          autoScrollInterval: 3000,
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Unauthorized");
    });
  });

  describe("carousel schema validation", () => {
    it("accepts valid carousel settings with image items", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      vi.mocked(getSiteSettings).mockResolvedValue(DEFAULT_SITE_SETTINGS);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      const result = await updateSettings({
        carousel: {
          enabled: true,
          items: [
            {
              type: "image",
              url: "https://utfs.io/f/abc123img1.png",
              key: "abc123img1",
              order: 0,
            },
            {
              type: "image",
              url: "https://utfs.io/f/def456img2.png",
              key: "def456img2",
              alt: "Second image",
              order: 1,
            },
          ],
          autoScrollInterval: 3000,
        },
      });

      expect(result.success).toBe(true);
      expect(setSiteSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          carousel: expect.objectContaining({
            enabled: true,
            items: expect.arrayContaining([
              expect.objectContaining({ type: "image", key: "abc123img1" }),
            ]),
          }),
        })
      );
    });

    it("accepts valid carousel settings with video items", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      vi.mocked(getSiteSettings).mockResolvedValue(DEFAULT_SITE_SETTINGS);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      const result = await updateSettings({
        carousel: {
          enabled: true,
          items: [
            {
              type: "video",
              url: "https://utfs.io/f/vid1key.mp4",
              key: "vid1key",
              order: 0,
            },
          ],
          autoScrollInterval: 5000,
        },
      });

      expect(result.success).toBe(true);
    });

    it("rejects invalid item type", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      const result = await updateSettings({
        carousel: {
          enabled: true,
          items: [
            {
              type: "audio" as "image", // Invalid type
              url: "https://utfs.io/f/aud1key.mp3",
              key: "aud1key",
              order: 0,
            },
          ],
          autoScrollInterval: 3000,
        },
      });

      expect(result.success).toBe(false);
    });

    it("rejects items exceeding max count (30)", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      // Create 31 items to exceed max — URLs contain keys for validation
      const items = Array.from({ length: 31 }, (_, i) => ({
        type: "image" as const,
        url: `https://utfs.io/f/key${i}.png`,
        key: `key${i}`,
        order: i,
      }));

      const result = await updateSettings({
        carousel: {
          enabled: true,
          items,
          autoScrollInterval: 3000,
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe("carousel item URL/key security validation", () => {
    it("rejects items with non-UploadThing URL", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      // URL from a different domain — could be used for key injection
      const result = await updateSettings({
        carousel: {
          enabled: true,
          items: [
            {
              type: "image",
              url: "https://evil.com/f/stolen-key.png",
              key: "stolen-key",
              order: 0,
            },
          ],
          autoScrollInterval: 3000,
        },
      });

      expect(result.success).toBe(false);
    });

    it("rejects items where URL does not contain the key", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      // URL is from UploadThing but key doesn't match — arbitrary key injection
      const result = await updateSettings({
        carousel: {
          enabled: true,
          items: [
            {
              type: "image",
              url: "https://utfs.io/f/legitimate-file.png",
              key: "product-image-key-to-delete",
              order: 0,
            },
          ],
          autoScrollInterval: 3000,
        },
      });

      expect(result.success).toBe(false);
    });

    it("rejects items with empty key", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      const result = await updateSettings({
        carousel: {
          enabled: true,
          items: [
            {
              type: "image",
              url: "https://utfs.io/f/img.png",
              key: "",
              order: 0,
            },
          ],
          autoScrollInterval: 3000,
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe("auto-scroll interval bounds", () => {
    it("accepts interval at minimum (1000ms)", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      vi.mocked(getSiteSettings).mockResolvedValue(DEFAULT_SITE_SETTINGS);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      const result = await updateSettings({
        carousel: {
          enabled: true,
          items: [],
          autoScrollInterval: 1000,
        },
      });

      expect(result.success).toBe(true);
    });

    it("accepts interval at maximum (10000ms)", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      vi.mocked(getSiteSettings).mockResolvedValue(DEFAULT_SITE_SETTINGS);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      const result = await updateSettings({
        carousel: {
          enabled: true,
          items: [],
          autoScrollInterval: 10000,
        },
      });

      expect(result.success).toBe(true);
    });

    it("rejects interval below minimum", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      const result = await updateSettings({
        carousel: {
          enabled: true,
          items: [],
          autoScrollInterval: 500, // Below 1000ms minimum
        },
      });

      expect(result.success).toBe(false);
    });

    it("rejects interval above maximum", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      const result = await updateSettings({
        carousel: {
          enabled: true,
          items: [],
          autoScrollInterval: 15000, // Above 10000ms maximum
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe("backward compatibility", () => {
    it("returns defaults when settings lack carousel field", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      vi.mocked(getSiteSettings).mockResolvedValue({
        ...DEFAULT_SITE_SETTINGS,
        carousel: DEFAULT_SITE_SETTINGS.carousel,
      });

      const settings = await getSiteSettings();

      expect(settings.carousel).toEqual({
        enabled: false,
        items: [],
        autoScrollInterval: 3000,
      });
    });

    it("preserves carousel when updating other settings", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      const settingsWithCarousel = {
        ...DEFAULT_SITE_SETTINGS,
        carousel: {
          enabled: true,
          items: [
            {
              type: "image" as const,
              url: "https://utfs.io/f/imgkey1.png",
              key: "imgkey1",
              order: 0,
            },
          ],
          autoScrollInterval: 5000,
        },
      };
      vi.mocked(getSiteSettings).mockResolvedValue(settingsWithCarousel);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      // Update only announcement — carousel should be preserved
      await updateSettings({
        announcementBanner: {
          enabled: true,
          text: "New announcement",
          scrolling: false,
        },
      });

      expect(setSiteSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          carousel: expect.objectContaining({
            enabled: true,
            items: expect.arrayContaining([
              expect.objectContaining({ key: "imgkey1" }),
            ]),
          }),
        })
      );
    });
  });

  describe("file cleanup on item removal", () => {
    it("deletes removed carousel files from UploadThing", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      // Current settings have 3 items — keys match UploadThing URL pattern
      const currentSettings = {
        ...DEFAULT_SITE_SETTINGS,
        carousel: {
          enabled: true,
          items: [
            { type: "image" as const, url: "https://utfs.io/f/keyA.png", key: "keyA", order: 0 },
            { type: "image" as const, url: "https://utfs.io/f/keyB.png", key: "keyB", order: 1 },
            { type: "video" as const, url: "https://utfs.io/f/keyC.mp4", key: "keyC", order: 2 },
          ],
          autoScrollInterval: 3000,
        },
      };
      vi.mocked(getSiteSettings).mockResolvedValue(currentSettings);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      // Save with only 1 item remaining — keyB and keyC removed
      await updateSettings({
        carousel: {
          enabled: true,
          items: [
            { type: "image", url: "https://utfs.io/f/keyA.png", key: "keyA", order: 0 },
          ],
          autoScrollInterval: 3000,
        },
      });

      // utapi.deleteFiles should be called with the removed keys
      expect(utapi.deleteFiles).toHaveBeenCalledWith(["keyB", "keyC"]);
    });

    it("does not call deleteFiles when no items removed", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      const currentSettings = {
        ...DEFAULT_SITE_SETTINGS,
        carousel: {
          enabled: true,
          items: [
            { type: "image" as const, url: "https://utfs.io/f/keyA.png", key: "keyA", order: 0 },
          ],
          autoScrollInterval: 3000,
        },
      };
      vi.mocked(getSiteSettings).mockResolvedValue(currentSettings);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      // Save same items — no removal
      await updateSettings({
        carousel: {
          enabled: true,
          items: [
            { type: "image", url: "https://utfs.io/f/keyA.png", key: "keyA", order: 0 },
          ],
          autoScrollInterval: 3000,
        },
      });

      expect(utapi.deleteFiles).not.toHaveBeenCalled();
    });
  });
});

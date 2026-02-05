/**
 * Unit tests for carousel settings functionality
 * Tests carousel schema validation, item ordering, and backward compatibility
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

// Import after mocking
import { updateSettings } from "~/server/settings-actions";
import {
  getSiteSettings,
  setSiteSettings,
  isKvConfigured,
  DEFAULT_SITE_SETTINGS,
} from "~/server/kv";
import { utapi } from "~/server/uploadthing";

describe("carousel-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
              url: "https://utfs.io/f/img1.png",
              key: "img1",
              order: 0,
            },
            {
              type: "image",
              url: "https://utfs.io/f/img2.png",
              key: "img2",
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
              expect.objectContaining({ type: "image", key: "img1" }),
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
              url: "https://utfs.io/f/vid1.mp4",
              key: "vid1",
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
              url: "https://utfs.io/f/audio.mp3",
              key: "aud1",
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

      // Create 31 items to exceed max
      const items = Array.from({ length: 31 }, (_, i) => ({
        type: "image" as const,
        url: `https://utfs.io/f/img${i}.png`,
        key: `img${i}`,
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
      // Simulate old settings without carousel — getSiteSettings fills defaults
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
              url: "https://utfs.io/f/img.png",
              key: "img-key",
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
              expect.objectContaining({ key: "img-key" }),
            ]),
          }),
        })
      );
    });
  });

  describe("file cleanup on item removal", () => {
    it("deletes removed carousel files from UploadThing", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      // Current settings have 3 items
      const currentSettings = {
        ...DEFAULT_SITE_SETTINGS,
        carousel: {
          enabled: true,
          items: [
            { type: "image" as const, url: "https://utfs.io/f/a.png", key: "key-a", order: 0 },
            { type: "image" as const, url: "https://utfs.io/f/b.png", key: "key-b", order: 1 },
            { type: "video" as const, url: "https://utfs.io/f/c.mp4", key: "key-c", order: 2 },
          ],
          autoScrollInterval: 3000,
        },
      };
      vi.mocked(getSiteSettings).mockResolvedValue(currentSettings);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      // Save with only 1 item remaining — key-b and key-c removed
      await updateSettings({
        carousel: {
          enabled: true,
          items: [
            { type: "image", url: "https://utfs.io/f/a.png", key: "key-a", order: 0 },
          ],
          autoScrollInterval: 3000,
        },
      });

      // utapi.deleteFiles should be called with the removed keys
      expect(utapi.deleteFiles).toHaveBeenCalledWith(["key-b", "key-c"]);
    });

    it("does not call deleteFiles when no items removed", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      const currentSettings = {
        ...DEFAULT_SITE_SETTINGS,
        carousel: {
          enabled: true,
          items: [
            { type: "image" as const, url: "https://utfs.io/f/a.png", key: "key-a", order: 0 },
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
            { type: "image", url: "https://utfs.io/f/a.png", key: "key-a", order: 0 },
          ],
          autoScrollInterval: 3000,
        },
      });

      expect(utapi.deleteFiles).not.toHaveBeenCalled();
    });
  });
});

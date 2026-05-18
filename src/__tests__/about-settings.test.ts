/**
 * Unit tests for about page settings functionality
 * Tests about schema validation, image cleanup, and merge logic
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the kv module before importing settings-actions
// vi.mock is hoisted, so all values must be inlined (no external references)
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
      rows: [null, null, null, null],
      autoScrollInterval: 3000,
    },
    about: {
      enabled: false,
      title: null,
      content: null,
      images: [],
    },
    testMode: {
      enabled: false,
      outcome: "success",
    },
    updatedAt: Date.now(),
  },
}));

// Mock uploadthing utapi — needed for about image cleanup
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

describe("about-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-id" } as any);
  });

  describe("authentication", () => {
    it("rejects unauthenticated requests", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      const result = await updateSettings({
        about: {
          enabled: true,
          title: "About Us",
          content: "Our story",
          images: [],
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Unauthorized");
    });
  });

  describe("schema validation", () => {
    it("accepts valid about data", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      vi.mocked(getSiteSettings).mockResolvedValue(DEFAULT_SITE_SETTINGS);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      const result = await updateSettings({
        about: {
          enabled: true,
          title: "About Zilka Forgewerks",
          content: "We craft fine jewelry and tools.",
          images: [],
        },
      });

      expect(result.success).toBe(true);
      expect(setSiteSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          about: expect.objectContaining({
            enabled: true,
            title: "About Zilka Forgewerks",
            content: "We craft fine jewelry and tools.",
          }),
        })
      );
    });

    it("accepts null title and content (clearing)", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      vi.mocked(getSiteSettings).mockResolvedValue(DEFAULT_SITE_SETTINGS);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      const result = await updateSettings({
        about: {
          enabled: false,
          title: null,
          content: null,
          images: [],
        },
      });

      expect(result.success).toBe(true);
    });

    it("rejects title exceeding 200 characters", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      const result = await updateSettings({
        about: {
          enabled: true,
          title: "a".repeat(201),
          content: "Valid content",
          images: [],
        },
      });

      expect(result.success).toBe(false);
    });

    it("rejects content exceeding 10000 characters", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      const result = await updateSettings({
        about: {
          enabled: true,
          title: "Title",
          content: "a".repeat(10001),
          images: [],
        },
      });

      expect(result.success).toBe(false);
    });

    it("accepts images with valid URL and key", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      vi.mocked(getSiteSettings).mockResolvedValue(DEFAULT_SITE_SETTINGS);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      const result = await updateSettings({
        about: {
          enabled: true,
          title: "About",
          content: null,
          images: [
            { url: "https://utfs.io/f/abc123.jpg", key: "abc123", alt: "Photo" },
          ],
        },
      });

      expect(result.success).toBe(true);
    });

    it("rejects images with invalid URL", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      const result = await updateSettings({
        about: {
          enabled: true,
          title: "About",
          content: null,
          images: [
            { url: "not-a-url", key: "abc", alt: "Bad" },
          ],
        },
      });

      expect(result.success).toBe(false);
    });

    it("rejects images with empty key", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      const result = await updateSettings({
        about: {
          enabled: true,
          title: "About",
          content: null,
          images: [
            { url: "https://utfs.io/f/img.jpg", key: "", alt: "Empty key" },
          ],
        },
      });

      expect(result.success).toBe(false);
    });

    it("rejects more than 10 images", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      const tooManyImages = Array.from({ length: 11 }, (_, i) => ({
        url: `https://utfs.io/f/img${i}.jpg`,
        key: `img${i}`,
        alt: `Image ${i}`,
      }));

      const result = await updateSettings({
        about: {
          enabled: true,
          title: "About",
          content: null,
          images: tooManyImages,
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe("merge logic", () => {
    it("preserves other settings when updating about only", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      const existingSettings = {
        ...DEFAULT_SITE_SETTINGS,
        announcementBanner: {
          enabled: true,
          text: "Sale!",
          scrolling: true,
        },
      };
      vi.mocked(getSiteSettings).mockResolvedValue(existingSettings);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      await updateSettings({
        about: {
          enabled: true,
          title: "About Us",
          content: "Our story",
          images: [],
        },
      });

      // Announcement banner should be preserved
      expect(setSiteSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          announcementBanner: expect.objectContaining({
            enabled: true,
            text: "Sale!",
            scrolling: true,
          }),
        })
      );
    });

    it("preserves about when updating other settings", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      const settingsWithAbout = {
        ...DEFAULT_SITE_SETTINGS,
        about: {
          enabled: true,
          title: "About Us",
          content: "We make things.",
          images: [
            { url: "https://utfs.io/f/shop.jpg", key: "shop", alt: "Our shop" },
          ],
        },
      };
      vi.mocked(getSiteSettings).mockResolvedValue(settingsWithAbout);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      // Update only announcement — about should be preserved
      await updateSettings({
        announcementBanner: {
          enabled: true,
          text: "New announcement",
          scrolling: false,
        },
      });

      expect(setSiteSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          about: expect.objectContaining({
            enabled: true,
            title: "About Us",
            content: "We make things.",
            images: expect.arrayContaining([
              expect.objectContaining({ key: "shop" }),
            ]),
          }),
        })
      );
    });
  });

  describe("image cleanup on changes", () => {
    it("deletes removed image keys from UploadThing", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      // Current settings have 2 images
      const currentSettings = {
        ...DEFAULT_SITE_SETTINGS,
        about: {
          enabled: true,
          title: "About",
          content: null,
          images: [
            { url: "https://utfs.io/f/old1.jpg", key: "old1", alt: "Old 1" },
            { url: "https://utfs.io/f/old2.jpg", key: "old2", alt: "Old 2" },
          ],
        },
      };
      vi.mocked(getSiteSettings).mockResolvedValue(currentSettings);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      // Save with only 1 image — old2 should be deleted
      await updateSettings({
        about: {
          enabled: true,
          title: "About",
          content: null,
          images: [
            { url: "https://utfs.io/f/old1.jpg", key: "old1", alt: "Old 1" },
          ],
        },
      });

      expect(utapi.deleteFiles).toHaveBeenCalledWith(["old2"]);
    });

    it("deletes all image keys when images array is cleared", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      const currentSettings = {
        ...DEFAULT_SITE_SETTINGS,
        about: {
          enabled: true,
          title: "About",
          content: null,
          images: [
            { url: "https://utfs.io/f/a.jpg", key: "a", alt: "A" },
            { url: "https://utfs.io/f/b.jpg", key: "b", alt: "B" },
          ],
        },
      };
      vi.mocked(getSiteSettings).mockResolvedValue(currentSettings);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      // Save with empty images — all keys should be deleted
      await updateSettings({
        about: {
          enabled: false,
          title: null,
          content: null,
          images: [],
        },
      });

      expect(utapi.deleteFiles).toHaveBeenCalledWith(
        expect.arrayContaining(["a", "b"])
      );
    });

    it("does not call deleteFiles when no images removed", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      const currentSettings = {
        ...DEFAULT_SITE_SETTINGS,
        about: {
          enabled: true,
          title: "About",
          content: null,
          images: [
            { url: "https://utfs.io/f/keep.jpg", key: "keep", alt: "Keep" },
          ],
        },
      };
      vi.mocked(getSiteSettings).mockResolvedValue(currentSettings);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      // Save same image — no removal
      await updateSettings({
        about: {
          enabled: true,
          title: "About",
          content: null,
          images: [
            { url: "https://utfs.io/f/keep.jpg", key: "keep", alt: "Keep" },
          ],
        },
      });

      expect(utapi.deleteFiles).not.toHaveBeenCalled();
    });
  });
});

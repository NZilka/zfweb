/**
 * Unit tests for carousel settings functionality
 * Tests row-based carousel schema validation, file cleanup, and security
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

// Helper to create a valid images row for testing
const makeImagesRow = (prefix: string) => ({
  type: "images" as const,
  cells: [
    { url: `https://utfs.io/f/${prefix}1.png`, key: `${prefix}1`, alt: "Alt" },
    { url: `https://utfs.io/f/${prefix}2.png`, key: `${prefix}2`, alt: "Alt" },
    { url: `https://utfs.io/f/${prefix}3.png`, key: `${prefix}3`, alt: "Alt" },
  ],
});

// Helper to create a valid video row for testing
const makeVideoRow = (key: string) => ({
  type: "video" as const,
  url: `https://utfs.io/f/${key}.mp4`,
  key,
  videoPositionY: 50,
});

describe("carousel-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-id" } as any);
  });

  describe("authentication", () => {
    it("rejects unauthenticated requests", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      const result = await updateSettings({
        carousel: {
          rows: [null, null, null, null],
          autoScrollInterval: 3000,
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Unauthorized");
    });
  });

  describe("row schema validation", () => {
    it("accepts valid images row with 3 cells", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      vi.mocked(getSiteSettings).mockResolvedValue(DEFAULT_SITE_SETTINGS);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      const result = await updateSettings({
        carousel: {
          rows: [makeImagesRow("img"), null, null, null],
          autoScrollInterval: 3000,
        },
      });

      expect(result.success).toBe(true);
      expect(setSiteSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          carousel: expect.objectContaining({
            rows: expect.arrayContaining([
              expect.objectContaining({ type: "images" }),
            ]),
          }),
        })
      );
    });

    it("accepts valid video row", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      vi.mocked(getSiteSettings).mockResolvedValue(DEFAULT_SITE_SETTINGS);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      const result = await updateSettings({
        carousel: {
          rows: [makeVideoRow("vid1"), null, null, null],
          autoScrollInterval: 5000,
        },
      });

      expect(result.success).toBe(true);
    });

    it("accepts null rows (empty grid)", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      vi.mocked(getSiteSettings).mockResolvedValue(DEFAULT_SITE_SETTINGS);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      const result = await updateSettings({
        carousel: {
          rows: [null, null, null, null],
          autoScrollInterval: 3000,
        },
      });

      expect(result.success).toBe(true);
    });

    it("accepts images row with null cells (partially filled)", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      vi.mocked(getSiteSettings).mockResolvedValue(DEFAULT_SITE_SETTINGS);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      const result = await updateSettings({
        carousel: {
          rows: [
            {
              type: "images",
              cells: [
                { url: "https://utfs.io/f/a1.png", key: "a1", alt: "Alt" },
                null,
                null,
              ],
            },
            null,
            null,
            null,
          ],
          autoScrollInterval: 3000,
        },
      });

      expect(result.success).toBe(true);
    });

    it("rejects rows array with wrong length (not 4)", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      const result = await updateSettings({
        carousel: {
          rows: [null, null], // Only 2 rows instead of 4
          autoScrollInterval: 3000,
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe("URL/key security validation", () => {
    it("rejects image cells with non-UploadThing URL", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      const result = await updateSettings({
        carousel: {
          rows: [
            {
              type: "images",
              cells: [
                { url: "https://evil.com/f/stolen.png", key: "stolen", alt: "Bad" },
                null,
                null,
              ],
            },
            null,
            null,
            null,
          ],
          autoScrollInterval: 3000,
        },
      });

      expect(result.success).toBe(false);
    });

    it("rejects image cells where URL does not contain key", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      const result = await updateSettings({
        carousel: {
          rows: [
            {
              type: "images",
              cells: [
                {
                  url: "https://utfs.io/f/legitimate.png",
                  key: "injected-key-to-delete",
                  alt: "Bad",
                },
                null,
                null,
              ],
            },
            null,
            null,
            null,
          ],
          autoScrollInterval: 3000,
        },
      });

      expect(result.success).toBe(false);
    });

    it("rejects image cells with empty key", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      const result = await updateSettings({
        carousel: {
          rows: [
            {
              type: "images",
              cells: [
                { url: "https://utfs.io/f/img.png", key: "", alt: "Empty" },
                null,
                null,
              ],
            },
            null,
            null,
            null,
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
          rows: [null, null, null, null],
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
          rows: [null, null, null, null],
          autoScrollInterval: 10000,
        },
      });

      expect(result.success).toBe(true);
    });

    it("rejects interval below minimum", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      const result = await updateSettings({
        carousel: {
          rows: [null, null, null, null],
          autoScrollInterval: 500,
        },
      });

      expect(result.success).toBe(false);
    });

    it("rejects interval above maximum", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      const result = await updateSettings({
        carousel: {
          rows: [null, null, null, null],
          autoScrollInterval: 15000,
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe("backward compatibility", () => {
    it("preserves carousel when updating other settings", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      const settingsWithCarousel = {
        ...DEFAULT_SITE_SETTINGS,
        carousel: {
          rows: [makeImagesRow("keep"), null, null, null],
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
            rows: expect.arrayContaining([
              expect.objectContaining({ type: "images" }),
            ]),
            autoScrollInterval: 5000,
          }),
        })
      );
    });
  });

  describe("file cleanup on row changes", () => {
    it("deletes removed image cell keys from UploadThing", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      // Current settings have an images row with 3 keys
      const currentSettings = {
        ...DEFAULT_SITE_SETTINGS,
        carousel: {
          rows: [makeImagesRow("old"), null, null, null],
          autoScrollInterval: 3000,
        },
      };
      vi.mocked(getSiteSettings).mockResolvedValue(currentSettings);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      // Save with empty rows — all old keys should be deleted
      await updateSettings({
        carousel: {
          rows: [null, null, null, null],
          autoScrollInterval: 3000,
        },
      });

      // utapi.deleteFiles should be called with the removed keys
      expect(utapi.deleteFiles).toHaveBeenCalledWith(
        expect.arrayContaining(["old1", "old2", "old3"])
      );
    });

    it("deletes removed video key from UploadThing", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      const currentSettings = {
        ...DEFAULT_SITE_SETTINGS,
        carousel: {
          rows: [makeVideoRow("vidkey"), null, null, null],
          autoScrollInterval: 3000,
        },
      };
      vi.mocked(getSiteSettings).mockResolvedValue(currentSettings);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      // Replace video row with images row — video key should be deleted
      await updateSettings({
        carousel: {
          rows: [makeImagesRow("new"), null, null, null],
          autoScrollInterval: 3000,
        },
      });

      expect(utapi.deleteFiles).toHaveBeenCalledWith(["vidkey"]);
    });

    it("does not call deleteFiles when no keys removed", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      const currentSettings = {
        ...DEFAULT_SITE_SETTINGS,
        carousel: {
          rows: [makeImagesRow("keep"), null, null, null],
          autoScrollInterval: 3000,
        },
      };
      vi.mocked(getSiteSettings).mockResolvedValue(currentSettings);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      // Save same row — no removal
      await updateSettings({
        carousel: {
          rows: [makeImagesRow("keep"), null, null, null],
          autoScrollInterval: 3000,
        },
      });

      expect(utapi.deleteFiles).not.toHaveBeenCalled();
    });
  });
});

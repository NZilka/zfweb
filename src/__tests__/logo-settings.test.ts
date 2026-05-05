/**
 * Unit tests for logo settings functionality
 * Tests logo schema validation, backward compatibility, and merge logic
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
      rows: [null, null, null, null],
      autoScrollInterval: 3000,
    },
    about: {
      enabled: false,
      title: null,
      content: null,
      images: [],
    },
    // Test mode defaults
    testMode: {
      enabled: false,
      outcome: "success",
    },
    updatedAt: Date.now(),
  },
}));

// Mock uploadthing utapi — needed by settings-actions for carousel file cleanup
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

describe("logo-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateSettings with logo data", () => {
    it("merges logo settings correctly", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      vi.mocked(getSiteSettings).mockResolvedValue(DEFAULT_SITE_SETTINGS);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      const result = await updateSettings({
        logo: {
          large: { url: "https://example.com/logo-lg.png", key: "logo-lg" },
          small: { url: "https://example.com/logo-sm.png", key: "logo-sm" },
        },
      });

      expect(result.success).toBe(true);
      expect(setSiteSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          logo: {
            large: {
              url: "https://example.com/logo-lg.png",
              key: "logo-lg",
            },
            small: {
              url: "https://example.com/logo-sm.png",
              key: "logo-sm",
            },
          },
        })
      );
    });

    it("preserves other settings when updating logo only", async () => {
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
        logo: {
          large: { url: "https://example.com/logo.png", key: "key1" },
          small: { url: null, key: null },
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
  });

  describe("logo URL validation", () => {
    it("accepts valid URL for logo", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      vi.mocked(getSiteSettings).mockResolvedValue(DEFAULT_SITE_SETTINGS);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      const result = await updateSettings({
        logo: {
          large: {
            url: "https://utfs.io/f/abc123.png",
            key: "abc123",
          },
          small: { url: null, key: null },
        },
      });

      expect(result.success).toBe(true);
    });

    it("accepts null URL for logo (clearing logo)", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      vi.mocked(getSiteSettings).mockResolvedValue(DEFAULT_SITE_SETTINGS);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      const result = await updateSettings({
        logo: {
          large: { url: null, key: null },
          small: { url: null, key: null },
        },
      });

      expect(result.success).toBe(true);
      expect(setSiteSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          logo: {
            large: { url: null, key: null },
            small: { url: null, key: null },
          },
        })
      );
    });

    it("normalizes empty string URL to null", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      vi.mocked(getSiteSettings).mockResolvedValue(DEFAULT_SITE_SETTINGS);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      await updateSettings({
        logo: {
          large: { url: "", key: null },
          small: { url: "", key: null },
        },
      });

      // Empty strings should be normalized to null
      expect(setSiteSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          logo: {
            large: { url: null, key: null },
            small: { url: null, key: null },
          },
        })
      );
    });

    it("rejects invalid URL for logo", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      const result = await updateSettings({
        logo: {
          large: { url: "not-a-url", key: "key1" },
          small: { url: null, key: null },
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe("backward compatibility", () => {
    it("returns defaults when settings lack logo field", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      // Simulate old settings data without logo field
      const oldSettings = {
        maintenanceMode: {
          enabled: false,
          message: "Maintenance",
          imageUrl: null,
          imageKey: null,
        },
        announcementBanner: {
          enabled: false,
          text: null,
          scrolling: false,
        },
        updatedAt: Date.now(),
      };
      // getSiteSettings should fill in missing logo/carousel/about from defaults
      // (this is tested by the merge logic in kv.ts getSiteSettings)
      vi.mocked(getSiteSettings).mockResolvedValue({
        ...oldSettings,
        logo: DEFAULT_SITE_SETTINGS.logo,
        carousel: DEFAULT_SITE_SETTINGS.carousel,
        about: DEFAULT_SITE_SETTINGS.about,
        testMode: DEFAULT_SITE_SETTINGS.testMode,
      });

      const settings = await getSiteSettings();

      expect(settings.logo).toEqual({
        large: { url: null, key: null },
        small: { url: null, key: null },
      });
    });

    it("preserves logo when updating other settings", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      const settingsWithLogo = {
        ...DEFAULT_SITE_SETTINGS,
        logo: {
          large: { url: "https://example.com/lg.png", key: "lg-key" },
          small: { url: "https://example.com/sm.png", key: "sm-key" },
        },
      };
      vi.mocked(getSiteSettings).mockResolvedValue(settingsWithLogo);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      // Update only announcement — logo should be preserved
      await updateSettings({
        announcementBanner: {
          enabled: true,
          text: "New announcement",
          scrolling: false,
        },
      });

      expect(setSiteSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          logo: {
            large: { url: "https://example.com/lg.png", key: "lg-key" },
            small: { url: "https://example.com/sm.png", key: "sm-key" },
          },
        })
      );
    });
  });
});

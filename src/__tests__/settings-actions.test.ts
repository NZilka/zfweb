/**
 * Unit tests for settings actions and validation
 * Tests settings schema validation and default values
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the kv module before importing settings-actions
// Note: vi.mock is hoisted, so we use literal strings here
vi.mock("~/server/kv", () => ({
  isKvConfigured: vi.fn(() => true),
  getSiteSettings: vi.fn(),
  setSiteSettings: vi.fn(),
  DEFAULT_SITE_SETTINGS: {
    maintenanceMode: {
      enabled: false,
      // Prepopulated default message
      message: "We're currently performing scheduled maintenance. Please check back soon!",
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

// Mock uploadthing utapi — needed by settings-actions for carousel file cleanup
vi.mock("~/server/uploadthing", () => ({
  utapi: { deleteFiles: vi.fn(() => Promise.resolve()) },
}));

// Mock Clerk auth — updateSettings requires authentication
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => Promise.resolve({ userId: "test-user-id" })),
}));

// Import after mocking
import { getSettings, updateSettings, checkSettingsAvailable } from "~/server/settings-actions";
import { getSiteSettings, setSiteSettings, isKvConfigured, DEFAULT_SITE_SETTINGS } from "~/server/kv";

describe("settings-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSettings", () => {
    it("returns settings from KV store", async () => {
      const mockSettings = {
        ...DEFAULT_SITE_SETTINGS,
        maintenanceMode: {
          enabled: true,
          message: "Under maintenance",
          imageUrl: null,
          imageKey: null,
        },
      };
      vi.mocked(getSiteSettings).mockResolvedValue(mockSettings);

      const result = await getSettings();

      expect(result).toEqual(mockSettings);
      expect(getSiteSettings).toHaveBeenCalled();
    });
  });

  describe("checkSettingsAvailable", () => {
    it("returns true when KV is configured", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      const result = await checkSettingsAvailable();

      expect(result).toBe(true);
    });

    it("returns false when KV is not configured", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(false);

      const result = await checkSettingsAvailable();

      expect(result).toBe(false);
    });
  });

  describe("updateSettings", () => {
    it("updates maintenance mode settings", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      vi.mocked(getSiteSettings).mockResolvedValue(DEFAULT_SITE_SETTINGS);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      const result = await updateSettings({
        maintenanceMode: {
          enabled: true,
          message: "Site is down for maintenance",
          imageUrl: null,
          imageKey: null,
        },
      });

      expect(result.success).toBe(true);
      expect(setSiteSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          maintenanceMode: expect.objectContaining({
            enabled: true,
            message: "Site is down for maintenance",
          }),
        })
      );
    });

    it("updates announcement banner settings", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      vi.mocked(getSiteSettings).mockResolvedValue(DEFAULT_SITE_SETTINGS);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      const result = await updateSettings({
        announcementBanner: {
          enabled: true,
          text: "Free shipping today!",
          scrolling: true,
        },
      });

      expect(result.success).toBe(true);
      expect(setSiteSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          announcementBanner: expect.objectContaining({
            enabled: true,
            text: "Free shipping today!",
            scrolling: true,
          }),
        })
      );
    });

    it("returns error when KV is not configured", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(false);

      const result = await updateSettings({
        maintenanceMode: {
          enabled: true,
          message: null,
          imageUrl: null,
          imageKey: null,
        },
      });

      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error");
    });

    it("validates message length", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      // Create a message that exceeds 1000 characters
      const longMessage = "a".repeat(1001);

      const result = await updateSettings({
        maintenanceMode: {
          enabled: true,
          message: longMessage,
          imageUrl: null,
          imageKey: null,
        },
      });

      expect(result.success).toBe(false);
    });

    it("validates announcement text length", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      // Create text that exceeds 500 characters
      const longText = "a".repeat(501);

      const result = await updateSettings({
        announcementBanner: {
          enabled: true,
          text: longText,
          scrolling: false,
        },
      });

      expect(result.success).toBe(false);
    });

    it("normalizes empty imageUrl to null", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      vi.mocked(getSiteSettings).mockResolvedValue(DEFAULT_SITE_SETTINGS);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      await updateSettings({
        maintenanceMode: {
          enabled: false,
          message: null,
          imageUrl: "",
          imageKey: null,
        },
      });

      expect(setSiteSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          maintenanceMode: expect.objectContaining({
            imageUrl: null,
          }),
        })
      );
    });

    it("requires message when enabling maintenance mode", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      // Attempt to enable maintenance without a message
      const result = await updateSettings({
        maintenanceMode: {
          enabled: true,
          message: null,
          imageUrl: null,
          imageKey: null,
        },
      });

      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error");
    });

    it("requires non-empty message when enabling maintenance mode", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);

      // Attempt to enable maintenance with empty/whitespace message
      const result = await updateSettings({
        maintenanceMode: {
          enabled: true,
          message: "   ",
          imageUrl: null,
          imageKey: null,
        },
      });

      expect(result.success).toBe(false);
      expect(result).toHaveProperty("error");
    });

    it("allows disabling maintenance without message", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      vi.mocked(getSiteSettings).mockResolvedValue({
        ...DEFAULT_SITE_SETTINGS,
        maintenanceMode: {
          enabled: true,
          message: "Under maintenance",
          imageUrl: null,
          imageKey: null,
        },
      });
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      // Disabling maintenance should work without requiring message
      const result = await updateSettings({
        maintenanceMode: {
          enabled: false,
          message: null,
          imageUrl: null,
          imageKey: null,
        },
      });

      expect(result.success).toBe(true);
    });

    it("allows enabling maintenance with valid message", async () => {
      vi.mocked(isKvConfigured).mockReturnValue(true);
      vi.mocked(getSiteSettings).mockResolvedValue(DEFAULT_SITE_SETTINGS);
      vi.mocked(setSiteSettings).mockResolvedValue(undefined);

      // Enable maintenance with a valid message
      const result = await updateSettings({
        maintenanceMode: {
          enabled: true,
          message: "We are performing scheduled maintenance",
          imageUrl: null,
          imageKey: null,
        },
      });

      expect(result.success).toBe(true);
      expect(setSiteSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          maintenanceMode: expect.objectContaining({
            enabled: true,
            message: "We are performing scheduled maintenance",
          }),
        })
      );
    });
  });
});

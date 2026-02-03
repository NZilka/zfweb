/**
 * Unit tests for settings actions and validation
 * Tests settings schema validation and default values
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
      message: null,
      imageUrl: null,
      imageKey: null,
    },
    announcementBanner: {
      enabled: false,
      text: null,
      scrolling: false,
    },
    updatedAt: Date.now(),
  },
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
  });
});

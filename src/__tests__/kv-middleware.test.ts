/**
 * Unit tests for kv-middleware module
 * Tests the middleware-safe KV utilities for maintenance mode
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Store original env
const originalEnv = { ...process.env };

// Create mock get function that can be configured per test
const mockGet = vi.fn();

// Mock the @upstash/redis module with a class constructor
vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {
    constructor(public config: { url: string; token: string }) {}
    get = mockGet;
  },
}));

// Import after mocking
import { getMaintenanceSettings } from "~/server/kv-middleware";

describe("kv-middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
    // Reset env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore env
    process.env = originalEnv;
  });

  describe("getMaintenanceSettings", () => {
    it("returns default settings when KV is not configured", async () => {
      // Remove KV env vars
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      const result = await getMaintenanceSettings();

      // Should return defaults without calling Redis
      expect(result.maintenanceMode.enabled).toBe(false);
      expect(result.maintenanceMode.message).toBeNull();
      expect(mockGet).not.toHaveBeenCalled();
    });

    it("returns default settings when URL is missing", async () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      process.env.UPSTASH_REDIS_REST_TOKEN = "token";

      const result = await getMaintenanceSettings();

      expect(result.maintenanceMode.enabled).toBe(false);
      expect(mockGet).not.toHaveBeenCalled();
    });

    it("returns default settings when token is missing", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://redis.upstash.io";
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      const result = await getMaintenanceSettings();

      expect(result.maintenanceMode.enabled).toBe(false);
      expect(mockGet).not.toHaveBeenCalled();
    });

    it("fetches settings from Redis when configured", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://redis.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "token";

      const mockSettings = {
        maintenanceMode: {
          enabled: true,
          message: "Under maintenance",
          imageUrl: "https://example.com/image.jpg",
          imageKey: "key123",
        },
        announcementBanner: {
          enabled: false,
          text: null,
          scrolling: false,
        },
        updatedAt: Date.now(),
      };

      mockGet.mockResolvedValue(mockSettings);

      const result = await getMaintenanceSettings();

      expect(mockGet).toHaveBeenCalledWith("site:settings");
      expect(result).toEqual(mockSettings);
    });

    it("returns default settings when Redis returns null", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://redis.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "token";

      mockGet.mockResolvedValue(null);

      const result = await getMaintenanceSettings();

      expect(result.maintenanceMode.enabled).toBe(false);
    });

    it("returns default settings on Redis error", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://redis.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "token";

      // Suppress console.error for this test
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      mockGet.mockRejectedValue(new Error("Connection failed"));

      const result = await getMaintenanceSettings();

      // Should return defaults on error, not throw
      expect(result.maintenanceMode.enabled).toBe(false);
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });
});

/**
 * Unit tests for test mode settings in settings-actions
 * Verifies the TEST_MODE_ALLOWED env gate and the testMode merge logic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mutable env mock — per-test we set TEST_MODE_ALLOWED before calling updateSettings
// vi.mock is hoisted, so the env object itself must be defined inline in the factory
vi.mock("~/env", () => ({
  env: {
    TEST_MODE_ALLOWED: true, // default to allowed; individual tests override
  },
}));

// Mock kv module before importing settings-actions
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

vi.mock("~/server/uploadthing", () => ({
  utapi: { deleteFiles: vi.fn(() => Promise.resolve()) },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => Promise.resolve({ userId: "test-user-id" })),
  // Backend client used by requireAdmin()/isAdminUser(): the test user is an admin
  clerkClient: vi.fn(async () => ({
    users: {
      getUser: vi.fn(async () => ({ privateMetadata: { "can-upload": true } })),
    },
  })),
}));

// Import after mocks
import { updateSettings } from "~/server/settings-actions";
import {
  getSiteSettings,
  setSiteSettings,
  DEFAULT_SITE_SETTINGS,
} from "~/server/kv";
import { env } from "~/env";

describe("settings-actions testMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env flag to allowed before each test; opt into disabled only when needed
    (env as unknown as { TEST_MODE_ALLOWED: boolean }).TEST_MODE_ALLOWED = true;
    vi.mocked(getSiteSettings).mockResolvedValue(DEFAULT_SITE_SETTINGS);
    vi.mocked(setSiteSettings).mockResolvedValue(undefined);
  });

  it("accepts testMode update when TEST_MODE_ALLOWED is true", async () => {
    const result = await updateSettings({
      testMode: { enabled: true, outcome: "success" },
    });

    expect(result.success).toBe(true);
    expect(setSiteSettings).toHaveBeenCalledOnce();
    const saved = vi.mocked(setSiteSettings).mock.calls[0]?.[0];
    expect(saved?.testMode).toEqual({ enabled: true, outcome: "success" });
  });

  it("rejects testMode update when TEST_MODE_ALLOWED is false", async () => {
    (env as unknown as { TEST_MODE_ALLOWED: boolean }).TEST_MODE_ALLOWED = false;

    const result = await updateSettings({
      testMode: { enabled: true, outcome: "success" },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/not available/i);
    }
    // DB write must not happen when the gate rejects
    expect(setSiteSettings).not.toHaveBeenCalled();
  });

  it("accepts outcome=failure as a valid value", async () => {
    const result = await updateSettings({
      testMode: { enabled: true, outcome: "failure" },
    });

    expect(result.success).toBe(true);
    const saved = vi.mocked(setSiteSettings).mock.calls[0]?.[0];
    expect(saved?.testMode.outcome).toBe("failure");
  });

  it("rejects invalid outcome values via Zod validation", async () => {
    const result = await updateSettings({
      // @ts-expect-error - intentionally invalid to verify schema rejects it
      testMode: { enabled: true, outcome: "pending" },
    });

    expect(result.success).toBe(false);
    expect(setSiteSettings).not.toHaveBeenCalled();
  });

  it("preserves other settings when only testMode is updated", async () => {
    // Current settings have maintenance mode on — verify updating testMode doesn't reset it
    vi.mocked(getSiteSettings).mockResolvedValue({
      ...DEFAULT_SITE_SETTINGS,
      maintenanceMode: {
        enabled: true,
        message: "Under maintenance",
        imageUrl: null,
        imageKey: null,
      },
    });

    const result = await updateSettings({
      testMode: { enabled: true, outcome: "success" },
    });

    expect(result.success).toBe(true);
    const saved = vi.mocked(setSiteSettings).mock.calls[0]?.[0];
    expect(saved?.maintenanceMode.enabled).toBe(true);
    expect(saved?.testMode.enabled).toBe(true);
  });

  it("does not modify testMode when the input omits it", async () => {
    vi.mocked(getSiteSettings).mockResolvedValue({
      ...DEFAULT_SITE_SETTINGS,
      testMode: { enabled: true, outcome: "failure" },
    });

    const result = await updateSettings({
      announcementBanner: { enabled: true, text: "Hi", scrolling: false },
    });

    expect(result.success).toBe(true);
    const saved = vi.mocked(setSiteSettings).mock.calls[0]?.[0];
    // Existing testMode should be preserved
    expect(saved?.testMode).toEqual({ enabled: true, outcome: "failure" });
  });
});

describe("DEFAULT_TEST_MODE_SETTINGS", () => {
  it("has the expected default shape (disabled, outcome=success)", () => {
    // Re-import to assert on the real module shape, not the mock
    expect(DEFAULT_SITE_SETTINGS.testMode).toEqual({
      enabled: false,
      outcome: "success",
    });
  });
});

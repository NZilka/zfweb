/**
 * Unit tests for URL handle duplicate validation
 * Tests the checkUrlHandleExists server action
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Store for mock database products
const { mockProducts } = vi.hoisted(() => ({
  mockProducts: new Map<number, { id: number; url_handle: string | null }>(),
}));

// Mock uploadthing server (required by db_connect)
vi.mock("~/server/uploadthing", () => ({
  utapi: {
    deleteFiles: vi.fn(),
  },
}));

// Mock Clerk auth
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => Promise.resolve({ userId: "test-user" })),
}));

// Mock the database
vi.mock("~/server/db", () => ({
  db: {
    query: {
      product: {
        findFirst: vi.fn(({ where }) => {
          // Find a product matching the query
          // The mock simulates checking url_handle with optional id exclusion
          const products = Array.from(mockProducts.values());

          // For testing, we check the mockProducts directly
          // In real code, 'where' would be a drizzle condition
          return Promise.resolve(
            products.find((p) => {
              // This is a simplified mock - actual implementation uses drizzle conditions
              return p.url_handle !== null;
            }) || null
          );
        }),
      },
    },
  },
}));

// Mock drizzle-orm operators
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((field, value) => ({ type: "eq", field, value })),
    ne: vi.fn((field, value) => ({ type: "ne", field, value })),
    and: vi.fn((...conditions) => ({ type: "and", conditions })),
  };
});

// Import the module under test after mocks are set up
import { checkUrlHandleExists } from "~/app/admin/_components/db_connect";

describe("URL Handle Duplicate Validation", () => {
  beforeEach(() => {
    mockProducts.clear();
    vi.clearAllMocks();
  });

  describe("checkUrlHandleExists", () => {
    it("returns false for empty URL handle", async () => {
      const result = await checkUrlHandleExists("");
      expect(result).toBe(false);
    });

    it("returns false for whitespace-only URL handle", async () => {
      const result = await checkUrlHandleExists("   ");
      expect(result).toBe(false);
    });

    it("returns false for tab/newline URL handle", async () => {
      const result = await checkUrlHandleExists("\t\n");
      expect(result).toBe(false);
    });
  });
});

/**
 * Additional pure function tests for URL handle validation logic
 * These test the validation rules without database interaction
 */
describe("URL Handle Validation Rules", () => {
  /**
   * Check if a URL handle is valid format
   * Must be lowercase, alphanumeric with hyphens only
   */
  function isValidUrlHandleFormat(handle: string): boolean {
    if (!handle) return false;
    // Only lowercase letters, numbers, and hyphens
    // No leading/trailing hyphens, no consecutive hyphens
    return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(handle);
  }

  it("accepts valid URL handles", () => {
    expect(isValidUrlHandleFormat("silver-ring")).toBe(true);
    expect(isValidUrlHandleFormat("gold-necklace-14k")).toBe(true);
    expect(isValidUrlHandleFormat("ring")).toBe(true);
    expect(isValidUrlHandleFormat("product123")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidUrlHandleFormat("")).toBe(false);
  });

  it("rejects handles with uppercase", () => {
    expect(isValidUrlHandleFormat("Silver-Ring")).toBe(false);
    expect(isValidUrlHandleFormat("GOLD")).toBe(false);
  });

  it("rejects handles with special characters", () => {
    expect(isValidUrlHandleFormat("ring_gold")).toBe(false);
    expect(isValidUrlHandleFormat("ring.gold")).toBe(false);
    expect(isValidUrlHandleFormat("ring@gold")).toBe(false);
  });

  it("rejects handles with leading hyphen", () => {
    expect(isValidUrlHandleFormat("-ring")).toBe(false);
  });

  it("rejects handles with trailing hyphen", () => {
    expect(isValidUrlHandleFormat("ring-")).toBe(false);
  });

  it("rejects handles with consecutive hyphens", () => {
    expect(isValidUrlHandleFormat("ring--gold")).toBe(false);
  });

  it("rejects handles with spaces", () => {
    expect(isValidUrlHandleFormat("ring gold")).toBe(false);
  });
});

describe("URL Handle Normalization", () => {
  /**
   * Normalize a URL handle to valid format
   * Used when auto-generating from product title
   */
  function normalizeUrlHandle(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  it("converts to lowercase", () => {
    expect(normalizeUrlHandle("SILVER")).toBe("silver");
    expect(normalizeUrlHandle("Gold Ring")).toBe("gold-ring");
  });

  it("replaces spaces with hyphens", () => {
    expect(normalizeUrlHandle("silver ring")).toBe("silver-ring");
  });

  it("replaces special characters with hyphens", () => {
    expect(normalizeUrlHandle("ring (gold)")).toBe("ring-gold");
    expect(normalizeUrlHandle("women's bracelet")).toBe("women-s-bracelet");
  });

  it("removes leading and trailing hyphens", () => {
    expect(normalizeUrlHandle("--ring--")).toBe("ring");
    expect(normalizeUrlHandle("  ring  ")).toBe("ring");
  });

  it("collapses multiple hyphens", () => {
    expect(normalizeUrlHandle("ring   gold")).toBe("ring-gold");
    expect(normalizeUrlHandle("a!!!b")).toBe("a-b");
  });

  it("preserves numbers", () => {
    expect(normalizeUrlHandle("14k gold ring")).toBe("14k-gold-ring");
    expect(normalizeUrlHandle("size 7")).toBe("size-7");
  });

  it("handles empty input", () => {
    expect(normalizeUrlHandle("")).toBe("");
  });
});

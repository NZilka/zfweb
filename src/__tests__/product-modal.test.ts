/**
 * Unit tests for product modal helper functions
 * Tests URL handle generation and duplicate naming
 */
import { describe, it, expect } from "vitest";

/**
 * Generate URL-friendly slug from product title
 * Extracted from ProductEditForm for testing
 */
function generateUrlHandle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Generate duplicate product title
 * Adds "(Copy)" suffix to original title
 */
function generateDuplicateTitle(title: string): string {
  return `${title} (Copy)`;
}

/**
 * Generate duplicate SKU
 * Adds "-copy" suffix to original SKU
 */
function generateDuplicateSku(sku: string | null): string | undefined {
  if (!sku) return undefined;
  return `${sku}-copy`;
}

describe("URL Handle Generation", () => {
  it("converts title to lowercase slug", () => {
    expect(generateUrlHandle("Silver Ring")).toBe("silver-ring");
  });

  it("replaces spaces with hyphens", () => {
    expect(generateUrlHandle("Gold Necklace Set")).toBe("gold-necklace-set");
  });

  it("removes special characters", () => {
    expect(generateUrlHandle("Diamond Ring (14k)")).toBe("diamond-ring-14k");
  });

  it("handles multiple spaces and special chars", () => {
    expect(generateUrlHandle("  Bronze   Earrings!!!  ")).toBe("bronze-earrings");
  });

  it("handles numbers", () => {
    expect(generateUrlHandle("Ring Size 7")).toBe("ring-size-7");
  });

  it("removes leading and trailing hyphens", () => {
    expect(generateUrlHandle("---test---")).toBe("test");
  });

  it("handles empty string", () => {
    expect(generateUrlHandle("")).toBe("");
  });

  it("handles apostrophes", () => {
    expect(generateUrlHandle("Women's Bracelet")).toBe("women-s-bracelet");
  });
});

describe("Duplicate Title Generation", () => {
  it("adds (Copy) suffix to title", () => {
    expect(generateDuplicateTitle("Silver Ring")).toBe("Silver Ring (Copy)");
  });

  it("preserves original formatting", () => {
    expect(generateDuplicateTitle("14k GOLD Necklace")).toBe(
      "14k GOLD Necklace (Copy)"
    );
  });
});

describe("Duplicate SKU Generation", () => {
  it("adds -copy suffix to SKU", () => {
    expect(generateDuplicateSku("SR-001")).toBe("SR-001-copy");
  });

  it("returns undefined for null SKU", () => {
    expect(generateDuplicateSku(null)).toBeUndefined();
  });

  it("handles SKU with existing suffix", () => {
    expect(generateDuplicateSku("RING-2024")).toBe("RING-2024-copy");
  });
});

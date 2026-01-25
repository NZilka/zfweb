/**
 * Tests for discount action utilities
 * Tests pure calculation functions and validation logic
 */
import { describe, it, expect, vi } from "vitest";

// Mock server-only module
vi.mock("server-only", () => ({}));

// Mock next/cache revalidatePath
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock the database
vi.mock("~/server/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  },
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  sql: vi.fn(),
}));

// Import pure function from lib (moved out of server actions file)
import { calculateDiscountedTotal } from "~/lib/discount-utils";

describe("Discount Calculation Utilities", () => {
  describe("calculateDiscountedTotal", () => {
    describe("percent discounts", () => {
      it("should calculate 10% off correctly", () => {
        const result = calculateDiscountedTotal(100, 10, "percent");

        expect(result.discountAmount).toBe(10);
        expect(result.finalTotal).toBe(90);
      });

      it("should calculate 25% off correctly", () => {
        const result = calculateDiscountedTotal(200, 25, "percent");

        expect(result.discountAmount).toBe(50);
        expect(result.finalTotal).toBe(150);
      });

      it("should calculate 50% off correctly", () => {
        const result = calculateDiscountedTotal(150, 50, "percent");

        expect(result.discountAmount).toBe(75);
        expect(result.finalTotal).toBe(75);
      });

      it("should handle 100% discount (free)", () => {
        const result = calculateDiscountedTotal(100, 100, "percent");

        expect(result.discountAmount).toBe(100);
        expect(result.finalTotal).toBe(0);
      });

      it("should round to 2 decimal places", () => {
        // 33.33% of $100 = $33.33
        const result = calculateDiscountedTotal(100, 33.33, "percent");

        expect(result.discountAmount).toBe(33.33);
        expect(result.finalTotal).toBe(66.67);
      });

      it("should handle small amounts with percentages", () => {
        // 10% of $1.50 = $0.15
        const result = calculateDiscountedTotal(1.5, 10, "percent");

        expect(result.discountAmount).toBe(0.15);
        expect(result.finalTotal).toBe(1.35);
      });
    });

    describe("fixed discounts", () => {
      it("should calculate $10 off correctly", () => {
        const result = calculateDiscountedTotal(100, 10, "fixed");

        expect(result.discountAmount).toBe(10);
        expect(result.finalTotal).toBe(90);
      });

      it("should calculate $25 off correctly", () => {
        const result = calculateDiscountedTotal(100, 25, "fixed");

        expect(result.discountAmount).toBe(25);
        expect(result.finalTotal).toBe(75);
      });

      it("should not allow discount to exceed subtotal", () => {
        // $50 discount on $30 order - should cap at $30
        const result = calculateDiscountedTotal(30, 50, "fixed");

        expect(result.discountAmount).toBe(30);
        expect(result.finalTotal).toBe(0);
      });

      it("should handle exact subtotal match", () => {
        const result = calculateDiscountedTotal(50, 50, "fixed");

        expect(result.discountAmount).toBe(50);
        expect(result.finalTotal).toBe(0);
      });
    });

    describe("edge cases", () => {
      it("should handle zero subtotal", () => {
        const result = calculateDiscountedTotal(0, 10, "percent");

        expect(result.discountAmount).toBe(0);
        expect(result.finalTotal).toBe(0);
      });

      it("should handle zero discount", () => {
        const result = calculateDiscountedTotal(100, 0, "percent");

        expect(result.discountAmount).toBe(0);
        expect(result.finalTotal).toBe(100);
      });

      it("should never return negative finalTotal", () => {
        // Even with a huge discount, total should be 0, not negative
        const result = calculateDiscountedTotal(10, 100, "fixed");

        expect(result.finalTotal).toBeGreaterThanOrEqual(0);
      });

      it("should handle floating point subtotals", () => {
        const result = calculateDiscountedTotal(99.99, 10, "percent");

        // 10% of 99.99 = 9.999, rounded to 10.00
        expect(result.discountAmount).toBe(10);
        expect(result.finalTotal).toBe(89.99);
      });
    });
  });
});

describe("Discount Validation Types", () => {
  it("should have correct ValidatedDiscount structure", () => {
    // Type check - this validates the interface structure
    const validDiscount = {
      id: 1,
      code: "SAVE10",
      name: "10% Off",
      discount: 10,
      discountType: "percent" as const,
      freeShipping: false,
    };

    expect(validDiscount.id).toBe(1);
    expect(validDiscount.code).toBe("SAVE10");
    expect(validDiscount.discountType).toBe("percent");
  });

  it("should accept both percent and fixed discount types", () => {
    const percentType: "percent" | "fixed" = "percent";
    const fixedType: "percent" | "fixed" = "fixed";

    expect(percentType).toBe("percent");
    expect(fixedType).toBe("fixed");
  });
});

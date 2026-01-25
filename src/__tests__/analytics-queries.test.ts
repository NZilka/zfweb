/**
 * Tests for analytics query utilities
 * Focuses on pure functions that don't require database mocking
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only module (required for importing analytics-queries)
vi.mock("server-only", () => ({}));

// Mock the database to avoid actual connections
vi.mock("~/server/db", () => ({
  db: {},
}));

// Mock drizzle-orm functions
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  sql: vi.fn(),
  desc: vi.fn(),
}));

// Import after mocks are set up
import { getDateRangeFromPreset, type DateRangePreset } from "~/server/analytics-queries";

describe("Analytics Query Utilities", () => {
  describe("getDateRangeFromPreset", () => {
    // Use a fixed date for consistent testing
    const mockDate = new Date("2024-06-15T12:00:00Z");

    beforeEach(() => {
      // Mock Date to return consistent values
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);
    });

    it("should return 7 days range for '7d' preset", () => {
      const { start, end } = getDateRangeFromPreset("7d");

      // End should be now
      expect(end.getTime()).toBe(mockDate.getTime());

      // Start should be 7 days ago
      const expectedStart = new Date(mockDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      expect(start.getTime()).toBe(expectedStart.getTime());
    });

    it("should return 30 days range for '30d' preset", () => {
      const { start, end } = getDateRangeFromPreset("30d");

      expect(end.getTime()).toBe(mockDate.getTime());

      const expectedStart = new Date(mockDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      expect(start.getTime()).toBe(expectedStart.getTime());
    });

    it("should return first day of current month for 'month' preset", () => {
      const { start, end } = getDateRangeFromPreset("month");

      expect(end.getTime()).toBe(mockDate.getTime());

      // June 1, 2024 (months are 0-indexed)
      expect(start.getFullYear()).toBe(2024);
      expect(start.getMonth()).toBe(5); // June
      expect(start.getDate()).toBe(1);
    });

    it("should return January 1 of current year for 'year' preset", () => {
      const { start, end } = getDateRangeFromPreset("year");

      expect(end.getTime()).toBe(mockDate.getTime());

      // January 1, 2024
      expect(start.getFullYear()).toBe(2024);
      expect(start.getMonth()).toBe(0); // January
      expect(start.getDate()).toBe(1);
    });

    it("should return year 2000 for 'all' preset (captures all historical data)", () => {
      const { start, end } = getDateRangeFromPreset("all");

      expect(end.getTime()).toBe(mockDate.getTime());

      // Should start from year 2000
      expect(start.getFullYear()).toBe(2000);
      expect(start.getMonth()).toBe(0);
      expect(start.getDate()).toBe(1);
    });

    it("should handle year boundary correctly for 'year' preset", () => {
      // Test at January 2nd to ensure we get Jan 1 of same year
      const janDate = new Date("2024-01-02T12:00:00Z");
      vi.setSystemTime(janDate);

      const { start } = getDateRangeFromPreset("year");

      expect(start.getFullYear()).toBe(2024);
      expect(start.getMonth()).toBe(0);
      expect(start.getDate()).toBe(1);
    });

    it("should handle month boundary correctly for 'month' preset", () => {
      // Test at January 1st
      const janFirst = new Date("2024-01-01T12:00:00Z");
      vi.setSystemTime(janFirst);

      const { start } = getDateRangeFromPreset("month");

      expect(start.getFullYear()).toBe(2024);
      expect(start.getMonth()).toBe(0);
      expect(start.getDate()).toBe(1);
    });
  });
});

describe("DateRangePreset Type", () => {
  it("should accept valid preset values", () => {
    const presets: DateRangePreset[] = ["7d", "30d", "month", "year", "all"];

    presets.forEach((preset) => {
      expect(["7d", "30d", "month", "year", "all"]).toContain(preset);
    });
  });
});

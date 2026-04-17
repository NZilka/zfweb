/**
 * Unit tests for the includeTest filter in admin-queries.ts
 * Verifies that getOrdersByFulfillmentStatus and getOrderCounts correctly
 * include/exclude test orders based on the includeTest parameter.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only (admin-queries imports it)
vi.mock("server-only", () => ({}));

// Capture each eq() call so we can assert that is_test filtering happened
const eqCalls: Array<{ column: unknown; value: unknown }> = [];

// drizzle-orm mock — `eq` records its args so tests can verify filter predicates
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((column: unknown, value: unknown) => {
    eqCalls.push({ column, value });
    return { __eq: true, column, value };
  }),
  // and() just wraps its args for assertion-friendly structure
  and: vi.fn((...args: unknown[]) => ({ __and: true, args })),
  desc: vi.fn((col: unknown) => ({ __desc: true, col })),
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
}));

// Query builder mock: returns an empty array but lets us assert structure
const mockOrderBy = vi.fn(() => Promise.resolve([]));
const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockInnerJoin = vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) }));
const mockSelect = vi.fn(() => ({
  from: mockFrom,
  // Items query uses innerJoin — chained separately
  innerJoin: mockInnerJoin,
}));

vi.mock("~/server/db", () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: mockWhere,
        innerJoin: mockInnerJoin,
      }),
    }),
  },
}));

// Import after all mocks are in place
import {
  getOrdersByFulfillmentStatus,
  getOrderCounts,
} from "~/server/admin-queries";
import { order } from "~/server/db/schema";

// Helper: check whether the recorded eq() calls include a filter for is_test=false
const hasIsTestFalseFilter = () =>
  eqCalls.some(
    (call) => call.column === order.is_test && call.value === false,
  );

describe("admin-queries test order filtering", () => {
  beforeEach(() => {
    eqCalls.length = 0;
    vi.clearAllMocks();
  });

  describe("getOrdersByFulfillmentStatus", () => {
    it("adds is_test=false predicate by default (includeTest omitted)", async () => {
      await getOrdersByFulfillmentStatus("unshipped");
      expect(hasIsTestFalseFilter()).toBe(true);
    });

    it("adds is_test=false predicate when includeTest is explicitly false", async () => {
      await getOrdersByFulfillmentStatus("all", false);
      expect(hasIsTestFalseFilter()).toBe(true);
    });

    it("does NOT add is_test filter when includeTest is true", async () => {
      await getOrdersByFulfillmentStatus("all", true);
      expect(hasIsTestFalseFilter()).toBe(false);
    });

    it("applies the is_test filter for every fulfillment tab", async () => {
      // Spot-check each tab — catches regressions that only filter on one tab
      for (const tab of ["unshipped", "in_process", "shipped", "all"] as const) {
        eqCalls.length = 0;
        await getOrdersByFulfillmentStatus(tab);
        expect(hasIsTestFalseFilter()).toBe(true);
      }
    });
  });

  describe("getOrderCounts", () => {
    it("excludes test orders from counts by default", async () => {
      await getOrderCounts();
      // baseConditions is built once and reused across all 4 parallel count queries,
      // so eq(is_test, false) fires exactly once — we only need to assert it happened
      expect(hasIsTestFalseFilter()).toBe(true);
    });

    it("does not add is_test filter when includeTest is true", async () => {
      await getOrderCounts(true);
      expect(hasIsTestFalseFilter()).toBe(false);
    });
  });
});

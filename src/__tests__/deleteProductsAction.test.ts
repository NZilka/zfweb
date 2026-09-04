/**
 * Tests for the bulk product delete server action.
 *
 * The action loops over IDs calling deleteProductCore() per item with
 * try/catch, so we mock deleteProductCore directly to control success/
 * failure for each ID. This isolates the action's logic (auth check,
 * title pre-fetch, per-item error classification, result aggregation)
 * from the underlying DB/UT code which already has its own coverage.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// server-only is imported by queries.ts → needs the no-op mock in test env.
vi.mock("server-only", () => ({}));

// next/cache — revalidatePath is fire-and-forget in the action.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Clerk auth — controllable per test via the mock fn.
const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
  // Backend client used by requireAdmin()/isAdminUser(): signed-in test users are admins
  clerkClient: vi.fn(async () => ({
    users: {
      getUser: vi.fn(async () => ({ privateMetadata: { "can-upload": true } })),
    },
  })),
}));

// Mock the DB layer just enough to back the title-prefetch select query.
// The actual per-item delete is mocked at the deleteProductCore level
// (see below), so we don't need to mock the delete() chain here.
const mockTitlesByIds = new Map<number, string>();
vi.mock("~/server/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() =>
          Promise.resolve(
            Array.from(mockTitlesByIds, ([id, title]) => ({ id, title })),
          ),
        ),
      })),
    })),
    // Stubbed; not exercised in these tests.
    delete: vi.fn(),
    query: { product: { findFirst: vi.fn() } },
  },
}));

// Pass-through mock for drizzle-orm so the action can call inArray() etc.
// without us having to fake every helper. The mocked db.select chain
// ignores the where() arg so the actual operator doesn't matter for tests.
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return { ...actual, inArray: vi.fn(), eq: vi.fn() };
});

// utapi — stubbed; not reached because we mock deleteProductCore.
vi.mock("~/server/uploadthing", () => ({
  utapi: { deleteFiles: vi.fn() },
}));

// THE key mock — deleteProductCore is the per-item delete primitive.
// Tests control its behavior by setting up mockDeleteCore.mockImplementation.
const mockDeleteCore = vi.fn();
vi.mock("~/server/queries", () => ({
  deleteProductCore: (id: number) => mockDeleteCore(id),
}));

import { deleteProductsAction } from "~/server/product-actions";

// Helper: construct a Postgres FK-violation error matching the shape
// neon-http (or pg) might surface. Tested two shapes — code on err vs
// nested under cause — because the driver behavior isn't documented
// reliably.
function makeFkError(shape: "direct" | "cause") {
  if (shape === "direct") {
    const err = new Error("foreign key violation");
    (err as any).code = "23503";
    return err;
  }
  const err = new Error("foreign key violation");
  (err as any).cause = { code: "23503" };
  return err;
}

describe("deleteProductsAction", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockDeleteCore.mockReset();
    mockTitlesByIds.clear();
    // Default: authenticated admin
    mockAuth.mockResolvedValue({ userId: "admin-user-1" });
  });

  it("returns empty result when called with no ids (no DB or delete calls)", async () => {
    const result = await deleteProductsAction([]);
    expect(result).toEqual({ succeeded: [], failed: [] });
    expect(mockDeleteCore).not.toHaveBeenCalled();
  });

  it("throws on unauthenticated caller before touching the DB", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    await expect(deleteProductsAction([1, 2, 3])).rejects.toThrow(
      "Unauthorized",
    );
    expect(mockDeleteCore).not.toHaveBeenCalled();
  });

  it("returns all-succeeded when every delete resolves cleanly", async () => {
    mockTitlesByIds.set(1, "Silver Ring");
    mockTitlesByIds.set(2, "Forged Pendant");
    mockTitlesByIds.set(3, "Iron Cuff");
    mockDeleteCore.mockResolvedValue(undefined);

    const result = await deleteProductsAction([1, 2, 3]);

    expect(result.succeeded).toEqual([1, 2, 3]);
    expect(result.failed).toEqual([]);
    expect(mockDeleteCore).toHaveBeenCalledTimes(3);
  });

  it("isolates per-item failures and aggregates the partial result", async () => {
    mockTitlesByIds.set(1, "Silver Ring");
    mockTitlesByIds.set(2, "Forged Pendant");
    mockTitlesByIds.set(3, "Iron Cuff");
    // Middle delete fails with FK violation (direct code shape).
    mockDeleteCore
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(makeFkError("direct"))
      .mockResolvedValueOnce(undefined);

    const result = await deleteProductsAction([1, 2, 3]);

    expect(result.succeeded).toEqual([1, 3]);
    expect(result.failed).toEqual([
      {
        id: 2,
        title: "Forged Pendant",
        reason: "referenced by existing orders or carts",
      },
    ]);
  });

  it("recognizes FK violation when the code lives under err.cause (driver variant)", async () => {
    mockTitlesByIds.set(7, "Bound Hammer");
    mockDeleteCore.mockRejectedValueOnce(makeFkError("cause"));

    const result = await deleteProductsAction([7]);

    expect(result.succeeded).toEqual([]);
    expect(result.failed).toEqual([
      {
        id: 7,
        title: "Bound Hammer",
        reason: "referenced by existing orders or carts",
      },
    ]);
  });

  it("falls back to the error message for non-FK failures", async () => {
    mockTitlesByIds.set(5, "Mystery Item");
    mockDeleteCore.mockRejectedValueOnce(new Error("Product Not found"));

    const result = await deleteProductsAction([5]);

    expect(result.failed[0]).toEqual({
      id: 5,
      title: "Mystery Item",
      reason: "Product Not found",
    });
  });

  it("uses a #id placeholder title when the prefetch couldn't find the row", async () => {
    // No entry in mockTitlesByIds for id 99
    mockDeleteCore.mockRejectedValueOnce(makeFkError("direct"));

    const result = await deleteProductsAction([99]);

    expect(result.failed[0]).toEqual({
      id: 99,
      title: "#99",
      reason: "referenced by existing orders or carts",
    });
  });
});

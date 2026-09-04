/**
 * Authorization tests for the admin gate (src/server/auth.ts) and for the
 * server actions that must refuse non-admin callers.
 *
 * Two layers:
 * 1. requireAdmin / checkAdmin / isAdminUser against a mocked Clerk backend.
 * 2. Representative actions from every admin action module, with
 *    ~/server/auth mocked, proving each one refuses when the caller is not
 *    an admin. Every "use server" export is a public HTTP endpoint, so this
 *    is the test that keeps the review's C1..C3 findings closed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Shared mocks. vi.mock is hoisted, so these apply to every import below.
// ---------------------------------------------------------------------------

// Controllable Clerk backend: who is signed in, and whether they are an admin.
const clerkState = vi.hoisted(() => ({
  userId: null as string | null,
  adminIds: new Set<string>(),
  getUserCalls: 0,
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: clerkState.userId })),
  clerkClient: vi.fn(async () => ({
    users: {
      getUser: vi.fn(async (id: string) => {
        clerkState.getUserCalls++;
        return {
          privateMetadata: clerkState.adminIds.has(id)
            ? { "can-upload": true }
            : {},
        };
      }),
    },
  })),
}));

// Modules the action files import at load time. None of these tests reach
// the database or external services: every action must bail before that.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("~/env", () => ({ env: { TEST_MODE_ALLOWED: false } }));
vi.mock("~/server/db", () => ({
  db: {
    select: vi.fn(() => {
      throw new Error("db.select reached — authorization did not bail");
    }),
    insert: vi.fn(() => {
      throw new Error("db.insert reached — authorization did not bail");
    }),
    update: vi.fn(() => {
      throw new Error("db.update reached — authorization did not bail");
    }),
    delete: vi.fn(() => {
      throw new Error("db.delete reached — authorization did not bail");
    }),
    query: new Proxy(
      {},
      {
        get: () => {
          throw new Error("db.query reached — authorization did not bail");
        },
      },
    ),
  },
}));
vi.mock("~/server/uploadthing", () => ({
  utapi: { deleteFiles: vi.fn(), uploadFilesFromUrl: vi.fn() },
}));
vi.mock("~/server/kv", () => ({
  isKvConfigured: () => true,
  getSiteSettings: vi.fn(),
  setSiteSettings: vi.fn(),
}));
vi.mock("~/server/queries", () => ({
  deleteProductCore: vi.fn(),
  deleteProduct: vi.fn(),
}));

import { requireAdmin, checkAdmin, isAdminUser, AuthorizationError } from "~/server/auth";
import { generatePirateShipCsv, updateOrderFulfillment, markOrdersDownloaded } from "~/server/admin-actions";
import { getDiscounts, createDiscount, deleteDiscount } from "~/server/discount-actions";
import { updateSettings, getSettings, copyProductImageToCarousel } from "~/server/settings-actions";
import { deleteProductsAction, updateProductSortOrder } from "~/server/product-actions";
import { createShippingZone, deleteShippingRate } from "~/server/shipping-actions";
import { addProduct, updateProduct, createCategory, deleteCategory, checkUrlHandleExists } from "~/app/admin/_components/db_connect";
import { deleteProductAction } from "~/app/admin/_components/deleteAction";

beforeEach(() => {
  clerkState.userId = null;
  clerkState.adminIds = new Set();
  clerkState.getUserCalls = 0;
});

describe("requireAdmin / checkAdmin / isAdminUser", () => {
  it("throws Unauthorized (401) when nobody is signed in", async () => {
    await expect(requireAdmin()).rejects.toMatchObject({
      name: "AuthorizationError",
      status: 401,
    });
    expect(await checkAdmin()).toBe(false);
    // No Clerk lookup should happen without a user id
    expect(clerkState.getUserCalls).toBe(0);
  });

  it("throws Forbidden (403) for a signed-in shopper without the admin flag", async () => {
    clerkState.userId = "user_shopper";
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
    expect(await checkAdmin()).toBe(false);
  });

  it("resolves with the user id for an admin", async () => {
    clerkState.userId = "user_owner";
    clerkState.adminIds.add("user_owner");
    await expect(requireAdmin()).resolves.toEqual({ userId: "user_owner" });
    expect(await checkAdmin()).toBe(true);
    expect(await isAdminUser("user_owner")).toBe(true);
    expect(await isAdminUser("user_other")).toBe(false);
  });

  it("fails closed when the Clerk lookup throws", async () => {
    clerkState.userId = "user_owner";
    const { clerkClient } = await import("@clerk/nextjs/server");
    vi.mocked(clerkClient).mockRejectedValueOnce(new Error("clerk down"));
    expect(await checkAdmin()).toBe(false);
  });

  it("exposes a typed error class", () => {
    const err = new AuthorizationError("Forbidden");
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(403);
    expect(new AuthorizationError("Unauthorized").status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Action-level checks. Two callers: anonymous and a signed-in non-admin.
// Every action must refuse before touching the (booby-trapped) database.
// ---------------------------------------------------------------------------

const callers = [
  { name: "anonymous", setup: () => (clerkState.userId = null) },
  { name: "signed-in non-admin", setup: () => (clerkState.userId = "user_shopper") },
];

describe.each(callers)("admin actions refuse a $name caller", ({ setup }) => {
  beforeEach(() => {
    setup();
  });

  const rejected = { success: false, error: "Unauthorized" };

  it("admin-actions", async () => {
    expect(await generatePirateShipCsv([1, 2])).toEqual(rejected);
    expect(await updateOrderFulfillment(1, { isPacked: true })).toEqual(rejected);
    expect(await markOrdersDownloaded([1])).toEqual(rejected);
  });

  it("discount-actions", async () => {
    await expect(getDiscounts()).rejects.toBeInstanceOf(AuthorizationError);
    const input = {
      code: "FREE99",
      name: "x",
      description: "x",
      discount: 99,
      discountType: "percent" as const,
      freeShipping: false,
      active: true,
    };
    expect(await createDiscount(input)).toEqual(rejected);
    expect(await deleteDiscount(1)).toEqual(rejected);
  });

  it("settings-actions", async () => {
    expect(
      await updateSettings({
        maintenanceMode: { enabled: true, message: "down", imageUrl: null, imageKey: null },
      }),
    ).toEqual(rejected);
    await expect(getSettings()).rejects.toThrow("Unauthorized");
    expect(await copyProductImageToCarousel("https://utfs.io/f/abc")).toEqual(rejected);
  });

  it("product-actions", async () => {
    await expect(deleteProductsAction([1])).rejects.toBeInstanceOf(AuthorizationError);
    await expect(updateProductSortOrder([1, 2])).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("shipping-actions mutations", async () => {
    expect(await createShippingZone({ name: "Zone", is_default: false, countries: [] })).toEqual(rejected);
    expect(await deleteShippingRate(1)).toEqual(rejected);
  });

  it("db_connect product and category actions", async () => {
    const product = { title: "Ring", price: 10, description: "d", inventory: 1 };
    await expect(addProduct(product, [], [])).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      updateProduct(1, product, {
        keepKeys: [],
        keepUrls: [],
        removeKeys: [],
        newUrls: [],
        newKeys: [],
        orderedImages: [],
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(createCategory({ name: "Rings", description: "" })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(deleteCategory(1)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(checkUrlHandleExists("ring")).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("deleteProductAction", async () => {
    await expect(deleteProductAction(1)).rejects.toBeInstanceOf(AuthorizationError);
  });
});

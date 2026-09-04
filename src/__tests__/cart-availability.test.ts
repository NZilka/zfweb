/**
 * Cart availability after removing cross-cart reservations.
 *
 * Availability is now the product's own inventory, and non-active products
 * (admin-set sold_out / hidden) can no longer be added by calling the action
 * directly. These tests pin that behavior.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory stand-ins for the rows the cart actions touch.
const state = vi.hoisted(() => ({
  product: null as null | { id: number; inventory: number; status: string; price: string },
  existingItem: null as null | { id: number; quantity: number; session_id: number; product_id: number },
  inserted: [] as unknown[],
  updated: [] as unknown[],
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => ({ value: "session-token" }),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: null })),
}));

vi.mock("~/server/db", () => {
  const chainEnd = async () => undefined;
  return {
    db: {
      query: {
        shopping_session: {
          findFirst: vi.fn(async () => ({
            id: 7,
            session_token: "session-token",
            total: "0",
            expires_at: new Date(Date.now() + 1000 * 60),
          })),
        },
        product: {
          findFirst: vi.fn(async () => state.product),
        },
        cart_item: {
          findFirst: vi.fn(async () => state.existingItem),
          findMany: vi.fn(async () => []),
        },
      },
      update: vi.fn(() => ({
        set: vi.fn((values: unknown) => {
          state.updated.push(values);
          return { where: chainEnd };
        }),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async (values: unknown) => {
          state.inserted.push(values);
        }),
      })),
      delete: vi.fn(() => ({ where: chainEnd })),
    },
  };
});

import { addToCart, getAvailableInventory, updateCartItemQuantity } from "~/server/cart-actions";

beforeEach(() => {
  state.product = { id: 1, inventory: 3, status: "active", price: "10.00" };
  state.existingItem = null;
  state.inserted = [];
  state.updated = [];
});

describe("getAvailableInventory", () => {
  it("returns the product's inventory for active products", async () => {
    expect(await getAvailableInventory(1)).toBe(3);
  });

  it("returns 0 for sold_out and hidden products regardless of inventory", async () => {
    state.product = { id: 1, inventory: 5, status: "sold_out", price: "10.00" };
    expect(await getAvailableInventory(1)).toBe(0);
    state.product = { id: 1, inventory: 5, status: "hidden", price: "10.00" };
    expect(await getAvailableInventory(1)).toBe(0);
  });

  it("returns 0 for unknown products and never goes negative", async () => {
    state.product = null;
    expect(await getAvailableInventory(999)).toBe(0);
    state.product = { id: 1, inventory: -2, status: "active", price: "10.00" };
    expect(await getAvailableInventory(1)).toBe(0);
  });
});

describe("addToCart", () => {
  it("adds within stock", async () => {
    await expect(addToCart(1, 2)).resolves.toEqual({ success: true });
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0]).toMatchObject({ session_id: 7, product_id: 1, quantity: 2 });
  });

  it("rejects non-active products even with inventory", async () => {
    state.product = { id: 1, inventory: 5, status: "sold_out", price: "10.00" };
    await expect(addToCart(1, 1)).rejects.toThrow("no longer available");
    state.product = { id: 1, inventory: 5, status: "hidden", price: "10.00" };
    await expect(addToCart(1, 1)).rejects.toThrow("no longer available");
    expect(state.inserted).toHaveLength(0);
  });

  it("rejects quantities beyond stock, counting what is already in the cart", async () => {
    state.existingItem = { id: 11, quantity: 2, session_id: 7, product_id: 1 };
    await expect(addToCart(1, 2)).rejects.toThrow("Only 1 more available");
    state.existingItem = { id: 11, quantity: 3, session_id: 7, product_id: 1 };
    await expect(addToCart(1, 1)).rejects.toThrow("No more available");
  });

  it("rejects zero stock and invalid quantities", async () => {
    state.product = { id: 1, inventory: 0, status: "active", price: "10.00" };
    await expect(addToCart(1, 1)).rejects.toThrow("no longer available");
    state.product = { id: 1, inventory: 3, status: "active", price: "10.00" };
    await expect(addToCart(1, 0)).rejects.toThrow("Invalid quantity");
    await expect(addToCart(1, 1.5)).rejects.toThrow("Invalid quantity");
  });

  it("increments an existing line instead of inserting a duplicate", async () => {
    state.existingItem = { id: 11, quantity: 1, session_id: 7, product_id: 1 };
    await expect(addToCart(1, 2)).resolves.toEqual({ success: true });
    expect(state.inserted).toHaveLength(0);
    expect(state.updated).toContainEqual({ quantity: 3 });
  });
});

describe("updateCartItemQuantity", () => {
  it("caps the quantity at the product's inventory", async () => {
    state.existingItem = { id: 11, quantity: 1, session_id: 7, product_id: 1 };
    await expect(updateCartItemQuantity(11, 4)).rejects.toThrow("Only 3 available");
    await expect(updateCartItemQuantity(11, 3)).resolves.toEqual({ success: true });
  });

  it("refuses to raise the quantity of a non-active product", async () => {
    state.existingItem = { id: 11, quantity: 1, session_id: 7, product_id: 1 };
    state.product = { id: 1, inventory: 3, status: "sold_out", price: "10.00" };
    await expect(updateCartItemQuantity(11, 2)).rejects.toThrow("no longer available");
  });
});

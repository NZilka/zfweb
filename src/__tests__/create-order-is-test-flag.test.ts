/**
 * Tests for the is_test flag on createOrderFromPayment.
 * Verifies that the default call path (webhook) inserts is_test=false,
 * while the test mode call path passes is_test=true via options.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

// Capture values passed to the order insert so we can assert is_test
const orderInsertValues: Record<string, unknown>[] = [];

vi.mock("~/server/db", () => {
  // Return `Promise.resolve([{ id: 1 }])` from the final chain step so the
  // function gets back a non-empty array and continues
  return {
    db: {
      query: {
        shopping_session: {
          findFirst: vi.fn(() =>
            Promise.resolve({ id: 1, session_token: "sess_abc" }),
          ),
        },
        cart_item: {
          findMany: vi.fn(() =>
            Promise.resolve([{ product_id: 1, quantity: 1 }]),
          ),
        },
        product: {
          findFirst: vi.fn(() =>
            Promise.resolve({
              id: 1,
              title: "Test Product",
              price: "10.00",
            }),
          ),
        },
      },
      insert: vi.fn(() => ({
        values: vi.fn((vals: Record<string, unknown>) => {
          orderInsertValues.push(vals);
          return {
            returning: vi.fn(() =>
              Promise.resolve([{ id: 1, is_test: vals.is_test ?? false }]),
            ),
          };
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
      })),
      delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
    },
  };
});

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn(),
    sql: actual.sql,
  };
});

// Import after mocks
import { createOrderFromPayment } from "~/server/order-actions";

// Helper to build a minimal PaymentIntent with required metadata
const makePI = (id: string): Stripe.PaymentIntent =>
  ({
    id,
    amount: 1000,
    metadata: {
      customerEmail: "buyer@example.com",
      customerName: "Buyer One",
      shippingAddress: "{}",
      cartSessionToken: "sess_abc",
      isGift: "false",
    },
  }) as unknown as Stripe.PaymentIntent;

describe("createOrderFromPayment is_test flag", () => {
  beforeEach(() => {
    orderInsertValues.length = 0;
    vi.clearAllMocks();
  });

  it("inserts is_test=false when options are omitted (webhook path)", async () => {
    await createOrderFromPayment(makePI("pi_real_123"));
    expect(orderInsertValues[0]?.is_test).toBe(false);
  });

  it("inserts is_test=false when options.isTest is explicitly false", async () => {
    await createOrderFromPayment(makePI("pi_real_456"), { isTest: false });
    expect(orderInsertValues[0]?.is_test).toBe(false);
  });

  it("inserts is_test=true when options.isTest is true (test mode path)", async () => {
    await createOrderFromPayment(makePI("pi_test_abc"), { isTest: true });
    expect(orderInsertValues[0]?.is_test).toBe(true);
  });

  it("preserves the synthetic payment_intent_id prefix in the insert", async () => {
    // The test path passes pi_test_ prefixed IDs — verify they flow through
    await createOrderFromPayment(makePI("pi_test_xyz"), { isTest: true });
    expect(orderInsertValues[0]?.payment_intent_id).toBe("pi_test_xyz");
  });
});

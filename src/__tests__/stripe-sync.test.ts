// Tests for Stripe sync utilities
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock data stores using vi.hoisted
const { mockKvStore, mockPaymentIntents, mockOrders } = vi.hoisted(() => ({
  mockKvStore: new Map<string, unknown>(),
  mockPaymentIntents: new Map<string, any>(),
  mockOrders: new Map<string, any>(),
}));

// Mock KV module
vi.mock("~/server/kv", () => ({
  isKvConfigured: vi.fn(() => true),
  setPaymentStateCache: vi.fn(async (customerId: string, state: unknown) => {
    mockKvStore.set(`stripe:customer:${customerId}`, state);
  }),
  setOrderStateCache: vi.fn(async (paymentIntentId: string, state: unknown) => {
    mockKvStore.set(`order:payment:${paymentIntentId}`, state);
  }),
  getStripeCustomerForUser: vi.fn(async (clerkUserId: string) => {
    return mockKvStore.get(`stripe:user:${clerkUserId}`) ?? null;
  }),
  getStripeCustomerForSession: vi.fn(async (sessionToken: string) => {
    return mockKvStore.get(`stripe:session:${sessionToken}`) ?? null;
  }),
}));

// Mock Stripe
vi.mock("stripe", () => {
  return {
    default: class MockStripe {
      paymentIntents = {
        list: vi.fn(async ({ customer }: { customer: string }) => {
          const intents: any[] = [];
          for (const [, pi] of mockPaymentIntents) {
            if (pi.customer === customer) {
              intents.push(pi);
            }
          }
          // Sort by created descending, return most recent
          intents.sort((a, b) => b.created - a.created);
          return { data: intents.slice(0, 1) };
        }),
        retrieve: vi.fn(async (id: string) => {
          return mockPaymentIntents.get(id) ?? null;
        }),
      };
    },
  };
});

// Mock order actions
vi.mock("~/server/order-actions", () => ({
  getOrderByPaymentIntent: vi.fn(async (paymentIntentId: string) => {
    return mockOrders.get(paymentIntentId) ?? null;
  }),
}));

// Mock env
vi.mock("~/env", () => ({
  env: {
    STRIPE_SECRET_KEY: "sk_test_mock",
    UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "test-token",
  },
}));

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock drizzle-orm
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return { ...actual };
});

// Import after mocks
import {
  syncPaymentStateToKV,
  syncPaymentStateByPaymentIntent,
  syncOrderStateToKV,
  syncPaymentStateForUser,
  syncPaymentStateForSession,
} from "~/server/stripe-sync";

describe("Stripe Sync Utilities", () => {
  beforeEach(() => {
    mockKvStore.clear();
    mockPaymentIntents.clear();
    mockOrders.clear();
    vi.clearAllMocks();
  });

  describe("syncPaymentStateToKV", () => {
    it("should sync empty state when no payment intents exist", async () => {
      const result = await syncPaymentStateToKV("cus_no_payments");

      expect(result).not.toBeNull();
      expect(result?.lastPaymentIntentId).toBeNull();
      expect(result?.lastPaymentStatus).toBeNull();
      expect(result?.lastOrderId).toBeNull();
      expect(result?.updatedAt).toBeGreaterThan(0);
    });

    it("should sync succeeded payment state", async () => {
      // Set up mock payment intent
      mockPaymentIntents.set("pi_success", {
        id: "pi_success",
        customer: "cus_with_payment",
        status: "succeeded",
        created: Date.now(),
        payment_method: {
          card: {
            brand: "visa",
            last4: "4242",
          },
        },
      });

      // Set up mock order
      mockOrders.set("pi_success", {
        id: 123,
        status: "paid",
        total: "99.99",
      });

      const result = await syncPaymentStateToKV("cus_with_payment");

      expect(result).not.toBeNull();
      expect(result?.lastPaymentIntentId).toBe("pi_success");
      expect(result?.lastPaymentStatus).toBe("succeeded");
      expect(result?.lastOrderId).toBe(123);
      expect(result?.paymentMethod?.brand).toBe("visa");
      expect(result?.paymentMethod?.last4).toBe("4242");
    });

    it("should sync processing payment state", async () => {
      mockPaymentIntents.set("pi_processing", {
        id: "pi_processing",
        customer: "cus_processing",
        status: "processing",
        created: Date.now(),
        payment_method: null,
      });

      const result = await syncPaymentStateToKV("cus_processing");

      expect(result?.lastPaymentStatus).toBe("processing");
      expect(result?.lastOrderId).toBeNull(); // No order for non-succeeded
    });

    it("should sync failed payment state", async () => {
      mockPaymentIntents.set("pi_failed", {
        id: "pi_failed",
        customer: "cus_failed",
        status: "canceled",
        created: Date.now(),
        payment_method: null,
      });

      const result = await syncPaymentStateToKV("cus_failed");

      expect(result?.lastPaymentStatus).toBe("failed");
    });
  });

  describe("syncPaymentStateByPaymentIntent", () => {
    it("should sync state using payment intent ID", async () => {
      mockPaymentIntents.set("pi_lookup", {
        id: "pi_lookup",
        customer: "cus_from_pi",
        status: "succeeded",
        created: Date.now(),
        payment_method: null,
      });

      const result = await syncPaymentStateByPaymentIntent("pi_lookup");

      expect(result).not.toBeNull();
      expect(result?.lastPaymentIntentId).toBe("pi_lookup");
    });

    it("should return null if payment intent has no customer", async () => {
      mockPaymentIntents.set("pi_no_customer", {
        id: "pi_no_customer",
        customer: null,
        status: "succeeded",
        created: Date.now(),
      });

      const result = await syncPaymentStateByPaymentIntent("pi_no_customer");

      expect(result).toBeNull();
    });
  });

  describe("syncOrderStateToKV", () => {
    it("should cache order state", async () => {
      const order = { id: 456, status: "paid", total: "149.99" };

      const result = await syncOrderStateToKV(
        "pi_order",
        order,
        3,
        "cus_order"
      );

      expect(result.orderId).toBe(456);
      expect(result.status).toBe("paid");
      expect(result.total).toBe("149.99");
      expect(result.itemCount).toBe(3);
      expect(result.customerId).toBe("cus_order");

      // Verify it was cached
      const cached = mockKvStore.get("order:payment:pi_order");
      expect(cached).toEqual(result);
    });
  });

  describe("syncPaymentStateForUser", () => {
    it("should sync state for authenticated user", async () => {
      // Set up user -> customer mapping
      mockKvStore.set("stripe:user:user_123", "cus_user_123");

      // Set up payment intent for customer
      mockPaymentIntents.set("pi_user", {
        id: "pi_user",
        customer: "cus_user_123",
        status: "succeeded",
        created: Date.now(),
        payment_method: null,
      });

      const result = await syncPaymentStateForUser("user_123");

      expect(result).not.toBeNull();
      expect(result?.lastPaymentIntentId).toBe("pi_user");
    });

    it("should return null if user has no Stripe customer", async () => {
      const result = await syncPaymentStateForUser("user_no_customer");

      expect(result).toBeNull();
    });
  });

  describe("syncPaymentStateForSession", () => {
    it("should sync state for guest session", async () => {
      // Set up session -> customer mapping
      mockKvStore.set("stripe:session:sess_guest", "cus_guest");

      // Set up payment intent for customer
      mockPaymentIntents.set("pi_guest", {
        id: "pi_guest",
        customer: "cus_guest",
        status: "succeeded",
        created: Date.now(),
        payment_method: null,
      });

      const result = await syncPaymentStateForSession("sess_guest");

      expect(result).not.toBeNull();
      expect(result?.lastPaymentIntentId).toBe("pi_guest");
    });

    it("should return null if session has no Stripe customer", async () => {
      const result = await syncPaymentStateForSession("sess_no_customer");

      expect(result).toBeNull();
    });
  });
});

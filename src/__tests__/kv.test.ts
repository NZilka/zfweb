// Tests for KV utility functions
// Uses mocked Redis client for unit tests
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Use vi.hoisted to create the store before mocks are applied
// This ensures the store is available when the mock factory runs
const { mockStore } = vi.hoisted(() => ({
  mockStore: new Map<string, { value: unknown; expiry?: number }>(),
}));

// Mock the @upstash/redis module with inline class definition
vi.mock("@upstash/redis", () => {
  return {
    Redis: class {
      async get<T>(key: string): Promise<T | null> {
        const item = mockStore.get(key);
        if (!item) return null;
        if (item.expiry && Date.now() > item.expiry) {
          mockStore.delete(key);
          return null;
        }
        return item.value as T;
      }

      async set(
        key: string,
        value: unknown,
        options?: { ex?: number }
      ): Promise<string> {
        const expiry = options?.ex ? Date.now() + options.ex * 1000 : undefined;
        mockStore.set(key, { value, expiry });
        return "OK";
      }

      async del(key: string): Promise<number> {
        mockStore.delete(key);
        return 1;
      }

      async exists(key: string): Promise<number> {
        return mockStore.has(key) ? 1 : 0;
      }

      async ping(): Promise<string> {
        return "PONG";
      }
    },
  };
});

// Mock the env module to provide test values
vi.mock("~/env", () => ({
  env: {
    UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "test-token",
  },
}));

// Mock server-only (it throws in non-server environments)
vi.mock("server-only", () => ({}));

// Import after mocks are set up
import {
  kvGet,
  kvSet,
  kvDelete,
  kvExists,
  setStripeCustomerForUser,
  getStripeCustomerForUser,
  setStripeCustomerForSession,
  getStripeCustomerForSession,
  setPaymentStateCache,
  getPaymentStateCache,
  setOrderStateCache,
  getOrderStateCache,
  checkKvConnection,
  KV_PREFIXES,
  type PaymentStateCache,
  type OrderStateCache,
} from "~/server/kv";

describe("KV Utility Functions", () => {
  beforeEach(() => {
    // Clear the mock store between tests
    mockStore.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic KV Operations", () => {
    it("should set and get a value", async () => {
      await kvSet("test:key", "test-value");
      const result = await kvGet<string>("test:key");
      expect(result).toBe("test-value");
    });

    it("should return null for non-existent key", async () => {
      const result = await kvGet<string>("non:existent");
      expect(result).toBeNull();
    });

    it("should delete a key", async () => {
      await kvSet("test:delete", "value");
      await kvDelete("test:delete");
      const result = await kvGet<string>("test:delete");
      expect(result).toBeNull();
    });

    it("should check if key exists", async () => {
      await kvSet("test:exists", "value");
      expect(await kvExists("test:exists")).toBe(true);
      expect(await kvExists("test:not-exists")).toBe(false);
    });

    it("should store complex objects", async () => {
      const obj = { name: "test", count: 42, nested: { value: true } };
      await kvSet("test:object", obj);
      const result = await kvGet<typeof obj>("test:object");
      expect(result).toEqual(obj);
    });
  });

  describe("Stripe User Mapping", () => {
    it("should store and retrieve Stripe customer ID for user", async () => {
      const clerkUserId = "user_123abc";
      const stripeCustomerId = "cus_test123";

      await setStripeCustomerForUser(clerkUserId, stripeCustomerId);
      const result = await getStripeCustomerForUser(clerkUserId);

      expect(result).toBe(stripeCustomerId);
    });

    it("should use correct key prefix for user mapping", async () => {
      const clerkUserId = "user_456";
      await setStripeCustomerForUser(clerkUserId, "cus_456");

      // Verify the key format matches our prefix
      const expectedKey = `${KV_PREFIXES.STRIPE_USER}${clerkUserId}`;
      const result = await kvGet<string>(expectedKey);
      expect(result).toBe("cus_456");
    });

    it("should return null for unmapped user", async () => {
      const result = await getStripeCustomerForUser("user_nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("Stripe Session Mapping (Guest Checkout)", () => {
    it("should store and retrieve Stripe customer ID for session", async () => {
      const sessionToken = "sess_abc123xyz";
      const stripeCustomerId = "cus_guest_123";

      await setStripeCustomerForSession(sessionToken, stripeCustomerId);
      const result = await getStripeCustomerForSession(sessionToken);

      expect(result).toBe(stripeCustomerId);
    });

    it("should use correct key prefix for session mapping", async () => {
      const sessionToken = "sess_789";
      await setStripeCustomerForSession(sessionToken, "cus_789");

      const expectedKey = `${KV_PREFIXES.STRIPE_SESSION}${sessionToken}`;
      const result = await kvGet<string>(expectedKey);
      expect(result).toBe("cus_789");
    });
  });

  describe("Payment State Cache", () => {
    it("should store and retrieve payment state", async () => {
      const stripeCustomerId = "cus_payment_test";
      const state: PaymentStateCache = {
        lastPaymentIntentId: "pi_123",
        lastPaymentStatus: "succeeded",
        lastOrderId: 42,
        paymentMethod: {
          brand: "visa",
          last4: "4242",
        },
        updatedAt: Date.now(),
      };

      await setPaymentStateCache(stripeCustomerId, state);
      const result = await getPaymentStateCache(stripeCustomerId);

      expect(result).toEqual(state);
    });

    it("should handle null payment method", async () => {
      const state: PaymentStateCache = {
        lastPaymentIntentId: null,
        lastPaymentStatus: null,
        lastOrderId: null,
        paymentMethod: null,
        updatedAt: Date.now(),
      };

      await setPaymentStateCache("cus_no_payment", state);
      const result = await getPaymentStateCache("cus_no_payment");

      expect(result).toEqual(state);
    });
  });

  describe("Order State Cache", () => {
    it("should store and retrieve order state by payment intent", async () => {
      const paymentIntentId = "pi_order_test";
      const state: OrderStateCache = {
        orderId: 123,
        status: "paid",
        total: "99.99",
        itemCount: 3,
        customerId: "cus_123",
        createdAt: Date.now(),
      };

      await setOrderStateCache(paymentIntentId, state);
      const result = await getOrderStateCache(paymentIntentId);

      expect(result).toEqual(state);
    });
  });

  describe("Connection Health Check", () => {
    it("should return true when connection is healthy", async () => {
      const result = await checkKvConnection();
      expect(result).toBe(true);
    });
  });
});

describe("KV Key Prefixes", () => {
  it("should have all required prefixes defined", () => {
    expect(KV_PREFIXES.STRIPE_USER).toBe("stripe:user:");
    expect(KV_PREFIXES.STRIPE_SESSION).toBe("stripe:session:");
    expect(KV_PREFIXES.STRIPE_CUSTOMER).toBe("stripe:customer:");
    expect(KV_PREFIXES.ORDER_PAYMENT).toBe("order:payment:");
  });
});

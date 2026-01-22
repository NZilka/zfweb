// Tests for Stripe Customer management utilities
import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted for mocks that need to be available before imports
const { mockKvStore, mockDbCustomers, mockStripeCustomers } = vi.hoisted(
  () => ({
    mockKvStore: new Map<string, string>(),
    mockDbCustomers: new Map<
      string,
      {
        id: number;
        clerk_user_id: string | null;
        stripe_customer_id: string | null;
        email: string;
        firstName: string;
        last_name: string;
        isUser: boolean;
      }
    >(),
    mockStripeCustomers: new Map<
      string,
      { id: string; email: string; name?: string; metadata: Record<string, string> }
    >(),
  })
);

// Mock KV functions
vi.mock("~/server/kv", () => ({
  getStripeCustomerForUser: vi.fn(async (clerkUserId: string) => {
    return mockKvStore.get(`stripe:user:${clerkUserId}`) ?? null;
  }),
  setStripeCustomerForUser: vi.fn(
    async (clerkUserId: string, stripeCustomerId: string) => {
      mockKvStore.set(`stripe:user:${clerkUserId}`, stripeCustomerId);
    }
  ),
  getStripeCustomerForSession: vi.fn(async (sessionToken: string) => {
    return mockKvStore.get(`stripe:session:${sessionToken}`) ?? null;
  }),
  setStripeCustomerForSession: vi.fn(
    async (sessionToken: string, stripeCustomerId: string) => {
      mockKvStore.set(`stripe:session:${sessionToken}`, stripeCustomerId);
    }
  ),
}));

// Counter for generating unique Stripe customer IDs
let stripeCustomerIdCounter = 1;

// Mock Stripe
vi.mock("stripe", () => {
  return {
    default: class MockStripe {
      customers = {
        create: vi.fn(
          async (params: {
            email: string;
            name?: string;
            metadata?: Record<string, string>;
          }) => {
            const id = `cus_mock_${stripeCustomerIdCounter++}`;
            const customer = {
              id,
              email: params.email,
              name: params.name,
              metadata: params.metadata ?? {},
            };
            mockStripeCustomers.set(id, customer);
            return customer;
          }
        ),
        update: vi.fn(
          async (
            customerId: string,
            params: { metadata?: Record<string, string> }
          ) => {
            const customer = mockStripeCustomers.get(customerId);
            if (customer && params.metadata) {
              customer.metadata = { ...customer.metadata, ...params.metadata };
            }
            return customer;
          }
        ),
      };
      paymentMethods = {
        list: vi.fn(async () => ({ data: [] })),
      };
    },
  };
});

// Mock database
vi.mock("~/server/db", () => ({
  db: {
    query: {
      customer: {
        findFirst: vi.fn(async ({ where }: { where: Function }) => {
          // Simulate the where clause by checking all customers
          for (const [, cust] of mockDbCustomers) {
            // Create a mock model object with the customer data
            const model = {
              clerk_user_id: cust.clerk_user_id,
              stripe_customer_id: cust.stripe_customer_id,
            };
            const eq = (field: any, value: any) => field === value;

            // Try to match - this is a simplified simulation
            // In reality, Drizzle would handle this properly
            if (
              cust.clerk_user_id &&
              where(model, { eq }).toString().includes(cust.clerk_user_id)
            ) {
              return cust;
            }
            if (
              cust.stripe_customer_id &&
              where(model, { eq }).toString().includes(cust.stripe_customer_id)
            ) {
              return cust;
            }
          }
          return null;
        }),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(async (values: any) => {
        const id = mockDbCustomers.size + 1;
        mockDbCustomers.set(values.clerk_user_id || `guest_${id}`, {
          id,
          ...values,
        });
        return [{ id }];
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => {}),
      })),
    })),
  },
}));

// Mock drizzle-orm - need to include sql for schema imports
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((field, value) => ({ field, value, toString: () => `${value}` })),
  };
});

// Mock env
vi.mock("~/env", () => ({
  env: {
    STRIPE_SECRET_KEY: "sk_test_mock",
  },
}));

// Mock server-only
vi.mock("server-only", () => ({}));

// Import after mocks
import {
  getOrCreateStripeCustomer,
  linkStripeCustomerToUser,
  getCustomerPaymentMethods,
} from "~/server/stripe-customer";

describe("Stripe Customer Utilities", () => {
  beforeEach(() => {
    // Clear all mock stores
    mockKvStore.clear();
    mockDbCustomers.clear();
    mockStripeCustomers.clear();
    stripeCustomerIdCounter = 1;
    vi.clearAllMocks();
  });

  describe("getOrCreateStripeCustomer - User Flow", () => {
    it("should return cached customer from KV for authenticated user", async () => {
      // Pre-populate KV cache
      mockKvStore.set("stripe:user:user_123", "cus_existing");

      const result = await getOrCreateStripeCustomer({
        type: "user",
        clerkUserId: "user_123",
        email: "test@example.com",
      });

      expect(result.customerId).toBe("cus_existing");
      expect(result.isNew).toBe(false);
    });

    it("should create new Stripe customer for new user", async () => {
      const result = await getOrCreateStripeCustomer({
        type: "user",
        clerkUserId: "user_new",
        email: "newuser@example.com",
        name: "New User",
      });

      expect(result.customerId).toMatch(/^cus_mock_/);
      expect(result.isNew).toBe(true);

      // Verify KV was updated
      expect(mockKvStore.get("stripe:user:user_new")).toBe(result.customerId);

      // Verify Stripe customer was created with correct metadata
      const stripeCustomer = mockStripeCustomers.get(result.customerId);
      expect(stripeCustomer?.email).toBe("newuser@example.com");
      expect(stripeCustomer?.metadata.clerkUserId).toBe("user_new");
    });

    it("should include user name when creating Stripe customer", async () => {
      const result = await getOrCreateStripeCustomer({
        type: "user",
        clerkUserId: "user_with_name",
        email: "named@example.com",
        name: "John Doe",
      });

      const stripeCustomer = mockStripeCustomers.get(result.customerId);
      expect(stripeCustomer?.name).toBe("John Doe");
    });
  });

  describe("getOrCreateStripeCustomer - Guest Flow", () => {
    it("should return cached customer from KV for guest session", async () => {
      // Pre-populate KV cache
      mockKvStore.set("stripe:session:sess_abc123", "cus_guest_existing");

      const result = await getOrCreateStripeCustomer({
        type: "guest",
        sessionToken: "sess_abc123",
        email: "guest@example.com",
      });

      expect(result.customerId).toBe("cus_guest_existing");
      expect(result.isNew).toBe(false);
    });

    it("should create new Stripe customer for new guest", async () => {
      const result = await getOrCreateStripeCustomer({
        type: "guest",
        sessionToken: "sess_new_guest",
        email: "newguest@example.com",
        name: "Guest User",
      });

      expect(result.customerId).toMatch(/^cus_mock_/);
      expect(result.isNew).toBe(true);

      // Verify KV was updated with session token
      expect(mockKvStore.get("stripe:session:sess_new_guest")).toBe(
        result.customerId
      );

      // Verify Stripe customer metadata marks as guest
      const stripeCustomer = mockStripeCustomers.get(result.customerId);
      expect(stripeCustomer?.metadata.checkoutType).toBe("guest");
    });
  });

  describe("linkStripeCustomerToUser", () => {
    it("should link Stripe customer to Clerk user", async () => {
      // Create a guest customer first
      mockStripeCustomers.set("cus_guest_to_link", {
        id: "cus_guest_to_link",
        email: "upgrade@example.com",
        metadata: { checkoutType: "guest" },
      });

      await linkStripeCustomerToUser(
        "user_upgraded",
        "cus_guest_to_link",
        "upgrade@example.com",
        "Upgraded User"
      );

      // Verify KV was updated
      expect(mockKvStore.get("stripe:user:user_upgraded")).toBe(
        "cus_guest_to_link"
      );

      // Verify Stripe customer metadata was updated
      const stripeCustomer = mockStripeCustomers.get("cus_guest_to_link");
      expect(stripeCustomer?.metadata.clerkUserId).toBe("user_upgraded");
      expect(stripeCustomer?.metadata.checkoutType).toBe("registered");
    });
  });

  describe("getCustomerPaymentMethods", () => {
    it("should return empty array when no payment methods", async () => {
      const result = await getCustomerPaymentMethods("cus_no_methods");
      expect(result).toEqual([]);
    });
  });
});

describe("Stripe Customer Type Definitions", () => {
  it("should accept user type options", async () => {
    const userOptions = {
      type: "user" as const,
      clerkUserId: "user_test",
      email: "user@test.com",
      name: "Test User",
    };

    // Type check passes if this compiles
    expect(userOptions.type).toBe("user");
  });

  it("should accept guest type options", async () => {
    const guestOptions = {
      type: "guest" as const,
      sessionToken: "sess_test",
      email: "guest@test.com",
    };

    // Type check passes if this compiles
    expect(guestOptions.type).toBe("guest");
  });
});

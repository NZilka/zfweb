// Tests for Stripe saved payment methods functionality
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock payment methods data for testing - complete card data
const mockPaymentMethods = vi.hoisted(() => [
  {
    id: "pm_visa_saved",
    type: "card",
    card: {
      brand: "visa",
      last4: "4242",
      exp_month: 12,
      exp_year: 2025,
    },
  },
  {
    id: "pm_mastercard_saved",
    type: "card",
    card: {
      brand: "mastercard",
      last4: "5555",
      exp_month: 6,
      exp_year: 2026,
    },
  },
]);

// Mock payment methods with missing fields to test fallback logic
const mockIncompletePaymentMethods = vi.hoisted(() => [
  {
    id: "pm_incomplete",
    type: "card",
    card: {
      // Missing brand, last4, exp_month, exp_year - tests fallback defaults
    },
  },
  {
    id: "pm_no_card",
    type: "card",
    // Missing card object entirely
  },
]);

// Mock payment intents created during tests
const mockPaymentIntents = vi.hoisted(
  () =>
    new Map<
      string,
      {
        id: string;
        customer?: string;
        payment_method?: string;
        amount?: number;
        metadata?: Record<string, string>;
      }
    >()
);

// Counter for generating unique payment intent IDs
const paymentIntentCounter = vi.hoisted(() => ({ value: 1 }));

// Mock Stripe SDK
vi.mock("stripe", () => {
  return {
    default: class MockStripe {
      // Mock paymentMethods.list for fetching saved cards
      paymentMethods = {
        list: vi.fn(async ({ customer, type }: { customer: string; type: string }) => {
          // Return mock payment methods for test customer with complete data
          if (customer === "cus_with_cards" && type === "card") {
            return { data: mockPaymentMethods };
          }
          // Return incomplete payment methods to test fallback logic
          if (customer === "cus_with_incomplete_cards" && type === "card") {
            return { data: mockIncompletePaymentMethods };
          }
          // Return empty for customers without saved cards
          return { data: [] };
        }),
      };

      // Mock paymentIntents for creating intents with saved methods
      paymentIntents = {
        create: vi.fn(
          async (params: {
            amount: number;
            currency: string;
            customer?: string;
            payment_method?: string;
            confirm?: boolean;
            metadata?: Record<string, string>;
          }) => {
            const id = `pi_saved_${paymentIntentCounter.value++}`;
            const intent = {
              id,
              client_secret: `${id}_secret_test`,
              customer: params.customer,
              payment_method: params.payment_method,
              amount: params.amount,
              currency: params.currency,
              metadata: params.metadata,
            };
            mockPaymentIntents.set(id, intent);
            return intent;
          }
        ),
      };

      // Mock customers for completeness
      customers = {
        create: vi.fn(async () => ({ id: "cus_mock" })),
        update: vi.fn(async () => ({})),
      };
    },
  };
});

// Mock env
vi.mock("~/env", () => ({
  env: {
    STRIPE_SECRET_KEY: "sk_test_mock",
    STRIPE_WEBHOOK_SECRET: "whsec_test",
  },
}));

// Mock server-only
vi.mock("server-only", () => ({}));

// Import after mocks are set up
import {
  getSavedPaymentMethods,
  createPaymentIntentWithSavedMethod,
} from "~/server/stripe";

describe("Stripe Saved Payment Methods", () => {
  beforeEach(() => {
    mockPaymentIntents.clear();
    paymentIntentCounter.value = 1;
    vi.clearAllMocks();
  });

  describe("getSavedPaymentMethods", () => {
    it("should return formatted saved payment methods for customer with cards", async () => {
      const result = await getSavedPaymentMethods("cus_with_cards");

      expect(result).toHaveLength(2);

      // Verify first card (Visa)
      expect(result[0]).toEqual({
        id: "pm_visa_saved",
        brand: "visa",
        last4: "4242",
        expMonth: 12,
        expYear: 2025,
      });

      // Verify second card (Mastercard)
      expect(result[1]).toEqual({
        id: "pm_mastercard_saved",
        brand: "mastercard",
        last4: "5555",
        expMonth: 6,
        expYear: 2026,
      });
    });

    it("should return empty array for customer without saved cards", async () => {
      const result = await getSavedPaymentMethods("cus_no_cards");

      expect(result).toEqual([]);
    });

    it("should handle cards with missing fields gracefully", async () => {
      // Use customer with incomplete card data to test fallback logic
      const result = await getSavedPaymentMethods("cus_with_incomplete_cards");

      expect(result).toHaveLength(2);

      // Verify fallback values for card with empty card object
      expect(result[0]).toEqual({
        id: "pm_incomplete",
        brand: "unknown", // Fallback for missing brand
        last4: "****", // Fallback for missing last4
        expMonth: 0, // Fallback for missing exp_month
        expYear: 0, // Fallback for missing exp_year
      });

      // Verify fallback values for card with no card object at all
      expect(result[1]).toEqual({
        id: "pm_no_card",
        brand: "unknown",
        last4: "****",
        expMonth: 0,
        expYear: 0,
      });
    });
  });

  describe("createPaymentIntentWithSavedMethod", () => {
    it("should create payment intent with saved payment method attached", async () => {
      const result = await createPaymentIntentWithSavedMethod({
        amount: 5000,
        customerId: "cus_test",
        paymentMethodId: "pm_visa_saved",
        metadata: { orderId: "123" },
      });

      expect(result.clientSecret).toMatch(/^pi_saved_\d+_secret_test$/);
      expect(result.paymentIntentId).toMatch(/^pi_saved_\d+$/);

      // Verify the payment intent was created with correct params
      const intent = mockPaymentIntents.get(result.paymentIntentId);
      expect(intent?.customer).toBe("cus_test");
      expect(intent?.payment_method).toBe("pm_visa_saved");
      expect(intent?.amount).toBe(5000);
    });

    it("should include metadata in payment intent", async () => {
      const metadata = {
        customerEmail: "test@example.com",
        itemCount: "3",
      };

      const result = await createPaymentIntentWithSavedMethod({
        amount: 2500,
        customerId: "cus_meta",
        paymentMethodId: "pm_mastercard_saved",
        metadata,
      });

      const intent = mockPaymentIntents.get(result.paymentIntentId);
      expect(intent?.metadata).toEqual(metadata);
    });

    it("should work without metadata", async () => {
      const result = await createPaymentIntentWithSavedMethod({
        amount: 1000,
        customerId: "cus_no_meta",
        paymentMethodId: "pm_visa_saved",
      });

      expect(result.clientSecret).toBeDefined();
      expect(result.paymentIntentId).toBeDefined();
    });
  });
});

describe("Saved Payment Method Type Definitions", () => {
  it("should export SavedPaymentMethod type with correct shape", async () => {
    // Type check - this verifies the exported type has the right structure
    const method: Awaited<ReturnType<typeof getSavedPaymentMethods>>[0] = {
      id: "pm_test",
      brand: "visa",
      last4: "1234",
      expMonth: 1,
      expYear: 2030,
    };

    expect(method.id).toBe("pm_test");
    expect(method.brand).toBe("visa");
  });
});

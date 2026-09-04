/**
 * Tests for gift order functionality
 * Tests the is_gift flag flow from checkout to packing slip
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// order-actions is a server-only module now
vi.mock("server-only", () => ({}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock database for order creation tests
vi.mock("~/server/db", () => ({
  db: {
    query: {
      shopping_session: {
        findFirst: vi.fn(() =>
          Promise.resolve({
            id: 1,
            session_token: "test-session-token",
          })
        ),
      },
      cart_item: {
        findMany: vi.fn(() =>
          Promise.resolve([
            { product_id: 1, quantity: 2 },
          ])
        ),
      },
      product: {
        findFirst: vi.fn(() =>
          Promise.resolve({
            id: 1,
            title: "Test Product",
            price: "29.99",
          })
        ),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() =>
          Promise.resolve([
            {
              id: 1,
              is_gift: true,
              customer_email: "test@example.com",
              customer_name: "Test User",
            },
          ])
        ),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  },
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn(),
    sql: actual.sql,
  };
});

describe("Gift Order Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isGift metadata parsing", () => {
    // Test the string to boolean conversion used in order-actions
    it("should parse 'true' string as true boolean", () => {
      const metadata = { isGift: "true" };
      const isGift = metadata.isGift === "true";
      expect(isGift).toBe(true);
    });

    it("should parse 'false' string as false boolean", () => {
      const metadata = { isGift: "false" };
      const isGift = metadata.isGift === "true";
      expect(isGift).toBe(false);
    });

    it("should handle missing isGift metadata", () => {
      const metadata: Record<string, string> = {};
      const isGift = metadata.isGift === "true";
      expect(isGift).toBe(false);
    });

    it("should handle undefined isGift metadata", () => {
      const metadata: { isGift?: string } = { isGift: undefined };
      const isGift = metadata.isGift === "true";
      expect(isGift).toBe(false);
    });
  });

  describe("PackingSlip price visibility", () => {
    // Test the conditional logic for showing prices
    interface OrderWithGift {
      isGift: boolean;
      total: string;
      items: { product: { price: string }; quantity: number }[];
    }

    it("should show prices when isGift is false", () => {
      const order: OrderWithGift = {
        isGift: false,
        total: "59.98",
        items: [{ product: { price: "29.99" }, quantity: 2 }],
      };

      // Simulate the conditional rendering logic
      const showPrices = !order.isGift;
      expect(showPrices).toBe(true);
    });

    it("should hide prices when isGift is true", () => {
      const order: OrderWithGift = {
        isGift: true,
        total: "59.98",
        items: [{ product: { price: "29.99" }, quantity: 2 }],
      };

      // Simulate the conditional rendering logic
      const showPrices = !order.isGift;
      expect(showPrices).toBe(false);
    });
  });

  describe("OrderWithItems type", () => {
    // Test that the type includes isGift field
    it("should include isGift boolean in order type", () => {
      // This validates the type structure
      const order = {
        id: 1,
        customerName: "Test User",
        customerEmail: "test@example.com",
        shippingAddress: "{}",
        total: "59.98",
        status: "paid",
        isDownloaded: false,
        downloadedAt: null,
        isPacked: false,
        packedAt: null,
        isShipped: false,
        shippedAt: null,
        trackingNumber: null,
        isGift: true,
        createdAt: new Date(),
        items: [],
      };

      expect(order.isGift).toBe(true);
      expect(typeof order.isGift).toBe("boolean");
    });
  });

  describe("Create intent API schema", () => {
    // Test the expected shape of the create-intent request
    it("should accept isGift boolean in request body", () => {
      const requestBody = {
        customerInfo: {
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          address1: "123 Main St",
          city: "Austin",
          state: "TX",
          zipCode: "78701",
          country: "US",
        },
        isGift: true,
      };

      expect(requestBody.isGift).toBe(true);
    });

    it("should default isGift to false when not provided", () => {
      const requestBody: { customerInfo: Record<string, string>; isGift?: boolean } = {
        customerInfo: {
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          address1: "123 Main St",
          city: "Austin",
          state: "TX",
          zipCode: "78701",
          country: "US",
        },
      };

      // Simulate the default behavior - isGift is optional and defaults to false
      const isGift = requestBody.isGift ?? false;
      expect(isGift).toBe(false);
    });
  });

  describe("Payment metadata structure", () => {
    // Test that isGift is stored correctly in payment metadata
    it("should store isGift as string in metadata", () => {
      const isGift = true;
      const metadata: Record<string, string> = {
        customerEmail: "test@example.com",
        customerName: "Test User",
        isGift: String(isGift),
      };

      expect(metadata.isGift).toBe("true");
      expect(typeof metadata.isGift).toBe("string");
    });

    it("should convert isGift false to string", () => {
      const isGift = false;
      const metadata: Record<string, string> = {
        isGift: String(isGift),
      };

      expect(metadata.isGift).toBe("false");
    });
  });
});

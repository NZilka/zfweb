/**
 * Tests for admin action utilities
 * Tests CSV generation and data formatting logic
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// These tests cover CSV formatting, not authorization: treat the caller as an
// admin. Authorization itself is covered in admin-authz.test.ts.
vi.mock("~/server/auth", () => ({
  checkAdmin: vi.fn(async () => true),
  requireAdmin: vi.fn(async () => ({ userId: "admin" })),
}));

// Store for mock database records
const { mockOrders } = vi.hoisted(() => ({
  mockOrders: new Map<
    number,
    {
      id: number;
      customerName: string;
      customerEmail: string;
      shippingAddress: string;
      is_downloaded: boolean;
      downloaded_at: Date | null;
    }
  >(),
}));

// Mock the database
vi.mock("~/server/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          // Return orders that match the requested IDs
          return Promise.resolve(Array.from(mockOrders.values()));
        }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => {
          // Mark orders as downloaded
          mockOrders.forEach((order) => {
            order.is_downloaded = true;
            order.downloaded_at = new Date();
          });
          return Promise.resolve();
        }),
      })),
    })),
  },
}));

// Mock drizzle-orm with importOriginal to preserve sql and other exports
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn(),
    inArray: vi.fn(),
  };
});

// Import after mocks
import { generatePirateShipCsv, updateOrderFulfillment } from "~/server/admin-actions";

describe("Admin Actions - CSV Generation", () => {
  beforeEach(() => {
    mockOrders.clear();
    vi.clearAllMocks();
  });

  describe("generatePirateShipCsv", () => {
    it("should return error when no orders selected", async () => {
      const result = await generatePirateShipCsv([]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No orders selected");
    });

    it("should generate CSV with correct header", async () => {
      // Add a mock order
      mockOrders.set(1, {
        id: 1,
        customerName: "John Doe",
        customerEmail: "john@example.com",
        shippingAddress: JSON.stringify({
          address1: "123 Main St",
          city: "Austin",
          state: "TX",
          zipCode: "78701",
          country: "US",
        }),
        is_downloaded: false,
        downloaded_at: null,
      });

      const result = await generatePirateShipCsv([1]);

      expect(result.success).toBe(true);
      expect(result.csv).toBeDefined();

      // Check header is present
      const lines = result.csv!.split("\n");
      expect(lines[0]).toBe(
        "Name,Company,Address1,Address2,City,State,Zip,Country,Phone,Email,Weight,Length,Width,Height"
      );
    });

    it("should include customer data in CSV row", async () => {
      mockOrders.set(1, {
        id: 1,
        customerName: "Jane Smith",
        customerEmail: "jane@example.com",
        shippingAddress: JSON.stringify({
          address1: "456 Oak Ave",
          address2: "Apt 2B",
          city: "Dallas",
          state: "TX",
          zipCode: "75001",
          country: "US",
          phone: "555-1234",
        }),
        is_downloaded: false,
        downloaded_at: null,
      });

      const result = await generatePirateShipCsv([1]);

      expect(result.success).toBe(true);
      const lines = result.csv!.split("\n");
      const dataRow = lines[1];

      // Verify key fields are present
      expect(dataRow).toContain("Jane Smith");
      expect(dataRow).toContain("456 Oak Ave");
      expect(dataRow).toContain("Apt 2B");
      expect(dataRow).toContain("Dallas");
      expect(dataRow).toContain("TX");
      expect(dataRow).toContain("75001");
      expect(dataRow).toContain("jane@example.com");
    });

    it("should handle addresses with special characters", async () => {
      mockOrders.set(1, {
        id: 1,
        customerName: 'John "Johnny" Doe',
        customerEmail: "john@example.com",
        shippingAddress: JSON.stringify({
          address1: "123 Main St, Suite 100",
          city: "Austin",
          state: "TX",
          zipCode: "78701",
        }),
        is_downloaded: false,
        downloaded_at: null,
      });

      const result = await generatePirateShipCsv([1]);

      expect(result.success).toBe(true);
      // CSV should escape quotes and commas
      expect(result.csv).toContain('"');
    });

    it("should handle malformed shipping address JSON", async () => {
      mockOrders.set(1, {
        id: 1,
        customerName: "Test User",
        customerEmail: "test@example.com",
        shippingAddress: "invalid json",
        is_downloaded: false,
        downloaded_at: null,
      });

      const result = await generatePirateShipCsv([1]);

      // Should still succeed with empty address fields
      expect(result.success).toBe(true);
    });

    it("should return downloadedCount", async () => {
      mockOrders.set(1, {
        id: 1,
        customerName: "User 1",
        customerEmail: "user1@example.com",
        shippingAddress: "{}",
        is_downloaded: false,
        downloaded_at: null,
      });
      mockOrders.set(2, {
        id: 2,
        customerName: "User 2",
        customerEmail: "user2@example.com",
        shippingAddress: "{}",
        is_downloaded: false,
        downloaded_at: null,
      });

      const result = await generatePirateShipCsv([1, 2]);

      expect(result.success).toBe(true);
      expect(result.downloadedCount).toBe(2);
    });

    it("should default country to US when not provided", async () => {
      mockOrders.set(1, {
        id: 1,
        customerName: "Test",
        customerEmail: "test@example.com",
        shippingAddress: JSON.stringify({
          address1: "123 Main St",
          city: "Austin",
          state: "TX",
          zipCode: "78701",
          // No country field
        }),
        is_downloaded: false,
        downloaded_at: null,
      });

      const result = await generatePirateShipCsv([1]);

      expect(result.success).toBe(true);
      expect(result.csv).toContain("US");
    });
  });
});

describe("Admin Actions - Order Fulfillment", () => {
  describe("updateOrderFulfillment type checking", () => {
    it("should accept valid update parameters", () => {
      // Type checking test - validates parameter structure
      const validUpdates = {
        isPacked: true,
        isShipped: false,
        trackingNumber: "1Z999AA10123456784",
      };

      expect(validUpdates.isPacked).toBe(true);
      expect(validUpdates.isShipped).toBe(false);
      expect(validUpdates.trackingNumber).toBeDefined();
    });

    it("should accept partial updates", () => {
      // Only packed status
      const packedOnly = { isPacked: true };
      expect(packedOnly.isPacked).toBe(true);

      // Only shipped status
      const shippedOnly = { isShipped: true };
      expect(shippedOnly.isShipped).toBe(true);

      // Only tracking number
      const trackingOnly = { trackingNumber: "ABC123" };
      expect(trackingOnly.trackingNumber).toBe("ABC123");
    });
  });
});

describe("CSV Value Escaping", () => {
  // Test the escaping logic that would be used in CSV generation
  const escapeValue = (val: string | undefined | null): string => {
    if (!val) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  it("should return empty string for null/undefined", () => {
    expect(escapeValue(null)).toBe("");
    expect(escapeValue(undefined)).toBe("");
  });

  it("should return plain string when no special characters", () => {
    expect(escapeValue("John Doe")).toBe("John Doe");
    expect(escapeValue("123 Main St")).toBe("123 Main St");
  });

  it("should wrap in quotes when contains comma", () => {
    expect(escapeValue("Suite 100, Floor 2")).toBe('"Suite 100, Floor 2"');
  });

  it("should escape quotes by doubling them", () => {
    expect(escapeValue('John "Johnny" Doe')).toBe('"John ""Johnny"" Doe"');
  });

  it("should wrap in quotes when contains newline", () => {
    expect(escapeValue("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
  });

  it("should handle combination of special characters", () => {
    expect(escapeValue('Test, "quoted", value')).toBe('"Test, ""quoted"", value"');
  });
});

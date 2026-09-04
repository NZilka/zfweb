/**
 * Unit tests for shipping actions
 * Tests CRUD operations for shipping zones and rates
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mock for Clerk auth - must be defined before vi.mock
const { mockAuth } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
}));

// Mock Clerk auth - must be before importing shipping-actions
vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
  // Backend client used by requireAdmin()/isAdminUser(): signed-in test users are admins
  clerkClient: vi.fn(async () => ({
    users: {
      getUser: vi.fn(async () => ({ privateMetadata: { "can-upload": true } })),
    },
  })),
}));

// Mock database module
vi.mock("~/server/db", () => ({
  db: {
    query: {
      shipping_zone: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      shipping_zone_country: {
        findMany: vi.fn(),
      },
      shipping_rate: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { db } from "~/server/db";
import {
  getShippingZones,
  getShippingZoneById,
  createShippingZone,
  updateShippingZone,
  deleteShippingZone,
  createShippingRate,
  updateShippingRate,
  deleteShippingRate,
} from "~/server/shipping-actions";

// Mock data for tests
const mockZones = [
  {
    id: 1,
    name: "United States",
    description: "Continental US",
    is_default: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: null,
  },
  {
    id: 2,
    name: "International",
    description: "Rest of world",
    is_default: false,
    createdAt: new Date("2024-01-02"),
    updatedAt: null,
  },
];

const mockCountries = [
  { id: 1, zone_id: 1, country_code: "US" },
  { id: 2, zone_id: 2, country_code: "CA" },
  { id: 3, zone_id: 2, country_code: "GB" },
];

const mockRates = [
  {
    id: 1,
    zone_id: 1,
    name: "Standard Shipping",
    price_alone: "5.99",
    price_with_others: "2.99",
    delivery_estimate: "5-7 business days",
  },
  {
    id: 2,
    zone_id: 1,
    name: "Express Shipping",
    price_alone: "14.99",
    price_with_others: "9.99",
    delivery_estimate: "2-3 business days",
  },
  {
    id: 3,
    zone_id: 2,
    name: "International Standard",
    price_alone: "24.99",
    price_with_others: "14.99",
    delivery_estimate: "10-14 business days",
  },
];

describe("shipping-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getShippingZones", () => {
    it("returns all zones with their countries and rates", async () => {
      // Setup mocks
      (db.query.shipping_zone.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockZones);
      (db.query.shipping_zone_country.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockCountries);
      (db.query.shipping_rate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockRates);

      const result = await getShippingZones();

      // Verify zone data is properly assembled
      expect(result).toHaveLength(2);

      // Check US zone (id: 1)
      const usZone = result.find((z) => z.id === 1);
      expect(usZone).toBeDefined();
      expect(usZone!.name).toBe("United States");
      expect(usZone!.is_default).toBe(true);
      expect(usZone!.countries).toEqual(["US"]);
      expect(usZone!.rates).toHaveLength(2);

      // Check International zone (id: 2)
      const intlZone = result.find((z) => z.id === 2);
      expect(intlZone).toBeDefined();
      expect(intlZone!.name).toBe("International");
      expect(intlZone!.countries).toEqual(["CA", "GB"]);
      expect(intlZone!.rates).toHaveLength(1);
    });

    it("returns empty array when no zones exist", async () => {
      (db.query.shipping_zone.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (db.query.shipping_zone_country.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (db.query.shipping_rate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await getShippingZones();

      expect(result).toHaveLength(0);
    });

    it("handles zones without countries or rates", async () => {
      (db.query.shipping_zone.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockZones[0]]);
      (db.query.shipping_zone_country.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (db.query.shipping_rate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await getShippingZones();

      expect(result).toHaveLength(1);
      expect(result[0]!.countries).toEqual([]);
      expect(result[0]!.rates).toEqual([]);
    });
  });

  describe("getShippingZoneById", () => {
    it("returns zone with countries and rates", async () => {
      (db.query.shipping_zone.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockZones[0]);
      (db.query.shipping_zone_country.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockCountries[0]]);
      (db.query.shipping_rate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockRates.filter((r) => r.zone_id === 1));

      const result = await getShippingZoneById(1);

      expect(result).not.toBeNull();
      expect(result!.name).toBe("United States");
      expect(result!.countries).toEqual(["US"]);
      expect(result!.rates).toHaveLength(2);
    });

    it("returns null when zone not found", async () => {
      (db.query.shipping_zone.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getShippingZoneById(999);

      expect(result).toBeNull();
    });
  });

  describe("createShippingZone", () => {
    it("returns error when not authenticated", async () => {
      // Mock unauthenticated user
      mockAuth.mockResolvedValue({ userId: null });

      const result = await createShippingZone({
        name: "Test Zone",
        is_default: false,
        countries: ["US"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });

    it("validates required zone name", async () => {
      // Mock authenticated user
      mockAuth.mockResolvedValue({ userId: "user_123" });

      const result = await createShippingZone({
        name: "", // Empty name should fail validation
        is_default: false,
        countries: ["US"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("updateShippingZone", () => {
    it("returns error when not authenticated", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const result = await updateShippingZone(1, {
        name: "Updated Zone",
        is_default: false,
        countries: ["US", "CA"],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });
  });

  describe("deleteShippingZone", () => {
    it("returns error when not authenticated", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const result = await deleteShippingZone(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });

    it("returns error when zone not found", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });
      (db.query.shipping_zone.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await deleteShippingZone(999);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Zone not found");
    });
  });

  describe("createShippingRate", () => {
    it("returns error when not authenticated", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const result = await createShippingRate({
        zone_id: 1,
        name: "Test Rate",
        price_alone: 5.99,
        price_with_others: 2.99,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });

    it("returns error when zone not found", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });
      (db.query.shipping_zone.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await createShippingRate({
        zone_id: 999,
        name: "Test Rate",
        price_alone: 5.99,
        price_with_others: 2.99,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Zone not found");
    });

    it("validates rate name is required", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });

      const result = await createShippingRate({
        zone_id: 1,
        name: "", // Empty name should fail
        price_alone: 5.99,
        price_with_others: 2.99,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("validates price cannot be negative", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });

      const result = await createShippingRate({
        zone_id: 1,
        name: "Test Rate",
        price_alone: -5.99, // Negative price should fail
        price_with_others: 2.99,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("updateShippingRate", () => {
    it("returns error when not authenticated", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const result = await updateShippingRate(1, {
        name: "Updated Rate",
        price_alone: 6.99,
        price_with_others: 3.99,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });

    it("returns error when rate not found", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });
      (db.query.shipping_rate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await updateShippingRate(999, {
        name: "Updated Rate",
        price_alone: 6.99,
        price_with_others: 3.99,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Rate not found");
    });
  });

  describe("deleteShippingRate", () => {
    it("returns error when not authenticated", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const result = await deleteShippingRate(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });

    it("returns error when rate not found", async () => {
      mockAuth.mockResolvedValue({ userId: "user_123" });
      (db.query.shipping_rate.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await deleteShippingRate(999);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Rate not found");
    });
  });
});

/**
 * Unit tests for product filtering logic
 * Tests search, status, and category filters
 */
import { describe, it, expect } from "vitest";
import { filterProducts } from "../app/admin/products/_components/filterProducts";
import type { ProductData } from "../app/admin/products/_components/ProductsClient";

// Mock product data for testing
const mockProducts: ProductData[] = [
  {
    id: 1,
    title: "Silver Ring",
    description: "A beautiful silver ring",
    price: "49.99",
    inventory: 10,
    sku: "SR-001",
    category_id: 1,
    imgUrl: [],
    imgKey: [],
    imgCrop: [],
    sort_order: 0,
    status: "active",
    on_sale: false,
    url_handle: "silver-ring",
    createdAt: new Date("2024-01-01"),
    updatedAt: null,
  },
  {
    id: 2,
    title: "Gold Necklace",
    description: "Premium gold necklace",
    price: "199.99",
    inventory: 0,
    sku: "GN-002",
    category_id: 2,
    imgUrl: [],
    imgKey: [],
    imgCrop: [],
    sort_order: 1,
    status: "sold_out",
    on_sale: true,
    url_handle: "gold-necklace",
    createdAt: new Date("2024-01-02"),
    updatedAt: null,
  },
  {
    id: 3,
    title: "Bronze Earrings",
    description: "Handcrafted bronze earrings",
    price: "29.99",
    inventory: 5,
    sku: null,
    category_id: 1,
    imgUrl: [],
    imgKey: [],
    imgCrop: [],
    sort_order: 2,
    status: "hidden",
    on_sale: false,
    url_handle: null,
    createdAt: new Date("2024-01-03"),
    updatedAt: null,
  },
  {
    id: 4,
    title: "Diamond Bracelet",
    description: "Luxury diamond bracelet for special occasions",
    price: "999.99",
    inventory: 3,
    sku: "DB-004",
    category_id: null,
    imgUrl: [],
    imgKey: [],
    imgCrop: [],
    sort_order: 3,
    status: "active",
    on_sale: false,
    url_handle: "diamond-bracelet",
    createdAt: new Date("2024-01-04"),
    updatedAt: null,
  },
];

describe("filterProducts", () => {
  describe("search filter", () => {
    it("returns all products when search is empty", () => {
      const result = filterProducts(mockProducts, {
        searchQuery: "",
        statusFilter: "all",
        categoryFilter: "all",
      });
      expect(result).toHaveLength(4);
    });

    it("filters by title (case insensitive)", () => {
      const result = filterProducts(mockProducts, {
        searchQuery: "silver",
        statusFilter: "all",
        categoryFilter: "all",
      });
      expect(result).toHaveLength(1);
      expect(result[0]!.title).toBe("Silver Ring");
    });

    it("filters by SKU (case insensitive)", () => {
      const result = filterProducts(mockProducts, {
        searchQuery: "gn-002",
        statusFilter: "all",
        categoryFilter: "all",
      });
      expect(result).toHaveLength(1);
      expect(result[0]!.title).toBe("Gold Necklace");
    });

    it("filters by description", () => {
      const result = filterProducts(mockProducts, {
        searchQuery: "handcrafted",
        statusFilter: "all",
        categoryFilter: "all",
      });
      expect(result).toHaveLength(1);
      expect(result[0]!.title).toBe("Bronze Earrings");
    });

    it("returns empty array when no matches", () => {
      const result = filterProducts(mockProducts, {
        searchQuery: "nonexistent",
        statusFilter: "all",
        categoryFilter: "all",
      });
      expect(result).toHaveLength(0);
    });

    it("matches partial strings", () => {
      const result = filterProducts(mockProducts, {
        searchQuery: "brac",
        statusFilter: "all",
        categoryFilter: "all",
      });
      expect(result).toHaveLength(1);
      expect(result[0]!.title).toBe("Diamond Bracelet");
    });
  });

  describe("status filter", () => {
    it("returns all products when status is 'all'", () => {
      const result = filterProducts(mockProducts, {
        searchQuery: "",
        statusFilter: "all",
        categoryFilter: "all",
      });
      expect(result).toHaveLength(4);
    });

    it("filters by 'active' status", () => {
      const result = filterProducts(mockProducts, {
        searchQuery: "",
        statusFilter: "active",
        categoryFilter: "all",
      });
      expect(result).toHaveLength(2);
      expect(result.every((p) => p.status === "active")).toBe(true);
    });

    it("filters by 'sold_out' status", () => {
      const result = filterProducts(mockProducts, {
        searchQuery: "",
        statusFilter: "sold_out",
        categoryFilter: "all",
      });
      expect(result).toHaveLength(1);
      expect(result[0]!.title).toBe("Gold Necklace");
    });

    it("filters by 'hidden' status", () => {
      const result = filterProducts(mockProducts, {
        searchQuery: "",
        statusFilter: "hidden",
        categoryFilter: "all",
      });
      expect(result).toHaveLength(1);
      expect(result[0]!.title).toBe("Bronze Earrings");
    });
  });

  describe("category filter", () => {
    it("returns all products when category is 'all'", () => {
      const result = filterProducts(mockProducts, {
        searchQuery: "",
        statusFilter: "all",
        categoryFilter: "all",
      });
      expect(result).toHaveLength(4);
    });

    it("filters by specific category", () => {
      const result = filterProducts(mockProducts, {
        searchQuery: "",
        statusFilter: "all",
        categoryFilter: 1,
      });
      expect(result).toHaveLength(2);
      expect(result.every((p) => p.category_id === 1)).toBe(true);
    });

    it("excludes products with null category when filtering", () => {
      const result = filterProducts(mockProducts, {
        searchQuery: "",
        statusFilter: "all",
        categoryFilter: 1,
      });
      // Diamond Bracelet has null category_id
      expect(result.find((p) => p.title === "Diamond Bracelet")).toBeUndefined();
    });

    it("returns only products in category 2", () => {
      const result = filterProducts(mockProducts, {
        searchQuery: "",
        statusFilter: "all",
        categoryFilter: 2,
      });
      expect(result).toHaveLength(1);
      expect(result[0]!.title).toBe("Gold Necklace");
    });
  });

  describe("combined filters", () => {
    it("applies search and status filters together", () => {
      const result = filterProducts(mockProducts, {
        searchQuery: "ring",
        statusFilter: "active",
        categoryFilter: "all",
      });
      expect(result).toHaveLength(1);
      expect(result[0]!.title).toBe("Silver Ring");
    });

    it("applies search and category filters together", () => {
      const result = filterProducts(mockProducts, {
        searchQuery: "gold",
        statusFilter: "all",
        categoryFilter: 2,
      });
      expect(result).toHaveLength(1);
      expect(result[0]!.title).toBe("Gold Necklace");
    });

    it("applies all three filters together", () => {
      const result = filterProducts(mockProducts, {
        searchQuery: "silver",
        statusFilter: "active",
        categoryFilter: 1,
      });
      expect(result).toHaveLength(1);
      expect(result[0]!.title).toBe("Silver Ring");
    });

    it("returns empty when filters are mutually exclusive", () => {
      const result = filterProducts(mockProducts, {
        searchQuery: "gold",
        statusFilter: "active",
        categoryFilter: 1,
      });
      // Gold Necklace is sold_out, not in category 1
      expect(result).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("handles empty product array", () => {
      const result = filterProducts([], {
        searchQuery: "",
        statusFilter: "all",
        categoryFilter: "all",
      });
      expect(result).toHaveLength(0);
    });

    it("handles products with null SKU in search", () => {
      // Bronze Earrings has null SKU
      const result = filterProducts(mockProducts, {
        searchQuery: "SR-001",
        statusFilter: "all",
        categoryFilter: "all",
      });
      // Should not throw and should only return Silver Ring
      expect(result).toHaveLength(1);
      expect(result[0]!.title).toBe("Silver Ring");
    });

    it("handles whitespace in search query", () => {
      const result = filterProducts(mockProducts, {
        searchQuery: "  silver  ",
        statusFilter: "all",
        categoryFilter: "all",
      });
      // Note: current implementation doesn't trim - this tests actual behavior
      expect(result).toHaveLength(0);
    });
  });
});

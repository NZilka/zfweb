/**
 * filterProducts - Pure utility function for filtering products
 * Extracted from ProductsClient for testability
 */
import type { ProductData, StatusFilter } from "./ProductsClient";

export interface FilterOptions {
  searchQuery: string;
  statusFilter: StatusFilter;
  categoryFilter: number | "all";
}

/**
 * Filter products based on search query, status, and category
 * @param products - Array of products to filter
 * @param options - Filter options (search, status, category)
 * @returns Filtered array of products
 */
export function filterProducts(
  products: ProductData[],
  options: FilterOptions
): ProductData[] {
  const { searchQuery, statusFilter, categoryFilter } = options;

  return products.filter((product) => {
    // Search filter - matches title, SKU, or description (case insensitive)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = product.title.toLowerCase().includes(query);
      const matchesSku = product.sku?.toLowerCase().includes(query);
      const matchesDescription = product.description.toLowerCase().includes(query);
      if (!matchesTitle && !matchesSku && !matchesDescription) {
        return false;
      }
    }

    // Status filter - match exact status value
    if (statusFilter !== "all" && product.status !== statusFilter) {
      return false;
    }

    // Category filter - match category_id
    if (categoryFilter !== "all" && product.category_id !== categoryFilter) {
      return false;
    }

    return true;
  });
}

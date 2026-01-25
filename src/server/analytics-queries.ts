/**
 * Server-side analytics queries for admin dashboard
 * Aggregates sales data from order tables
 */
import "server-only";
import { db } from "~/server/db";
import { order, order_items, product, product_category } from "~/server/db/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

// Sales metrics aggregated for a date range
export interface SalesMetrics {
  revenue: number;
  orderCount: number;
  unitsSold: number;
  avgOrderValue: number;
}

// Date range presets for dashboard filtering
export type DateRangePreset = "7d" | "30d" | "month" | "year" | "all";

/**
 * Calculate start date from preset
 * "year" = Jan 1 of current year (calendar year)
 * "month" = 1st of current month
 */
export function getDateRangeFromPreset(preset: DateRangePreset): { start: Date; end: Date } {
  const now = new Date();
  const end = now;

  switch (preset) {
    case "7d":
      return {
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        end,
      };
    case "30d":
      return {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end,
      };
    case "month":
      // First day of current month
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end,
      };
    case "year":
      // January 1 of current year (calendar year)
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end,
      };
    case "all":
      // Far past date to include all data
      return {
        start: new Date(2000, 0, 1),
        end,
      };
  }
}

/**
 * Get aggregated sales metrics for a date range
 * Only includes paid orders
 */
export async function getSalesMetrics(startDate: Date, endDate: Date): Promise<SalesMetrics> {
  // Get revenue and order count from paid orders
  const orderStats = await db
    .select({
      revenue: sql<string>`COALESCE(SUM(${order.total}::numeric), 0)`,
      orderCount: sql<number>`COUNT(${order.id})::int`,
    })
    .from(order)
    .where(
      and(
        eq(order.status, "paid"),
        gte(order.createdAt, startDate),
        lte(order.createdAt, endDate)
      )
    );

  // Get total units sold from order items
  const unitsResult = await db
    .select({
      unitsSold: sql<number>`COALESCE(SUM(${order_items.quantity}), 0)::int`,
    })
    .from(order_items)
    .innerJoin(order, eq(order_items.order_id, order.id))
    .where(
      and(
        eq(order.status, "paid"),
        gte(order.createdAt, startDate),
        lte(order.createdAt, endDate)
      )
    );

  const revenue = parseFloat(orderStats[0]?.revenue ?? "0");
  const orderCount = orderStats[0]?.orderCount ?? 0;
  const unitsSold = unitsResult[0]?.unitsSold ?? 0;
  const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;

  return {
    revenue,
    orderCount,
    unitsSold,
    avgOrderValue,
  };
}

// Per-product sales statistics
export interface ProductSalesStats {
  productId: number;
  productTitle: string;
  unitsSold: number;
  revenue: number;
}

/**
 * Get sales statistics per product for a date range
 * Ordered by revenue descending
 */
export async function getProductSalesStats(
  startDate: Date,
  endDate: Date
): Promise<ProductSalesStats[]> {
  const result = await db
    .select({
      productId: order_items.product_id,
      productTitle: product.title,
      unitsSold: sql<number>`SUM(${order_items.quantity})::int`,
      revenue: sql<string>`SUM(${order_items.quantity} * ${product.price}::numeric)`,
    })
    .from(order_items)
    .innerJoin(order, eq(order_items.order_id, order.id))
    .innerJoin(product, eq(order_items.product_id, product.id))
    .where(
      and(
        eq(order.status, "paid"),
        gte(order.createdAt, startDate),
        lte(order.createdAt, endDate)
      )
    )
    .groupBy(order_items.product_id, product.title)
    .orderBy(desc(sql`SUM(${order_items.quantity} * ${product.price}::numeric)`));

  return result.map((row) => ({
    productId: row.productId,
    productTitle: row.productTitle,
    unitsSold: row.unitsSold,
    revenue: parseFloat(row.revenue ?? "0"),
  }));
}

// Per-category sales statistics
export interface CategorySalesStats {
  categoryId: number | null;
  categoryName: string;
  unitsSold: number;
  revenue: number;
}

/**
 * Get sales statistics per category for a date range
 * Products without categories are grouped as "Uncategorized"
 */
export async function getCategorySalesStats(
  startDate: Date,
  endDate: Date
): Promise<CategorySalesStats[]> {
  const result = await db
    .select({
      categoryId: product.category_id,
      categoryName: sql<string>`COALESCE(${product_category.name}, 'Uncategorized')`,
      unitsSold: sql<number>`SUM(${order_items.quantity})::int`,
      revenue: sql<string>`SUM(${order_items.quantity} * ${product.price}::numeric)`,
    })
    .from(order_items)
    .innerJoin(order, eq(order_items.order_id, order.id))
    .innerJoin(product, eq(order_items.product_id, product.id))
    .leftJoin(product_category, eq(product.category_id, product_category.id))
    .where(
      and(
        eq(order.status, "paid"),
        gte(order.createdAt, startDate),
        lte(order.createdAt, endDate)
      )
    )
    .groupBy(product.category_id, product_category.name)
    .orderBy(desc(sql`SUM(${order_items.quantity} * ${product.price}::numeric)`));

  return result.map((row) => ({
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    unitsSold: row.unitsSold,
    revenue: parseFloat(row.revenue ?? "0"),
  }));
}

// Recent order for dashboard display
export interface RecentOrder {
  id: number;
  customerName: string;
  total: string;
  createdAt: Date;
  status: string;
  isShipped: boolean;
}

/**
 * Get the most recent orders (paid only)
 */
export async function getRecentOrders(limit: number = 5): Promise<RecentOrder[]> {
  const result = await db
    .select({
      id: order.id,
      customerName: order.customer_name,
      total: order.total,
      createdAt: order.createdAt,
      status: order.status,
      isShipped: order.is_shipped,
    })
    .from(order)
    .where(eq(order.status, "paid"))
    .orderBy(desc(order.createdAt))
    .limit(limit);

  return result;
}

/**
 * Get the most recent shipments (shipped orders)
 */
export async function getRecentShipments(limit: number = 5): Promise<RecentOrder[]> {
  const result = await db
    .select({
      id: order.id,
      customerName: order.customer_name,
      total: order.total,
      createdAt: order.createdAt,
      status: order.status,
      isShipped: order.is_shipped,
    })
    .from(order)
    .where(
      and(
        eq(order.status, "paid"),
        eq(order.is_shipped, true)
      )
    )
    .orderBy(desc(order.shipped_at))
    .limit(limit);

  return result;
}

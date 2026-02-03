/**
 * Server-side queries for admin order management
 * Fetches orders by fulfillment status for the Orders tab
 */
import "server-only";
import { db } from "~/server/db";
import { order, order_items, product } from "~/server/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

// Order with items for display
export interface OrderWithItems {
  id: number;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  total: string;
  status: string;
  isDownloaded: boolean;
  downloadedAt: Date | null;
  isPacked: boolean;
  packedAt: Date | null;
  isShipped: boolean;
  shippedAt: Date | null;
  trackingNumber: string | null;
  // Whether order is a gift (hides prices on packing slip)
  isGift: boolean;
  createdAt: Date;
  items: {
    id: number;
    quantity: number;
    product: {
      id: number;
      title: string;
      price: string;
      imgUrl: string[];
    };
  }[];
}

// Fulfillment status filter types
export type FulfillmentFilter = "unshipped" | "in_process" | "shipped" | "all";

/**
 * Get orders by fulfillment status
 * - unshipped: paid, not downloaded
 * - in_process: downloaded but not shipped
 * - shipped: shipped
 * - all: all paid orders
 */
export async function getOrdersByFulfillmentStatus(
  filter: FulfillmentFilter
): Promise<OrderWithItems[]> {
  // Build where conditions based on filter
  const conditions = [eq(order.status, "paid")];

  switch (filter) {
    case "unshipped":
      // Paid but not yet downloaded for shipping
      conditions.push(eq(order.is_downloaded, false));
      break;
    case "in_process":
      // Downloaded but not shipped
      conditions.push(eq(order.is_downloaded, true));
      conditions.push(eq(order.is_shipped, false));
      break;
    case "shipped":
      // Shipped
      conditions.push(eq(order.is_shipped, true));
      break;
    // "all" has no additional conditions
  }

  // Fetch orders with their items
  const orders = await db
    .select({
      id: order.id,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      shippingAddress: order.shipping_address,
      total: order.total,
      status: order.status,
      isDownloaded: order.is_downloaded,
      downloadedAt: order.downloaded_at,
      isPacked: order.is_packed,
      packedAt: order.packed_at,
      isShipped: order.is_shipped,
      shippedAt: order.shipped_at,
      trackingNumber: order.tracking_number,
      isGift: order.is_gift,
      createdAt: order.createdAt,
    })
    .from(order)
    .where(and(...conditions))
    .orderBy(desc(order.createdAt));

  // Fetch items for each order
  const ordersWithItems: OrderWithItems[] = [];

  for (const ord of orders) {
    const items = await db
      .select({
        id: order_items.id,
        quantity: order_items.quantity,
        productId: product.id,
        productTitle: product.title,
        productPrice: product.price,
        productImgUrl: product.imgUrl,
      })
      .from(order_items)
      .innerJoin(product, eq(order_items.product_id, product.id))
      .where(eq(order_items.order_id, ord.id));

    ordersWithItems.push({
      ...ord,
      items: items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        product: {
          id: item.productId,
          title: item.productTitle,
          price: item.productPrice,
          imgUrl: item.productImgUrl,
        },
      })),
    });
  }

  return ordersWithItems;
}

/**
 * Get count of orders in each fulfillment status
 * Used for badge counts on sub-tabs
 */
export async function getOrderCounts(): Promise<{
  unshipped: number;
  inProcess: number;
  shipped: number;
  all: number;
}> {
  const [unshippedResult, inProcessResult, shippedResult, allResult] = await Promise.all([
    // Unshipped: paid, not downloaded
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(order)
      .where(and(eq(order.status, "paid"), eq(order.is_downloaded, false))),
    // In Process: downloaded, not shipped
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(order)
      .where(and(eq(order.status, "paid"), eq(order.is_downloaded, true), eq(order.is_shipped, false))),
    // Shipped
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(order)
      .where(and(eq(order.status, "paid"), eq(order.is_shipped, true))),
    // All paid
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(order)
      .where(eq(order.status, "paid")),
  ]);

  return {
    unshipped: unshippedResult[0]?.count ?? 0,
    inProcess: inProcessResult[0]?.count ?? 0,
    shipped: shippedResult[0]?.count ?? 0,
    all: allResult[0]?.count ?? 0,
  };
}

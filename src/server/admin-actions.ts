/**
 * Server actions for admin order management
 * Handles CSV export and order status updates
 */
"use server";

import { db } from "~/server/db";
import { order } from "~/server/db/schema";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Shipping address type from order
interface ShippingAddress {
  firstName?: string;
  lastName?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
}

// Pirate Ship CSV columns
// Name,Company,Address1,Address2,City,State,Zip,Country,Phone,Email,Weight,Length,Width,Height
const CSV_HEADER =
  "Name,Company,Address1,Address2,City,State,Zip,Country,Phone,Email,Weight,Length,Width,Height";

/**
 * Generate Pirate Ship format CSV for selected orders
 * Marks orders as downloaded and returns CSV content
 */
export async function generatePirateShipCsv(orderIds: number[]): Promise<{
  success: boolean;
  csv?: string;
  error?: string;
  downloadedCount?: number;
}> {
  if (orderIds.length === 0) {
    return { success: false, error: "No orders selected" };
  }

  try {
    // Fetch orders with their shipping info
    const orders = await db
      .select({
        id: order.id,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        shippingAddress: order.shipping_address,
      })
      .from(order)
      .where(inArray(order.id, orderIds));

    if (orders.length === 0) {
      return { success: false, error: "No orders found" };
    }

    // Build CSV rows
    const rows: string[] = [CSV_HEADER];

    for (const ord of orders) {
      // Parse shipping address JSON
      let address: ShippingAddress = {};
      try {
        address = JSON.parse(ord.shippingAddress) as ShippingAddress;
      } catch {
        // Use empty address if parse fails
      }

      // Format name from customer name or address parts
      const name = ord.customerName || `${address.firstName || ""} ${address.lastName || ""}`.trim();

      // Escape CSV values (wrap in quotes if contains comma, quote, or newline)
      const escapeValue = (val: string | undefined | null): string => {
        if (!val) return "";
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      // Build CSV row for Pirate Ship format
      // Weight, Length, Width, Height left empty (set in Pirate Ship)
      const row = [
        escapeValue(name),
        "", // Company - not captured
        escapeValue(address.address1),
        escapeValue(address.address2),
        escapeValue(address.city),
        escapeValue(address.state),
        escapeValue(address.zipCode),
        escapeValue(address.country || "US"),
        escapeValue(address.phone),
        escapeValue(ord.customerEmail),
        "", // Weight
        "", // Length
        "", // Width
        "", // Height
      ].join(",");

      rows.push(row);
    }

    // Mark orders as downloaded
    const now = new Date();
    await db
      .update(order)
      .set({
        is_downloaded: true,
        downloaded_at: now,
      })
      .where(inArray(order.id, orderIds));

    // Revalidate orders page to reflect status change
    revalidatePath("/admin/orders");

    return {
      success: true,
      csv: rows.join("\n"),
      downloadedCount: orders.length,
    };
  } catch (error) {
    console.error("Error generating CSV:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate CSV",
    };
  }
}

/**
 * Update order fulfillment status
 * Used for packed and shipped checkboxes
 */
export async function updateOrderFulfillment(
  orderId: number,
  updates: {
    isPacked?: boolean;
    isShipped?: boolean;
    trackingNumber?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date();
    const updateData: Partial<{
      is_packed: boolean;
      packed_at: Date | null;
      is_shipped: boolean;
      shipped_at: Date | null;
      tracking_number: string | null;
    }> = {};

    // Set packed status with timestamp
    if (updates.isPacked !== undefined) {
      updateData.is_packed = updates.isPacked;
      updateData.packed_at = updates.isPacked ? now : null;
    }

    // Set shipped status with timestamp
    if (updates.isShipped !== undefined) {
      updateData.is_shipped = updates.isShipped;
      updateData.shipped_at = updates.isShipped ? now : null;
    }

    // Set tracking number
    if (updates.trackingNumber !== undefined) {
      updateData.tracking_number = updates.trackingNumber || null;
    }

    await db.update(order).set(updateData).where(eq(order.id, orderId));

    // Revalidate orders page
    revalidatePath("/admin/orders");

    return { success: true };
  } catch (error) {
    console.error("Error updating order fulfillment:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update order",
    };
  }
}

/**
 * Mark multiple orders as downloaded (without generating CSV)
 */
export async function markOrdersDownloaded(orderIds: number[]): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const now = new Date();
    await db
      .update(order)
      .set({
        is_downloaded: true,
        downloaded_at: now,
      })
      .where(inArray(order.id, orderIds));

    revalidatePath("/admin/orders");
    return { success: true };
  } catch (error) {
    console.error("Error marking orders downloaded:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update orders",
    };
  }
}

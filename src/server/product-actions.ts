/**
 * product-actions — Server actions for product management
 * Currently handles sort order updates for admin drag-and-drop reordering
 */
"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "./db";
import { product } from "./db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Update sort_order for all products based on drag-and-drop order
// orderedIds is the full list of product IDs in desired display order
// Uses a transaction so all updates succeed or none do (no partial reorder)
export async function updateProductSortOrder(orderedIds: number[]) {
  const user = await auth();
  if (!user.userId) throw new Error("Unauthorized");

  // Wrap in transaction — if any update fails, all are rolled back
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(product)
        .set({ sort_order: i })
        .where(eq(product.id, orderedIds[i]!));
    }
  });

  // Revalidate both admin products page and shop so order is reflected
  revalidatePath("/admin/products");
  revalidatePath("/shop");
}

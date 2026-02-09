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
// Sequential updates — neon-http driver doesn't support transactions.
// Partial failure risk is acceptable for sort_order (next save corrects it).
export async function updateProductSortOrder(orderedIds: number[]) {
  const user = await auth();
  if (!user.userId) throw new Error("Unauthorized");

  // Sequential updates — neon-http is stateless HTTP, no transaction support
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(product)
      .set({ sort_order: i })
      .where(eq(product.id, orderedIds[i]!));
  }

  // Revalidate both admin products page and shop so order is reflected
  revalidatePath("/admin/products");
  revalidatePath("/shop");
}

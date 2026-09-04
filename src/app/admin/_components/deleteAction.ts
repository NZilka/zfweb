"use server";

import { deleteProduct } from "~/server/queries";
import { requireAdmin } from "~/server/auth";

// Server action wrapper for delete that can be called from client components
// The original deleteProduct redirects, which works with form actions
export async function deleteProductAction(id: number) {
  // Admin only — public endpoint. deleteProduct checks again internally;
  // the per-request memoization in isAdminUser makes the second check free.
  await requireAdmin();
  await deleteProduct(id);
}

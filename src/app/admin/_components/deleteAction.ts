"use server";

import { deleteProduct } from "~/server/queries";

// Server action wrapper for delete that can be called from client components
// The original deleteProduct redirects, which works with form actions
export async function deleteProductAction(id: number) {
  await deleteProduct(id);
}

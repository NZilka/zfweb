/**
 * product-actions — Server actions for product management
 * Handles sort order updates and bulk product deletion
 */
"use server";

// requireAdmin replaces the previous "any signed-in user" check
import { requireAdmin } from "~/server/auth";
import { db } from "./db";
import { product } from "./db/schema";
import { deleteProductCore } from "./queries";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Update sort_order for all products based on drag-and-drop order
// orderedIds is the full list of product IDs in desired display order
// Sequential updates — neon-http driver doesn't support transactions.
// Partial failure risk is acceptable for sort_order (next save corrects it).
export async function updateProductSortOrder(orderedIds: number[]) {
  // Admin only (throws AuthorizationError otherwise)
  await requireAdmin();

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

// Result shape returned by deleteProductsAction. Successes and failures
// are returned together so the client can render a partial-success summary
// (e.g. "Deleted 4 of 5. 'Silver Ring' couldn't be deleted because it's
// referenced by existing orders.").
export type BulkDeleteResult = {
  succeeded: number[];
  failed: { id: number; title: string; reason: string }[];
};

// Postgres foreign-key violation code. Returned by neon-http when a DELETE
// on a row that's still referenced by another table (cart_item or
// order_items in our case) is attempted. The code may appear on the error
// directly or nested under `cause`, depending on the driver.
const FK_VIOLATION_CODE = "23503";

// Extract a postgres error code from anywhere the driver might surface it.
function getPgErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as { code?: unknown; cause?: { code?: unknown } };
  if (typeof e.code === "string") return e.code;
  if (e.cause && typeof e.cause.code === "string") return e.cause.code;
  return undefined;
}

// Translate the raw error into a user-readable reason string for the
// bulk-delete failure list. FK violation gets a friendly message;
// anything else falls back to the message.
function classifyDeleteError(err: unknown): string {
  if (getPgErrorCode(err) === FK_VIOLATION_CODE) {
    return "referenced by existing orders or carts";
  }
  if (err instanceof Error) return err.message;
  return "unknown error";
}

// Bulk delete: loop over IDs, attempting each via deleteProductCore.
// Per-item try/catch isolates failures so a single FK violation doesn't
// abort the whole batch (neon-http has no transaction support, so we
// can't do this atomically anyway — and "delete what you can, report
// what you couldn't" is the desired UX).
export async function deleteProductsAction(
  ids: number[],
): Promise<BulkDeleteResult> {
  // Admin only (throws AuthorizationError otherwise)
  await requireAdmin();

  const result: BulkDeleteResult = { succeeded: [], failed: [] };

  if (ids.length === 0) return result;

  // Pre-fetch titles in one query so failure reports can name the products.
  // We tolerate missing rows here (the per-item loop also fetches via
  // deleteProductCore and will throw a clear error for any truly missing id).
  const rows = await db
    .select({ id: product.id, title: product.title })
    .from(product)
    .where(inArray(product.id, ids));
  const titleById = new Map(rows.map((r) => [r.id, r.title]));

  for (const id of ids) {
    try {
      await deleteProductCore(id);
      result.succeeded.push(id);
    } catch (err) {
      result.failed.push({
        id,
        title: titleById.get(id) ?? `#${id}`,
        reason: classifyDeleteError(err),
      });
    }
  }

  // Revalidate so the admin list reflects the new state on next nav;
  // the client also calls router.refresh() to force the current tab to re-render.
  revalidatePath("/admin/products");
  revalidatePath("/shop");

  return result;
}

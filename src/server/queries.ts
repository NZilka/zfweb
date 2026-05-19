import "server-only";

import { db } from "./db";
import { auth } from "@clerk/nextjs/server";
import { utapi } from "./uploadthing";
import { product as dbproduct } from "./db/schema";
import { eq, and, ilike, or, type SQL } from "drizzle-orm";
import { redirect } from "next/navigation";

// Fetch products with optional category and search filters
// Sorted by sort_order first (for manual drag reorder), then by id as tiebreaker
export const getProducts = async (opts?: {
  categoryId?: number;
  search?: string;
}) => {
  const products = await db.query.product.findMany({
    where: (model, { eq, and, ilike, or }) => {
      const conditions: SQL[] = [];
      // Filter by category when specified
      if (opts?.categoryId) {
        conditions.push(eq(model.category_id, opts.categoryId));
      }
      // Search across title and description with case-insensitive matching
      // Escape LIKE metacharacters (% and _) so user input is treated literally
      if (opts?.search) {
        const escaped = opts.search.replace(/%/g, "\\%").replace(/_/g, "\\_");
        const term = `%${escaped}%`;
        conditions.push(
          or(ilike(model.title, term), ilike(model.description, term))!,
        );
      }
      return conditions.length > 0 ? and(...conditions) : undefined;
    },
    orderBy: (model: any, { asc }) => [asc(model.sort_order), asc(model.id)],
  });
  return products;
};

export async function getProductById(id: number) {
  const user = await auth();
  if (!user.userId) throw new Error("Unauthorized");

  const product = await db.query.product.findFirst({
    where: (model, { eq }) => eq(model.id, id),
  });
  if (!product) throw new Error("Product Not found");

  return product;
}

export async function getPublicProductById(id: number) {
  const product = await db.query.product.findFirst({
    where: (model, { eq }) => eq(model.id, id),
  });
  return product;
}

// Core delete logic without the redirect — callable in a loop (the bulk
// delete server action needs per-item failure isolation, and a redirect
// throws NEXT_REDIRECT which would terminate the loop on iteration 1).
// Throws on auth failure, missing product, or DB constraint violation
// (e.g. FK 23503 if the product is referenced by an order_item or cart_item).
export async function deleteProductCore(id: number) {
  const user = await auth();
  if (!user.userId) throw new Error("Unauthorized");

  const product = await db.query.product.findFirst({
    where: (model, { eq }) => eq(model.id, id),
  });
  if (!product) throw new Error("Product Not found");

  // DB delete first — this is the operation that can fail with an FK
  // violation. If it throws, we don't want to have already deleted UT files.
  await db.delete(dbproduct).where(eq(dbproduct.id, id));

  // UT cleanup only runs after a successful DB delete.
  await utapi.deleteFiles(product.imgKey);
}

// Single-product delete preserved as a thin wrapper for existing call sites.
// Triggers a redirect to /admin so the legacy "Delete from product edit modal"
// flow keeps working unchanged.
export async function deleteProduct(id: number) {
  await deleteProductCore(id);
  redirect("/admin");
}

// Fetch all product categories for dropdown selection
export async function getCategories() {
  const categories = await db.query.product_category.findMany({
    orderBy: (model, { asc }) => asc(model.name),
  });
  return categories;
}

// Fetch a single category by ID for editing
export async function getCategoryById(id: number) {
  const user = await auth();
  if (!user.userId) throw new Error("Unauthorized");

  const category = await db.query.product_category.findFirst({
    where: (model, { eq }) => eq(model.id, id),
  });
  return category;
}

// Fetch a single category by ID without auth — for public shop pages
export async function getPublicCategoryById(id: number) {
  const category = await db.query.product_category.findFirst({
    where: (model, { eq }) => eq(model.id, id),
  });
  return category;
}

// Count products in a category (for delete confirmation warning)
export async function getProductCountByCategory(categoryId: number) {
  const products = await db.query.product.findMany({
    where: (model, { eq }) => eq(model.category_id, categoryId),
  });
  return products.length;
}

// Fetch orders for a user by their email address
// Used in account page to show order history
export async function getOrdersByEmail(email: string) {
  const orders = await db.query.order.findMany({
    where: (model, { eq }) => eq(model.customer_email, email),
    orderBy: (model, { desc }) => desc(model.createdAt),
  });
  return orders;
}

// Fetch customer record by Clerk user ID
// Returns customer with Stripe info if linked
export async function getCustomerByClerkId(clerkUserId: string) {
  const customer = await db.query.customer.findFirst({
    where: (model, { eq }) => eq(model.clerk_user_id, clerkUserId),
  });
  return customer;
}

// Link guest orders to a newly created user account
// Called when user creates account after guest checkout
// Finds orders by email and updates them to link to the user
export async function linkGuestOrdersToUser(
  clerkUserId: string,
  email: string
): Promise<number> {
  // Import here to avoid circular dependencies
  const { customer, order } = await import("~/server/db/schema");
  const { eq, and, isNull } = await import("drizzle-orm");

  // Find or create customer record for this user
  let customerRecord = await db.query.customer.findFirst({
    where: (model, { eq }) => eq(model.clerk_user_id, clerkUserId),
  });

  if (!customerRecord) {
    // Check if there's a customer with this email but no clerk_user_id
    customerRecord = await db.query.customer.findFirst({
      where: (model, { eq, isNull, and }) =>
        and(eq(model.email, email), isNull(model.clerk_user_id)),
    });

    if (customerRecord) {
      // Link existing customer to Clerk user
      await db
        .update(customer)
        .set({ clerk_user_id: clerkUserId, isUser: true })
        .where(eq(customer.id, customerRecord.id));
    }
  }

  if (!customerRecord) return 0;

  // Find orders with this email that aren't linked to a user
  const guestOrders = await db.query.order.findMany({
    where: (model, { eq, isNull, and }) =>
      and(eq(model.customer_email, email), isNull(model.user_id)),
  });

  // Link each order to the customer
  for (const guestOrder of guestOrders) {
    await db
      .update(order)
      .set({ user_id: customerRecord.id })
      .where(eq(order.id, guestOrder.id));
  }

  return guestOrders.length;
}

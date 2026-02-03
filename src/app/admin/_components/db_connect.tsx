"use server";

import { db } from "~/server/db";
import { product as dbProduct, product_category } from "~/server/db/schema";
import { type ProductType } from "~/app/_context/ProductContext";
import { auth } from "@clerk/nextjs/server";
import { utapi } from "~/server/uploadthing";
import { eq, and, ne } from "drizzle-orm";
import { type OrderedImageRef } from "~/app/_context/EditImageContext";
import { z } from "zod";

// Zod schema for category validation
const categorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(256),
  description: z.string().max(1024).optional().default(""),
});

// Type for category input derived from Zod schema
export type CategoryInput = z.infer<typeof categorySchema>;

// Check if a URL handle already exists (for duplicate validation)
// Returns true if the handle is already taken by another product
export const checkUrlHandleExists = async (
  urlHandle: string,
  excludeProductId?: number,
) => {
  if (!urlHandle.trim()) return false;

  const conditions = [eq(dbProduct.url_handle, urlHandle)];
  // In edit mode, exclude the current product from the check
  if (excludeProductId) {
    conditions.push(ne(dbProduct.id, excludeProductId));
  }

  const existing = await db.query.product.findFirst({
    where: and(...conditions),
    columns: { id: true },
  });

  return !!existing;
};

// Create a new product with images
export const addProduct = async (
  product: ProductType,
  urls: string[] | undefined,
  keys: string[] | undefined,
  urlHandle?: string,
) => {
  const result: { returnId: number }[] = await db
    .insert(dbProduct)
    .values({
      title: product.title,
      price: String(product.price),
      description: product.description,
      imgKey: keys ?? [],
      imgUrl: urls ?? [],
      inventory: product.inventory,
      sku: product.sku ?? null,
      category_id: product.category_id ?? null,
      // Save URL handle if provided
      url_handle: urlHandle ?? null,
    })
    .returning({ returnId: dbProduct.id });

  return JSON.stringify(result);
};

// Image changes structure for update operations.
// orderedImages describes the final display order, allowing new images
// to be interleaved with existing ones rather than always appended at the end.
interface ImageChanges {
  keepKeys: string[];    // Existing image keys to retain
  keepUrls: string[];    // Existing image URLs to retain
  removeKeys: string[];  // Existing image keys to delete from UploadThing
  newUrls: string[];     // URLs from newly uploaded images
  newKeys: string[];     // Keys from newly uploaded images
  orderedImages: OrderedImageRef[];  // Final order: each entry references existing or new by index
}

// Update an existing product with support for image changes
export const updateProduct = async (
  productId: number,
  product: ProductType,
  imageChanges: ImageChanges,
  urlHandle?: string,
) => {
  // Verify user is authenticated
  const user = await auth();
  if (!user.userId) throw new Error("Unauthorized");

  // Fetch current product to verify it exists
  const existingProduct = await db.query.product.findFirst({
    where: (model, { eq }) => eq(model.id, productId),
  });
  if (!existingProduct) throw new Error("Product not found");

  // Delete removed images from UploadThing (fire-and-forget to avoid blocking)
  if (imageChanges.removeKeys.length > 0) {
    console.log("Deleting images from UploadThing:", imageChanges.removeKeys);
    try {
      await utapi.deleteFiles(imageChanges.removeKeys);
    } catch (err) {
      // Log error but don't fail the update - orphaned files can be cleaned up later
      console.error("Failed to delete some images from UploadThing:", err);
    }
  }

  // Build final image arrays using orderedImages to preserve interleaved order.
  // This allows new images to appear at any position (not just at the end)
  // based on where the user dragged them during reordering.
  const finalUrls: string[] = [];
  const finalKeys: string[] = [];

  for (const ref of imageChanges.orderedImages) {
    if (ref.type === "existing") {
      // Reference to an existing image - pull from keepUrls/keepKeys
      const url = imageChanges.keepUrls[ref.index];
      const key = imageChanges.keepKeys[ref.index];
      if (url) finalUrls.push(url);
      if (key) finalKeys.push(key);
    } else {
      // Reference to a newly uploaded image - pull from newUrls/newKeys
      const url = imageChanges.newUrls[ref.index];
      const key = imageChanges.newKeys[ref.index];
      if (url) finalUrls.push(url);
      if (key) finalKeys.push(key);
    }
  }

  // Update the product record
  const result = await db
    .update(dbProduct)
    .set({
      title: product.title,
      price: String(product.price),
      description: product.description,
      inventory: product.inventory,
      sku: product.sku ?? null,
      category_id: product.category_id ?? null,
      imgUrl: finalUrls,
      imgKey: finalKeys,
      // Update URL handle if provided
      url_handle: urlHandle ?? null,
    })
    .where(eq(dbProduct.id, productId))
    .returning({ returnId: dbProduct.id });

  console.log("Product updated:", result);
  return JSON.stringify(result);
};

// Create a new product category
export const createCategory = async (input: CategoryInput) => {
  // Verify user is authenticated
  const user = await auth();
  if (!user.userId) throw new Error("Unauthorized");

  // Validate input using Zod schema
  const validated = categorySchema.parse(input);

  const result = await db
    .insert(product_category)
    .values({
      name: validated.name,
      description: validated.description ?? "",
    })
    .returning({ id: product_category.id, name: product_category.name });

  return result[0];
};

// Update an existing product category
export const updateCategory = async (id: number, input: CategoryInput) => {
  // Verify user is authenticated
  const user = await auth();
  if (!user.userId) throw new Error("Unauthorized");

  // Validate input using Zod schema
  const validated = categorySchema.parse(input);

  // Verify category exists
  const existing = await db.query.product_category.findFirst({
    where: (model, { eq }) => eq(model.id, id),
  });
  if (!existing) throw new Error("Category not found");

  const result = await db
    .update(product_category)
    .set({
      name: validated.name,
      description: validated.description ?? "",
    })
    .where(eq(product_category.id, id))
    .returning({ id: product_category.id, name: product_category.name });

  return result[0];
};

// Delete a product category and set affected products' category_id to null
export const deleteCategory = async (id: number) => {
  // Verify user is authenticated
  const user = await auth();
  if (!user.userId) throw new Error("Unauthorized");

  // Verify category exists
  const existing = await db.query.product_category.findFirst({
    where: (model, { eq }) => eq(model.id, id),
  });
  if (!existing) throw new Error("Category not found");

  // Set category_id to null for all products in this category
  await db
    .update(dbProduct)
    .set({ category_id: null })
    .where(eq(dbProduct.category_id, id));

  // Delete the category
  await db.delete(product_category).where(eq(product_category.id, id));

  return { success: true, deletedId: id };
};

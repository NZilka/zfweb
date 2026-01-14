"use server";

import { db } from "~/server/db";
import { product as dbProduct } from "~/server/db/schema";
import { type ProductType } from "~/app/_context/ProductContext";
import { auth } from "@clerk/nextjs/server";
import { utapi } from "~/server/uploadthing";
import { eq } from "drizzle-orm";

// Create a new product with images
export const addProduct = async (
  product: ProductType,
  urls: string[] | undefined,
  keys: string[] | undefined,
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
    })
    .returning({ returnId: dbProduct.id });

  return JSON.stringify(result);
};

// Image changes structure for update operations
interface ImageChanges {
  keepKeys: string[];    // Existing image keys to retain (in NEW order from client)
  keepUrls: string[];    // Existing image URLs to retain (in NEW order from client)
  removeKeys: string[];  // Existing image keys to delete from UploadThing
  newUrls: string[];     // URLs from newly uploaded images
  newKeys: string[];     // Keys from newly uploaded images
}

// Update an existing product with support for image changes
export const updateProduct = async (
  productId: number,
  product: ProductType,
  imageChanges: ImageChanges,
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

  // Build final image arrays using client's order (keepUrls/keepKeys already in correct order)
  // Then append new uploads at the end
  const finalUrls: string[] = [...imageChanges.keepUrls, ...imageChanges.newUrls];
  const finalKeys: string[] = [...imageChanges.keepKeys, ...imageChanges.newKeys];

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
    })
    .where(eq(dbProduct.id, productId))
    .returning({ returnId: dbProduct.id });

  console.log("Product updated:", result);
  return JSON.stringify(result);
};

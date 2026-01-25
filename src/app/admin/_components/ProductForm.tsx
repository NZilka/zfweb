"use client";

import { useState, useEffect, useRef } from "react";
import { addProduct, updateProduct } from "./db_connect";
import { useProduct, type ProductType } from "~/app/_context/ProductContext";
import { useUploadThing } from "~/utils/uploadthing";
import { useRouter } from "next/navigation";
import { useEditImage } from "~/app/_context/EditImageContext";
import ImageSlot from "./ImageSlot";

// Error type for form validation
export type ErrorType = {
  message: string;
};

// Category type for dropdown
export type CategoryType = {
  id: number;
  name: string;
  description: string;
};

// Props for ProductForm - supports both create and edit modes
interface ProductFormProps {
  mode?: "create" | "edit";           // Form mode (default: create)
  categories?: CategoryType[];        // Available categories for dropdown
  initialImageUrls?: string[];        // Existing image URLs (edit mode)
  initialImageKeys?: string[];        // Existing image keys (edit mode)
  onCancel?: () => void;              // Cancel callback (edit mode)
  onSuccess?: () => void;             // Success callback after save
}

export const ProductForm = ({
  mode = "create",
  categories = [],
  initialImageUrls = [],
  initialImageKeys = [],
  onCancel,
  onSuccess,
}: ProductFormProps) => {
  const { product, setProduct, resetProduct } = useProduct();
  const [errors, setErrors] = useState<ErrorType>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const $ut = useUploadThing("imageUploader");
  const router = useRouter();

  // Image context is required - component must be wrapped in EditImageProvider
  const { displaySlotCount, getImageChanges, reset: resetImages, initializeFromProduct } = useEditImage();

  // Track if images have been initialized to prevent re-initialization on every render.
  // Using a ref instead of adding initializeFromProduct to deps avoids infinite loops
  // since initializeFromProduct is not memoized in the context provider.
  const hasInitializedImages = useRef(false);

  // Initialize image slots from existing product data in edit mode.
  // Only runs once when entering edit mode with images.
  useEffect(() => {
    if (mode === "edit" && initialImageUrls.length > 0 && !hasInitializedImages.current) {
      initializeFromProduct(initialImageUrls, initialImageKeys);
      hasInitializedImages.current = true;
    }
    // Reset the flag when switching to create mode so it can re-initialize if needed
    if (mode === "create") {
      hasInitializedImages.current = false;
    }
  }, [mode, initialImageUrls, initialImageKeys, initializeFromProduct]);

  const handleErrors = (error: ErrorType) => {
    setErrors(error);
  };

  // Clear form state
  const clearForm = () => {
    resetProduct();
    resetImages();
    router.refresh();
  };

  // Upload new files to UploadThing
  const handleImageUpload = async (filesToUpload: File[]) => {
    if (filesToUpload.length === 0) return [];
    console.log("Uploading files:", filesToUpload.map(f => f.name));
    const result = await $ut.startUpload(filesToUpload);
    console.log("Upload result:", result);
    return result ?? [];
  };

  // Handle form submission for both create and edit modes
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Get image data from context (works for both create and edit)
      const imageChanges = getImageChanges();

      // Upload any new files
      const uploadResult = await handleImageUpload(imageChanges.newFiles);
      const newUrls = uploadResult.map(r => r.url).filter(Boolean);
      const newKeys = uploadResult.map(r => r.key).filter(Boolean);

      if (mode === "create") {
        // CREATE MODE: Create product with uploaded images
        console.log("Creating product with urls:", newUrls);
        const newProduct = await addProduct(product, newUrls, newKeys);
        console.log("Product created:", newProduct);
        clearForm();
      } else {
        // EDIT MODE: Update product with image changes
        if (!product.id) {
          throw new Error("Product ID required for edit mode");
        }

        console.log("Updating product:", product.id);
        console.log("Image changes:", { ...imageChanges, newUrls, newKeys });

        // Call update server action with orderedImages to preserve interleaved order
        // when new images are dragged among existing ones
        await updateProduct(product.id, product, {
          keepUrls: imageChanges.keepUrls,
          keepKeys: imageChanges.keepKeys,
          removeKeys: imageChanges.removeKeys,
          newUrls,
          newKeys,
          orderedImages: imageChanges.orderedImages,
        });

        console.log("Product updated successfully");
        onSuccess?.();
        router.refresh();
      }
    } catch (err: any) {
      console.error("Error saving product:", err);
      handleErrors({ message: err.message ?? "Failed to save product" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel in edit mode
  const handleCancel = () => {
    clearForm();
    onCancel?.();
  };

  // Generate slot indices based on displaySlotCount (dynamic 1-5)
  const slotIndices = Array.from({ length: displaySlotCount }, (_, i) => i);

  return (
    <div className="flex flex-col gap-4">
      {/* Dynamic image slots - drag to reorder, click to add/replace */}
      <div className="flex flex-wrap items-center justify-center gap-4 p-4">
        {slotIndices.map((index) => (
          <ImageSlot key={index} index={index} />
        ))}
      </div>
      {/* Instructions use muted foreground color */}
      <p className="text-center text-sm text-muted-foreground">
        Drag images to reorder. Click + to add (max 5).
      </p>

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4">
          {/* Title field - uses theme input colors */}
          <div>
            <label>Title: </label>
            <input
              className="rounded border border-input bg-background px-2 py-1 text-foreground"
              type="text"
              value={product.title}
              onChange={(e) =>
                setProduct({ ...product, title: e.target.value })
              }
              required
            />
          </div>

          {/* Price field - uses theme input colors */}
          <div>
            <label>Price: </label>
            <input
              className="rounded border border-input bg-background px-2 py-1 text-foreground"
              type="number"
              step="0.01"
              min="0"
              value={product.price}
              onChange={(e) =>
                setProduct({ ...product, price: Number(e.target.value) })
              }
              required
            />
          </div>

          {/* Description field - uses theme input colors */}
          <div>
            <label>Description: </label>
            <input
              className="rounded border border-input bg-background px-2 py-1 text-foreground"
              type="text"
              value={product.description}
              onChange={(e) =>
                setProduct({ ...product, description: e.target.value })
              }
              required
            />
          </div>

          {/* Inventory field - uses theme input colors */}
          <div>
            <label>Inventory: </label>
            <input
              className="rounded border border-input bg-background px-2 py-1 text-foreground"
              type="number"
              min="0"
              value={product.inventory}
              onChange={(e) =>
                setProduct({
                  ...product,
                  inventory: Number(e.target.value),
                })
              }
              required
            />
          </div>

          {/* SKU field - optional, uses theme input colors */}
          <div>
            <label>SKU: </label>
            <input
              className="rounded border border-input bg-background px-2 py-1 text-foreground placeholder:text-muted-foreground"
              type="text"
              value={product.sku ?? ""}
              onChange={(e) =>
                setProduct({ ...product, sku: e.target.value || undefined })
              }
              placeholder="Optional"
            />
          </div>

          {/* Category dropdown - optional, uses theme input colors */}
          <div>
            <label>Category: </label>
            <select
              className="rounded border border-input bg-background px-2 py-1 text-foreground"
              value={product.category_id ?? ""}
              onChange={(e) =>
                setProduct({
                  ...product,
                  category_id: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            >
              <option value="">No Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Error display */}
          {errors && (
            <div className="text-red-500">
              Error: {errors.message}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {isSubmitting
                ? "Saving..."
                : mode === "create"
                  ? "Create Product"
                  : "Save Changes"}
            </button>

            {/* Cancel button only shown in edit mode - uses secondary theme colors */}
            {mode === "edit" && onCancel && (
              <button
                type="button"
                onClick={handleCancel}
                className="rounded bg-secondary px-4 py-2 text-secondary-foreground hover:bg-secondary/80"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

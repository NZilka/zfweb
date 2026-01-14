"use client";

import { useState, useEffect } from "react";
import { addProduct, updateProduct } from "./db_connect";
import { useProduct, type ProductType } from "~/app/_context/ProductContext";
import { useImageUpload } from "~/app/_context/ImgUploadContext";
import FileSelector from "./FileSelector";
import { useFile } from "~/app/_context/FileContext";
import { useUploadThing } from "~/utils/uploadthing";
import { useRouter } from "next/navigation";
import { useEditImage } from "~/app/_context/EditImageContext";

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
  const { imgUpload, setImgUpload } = useImageUpload();
  const { files, setFiles } = useFile();
  const [errors, setErrors] = useState<ErrorType>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const $ut = useUploadThing("imageUploader");
  const router = useRouter();

  // Try to get edit image context (only available in edit mode with provider)
  let editImageContext: ReturnType<typeof useEditImage> | null = null;
  try {
    editImageContext = useEditImage();
  } catch {
    // Not in edit mode or provider not available
  }

  // Initialize image slots from existing product data in edit mode
  useEffect(() => {
    if (mode === "edit" && editImageContext && initialImageUrls.length > 0) {
      editImageContext.initializeFromProduct(initialImageUrls, initialImageKeys);
    }
  }, [mode, initialImageUrls.length]);

  const handleErrors = (error: ErrorType) => {
    setErrors(error);
  };

  // Clear form state (create mode) or reset to initial (edit mode)
  const clearForm = () => {
    resetProduct();
    setImgUpload({ path1: "", path2: "", path3: "" });
    setFiles({ file1: undefined, file2: undefined, file3: undefined });
    if (editImageContext) {
      editImageContext.resetSlots();
    }
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
      if (mode === "create") {
        // CREATE MODE: Upload all new files and create product
        const selectedFiles = [files.file1, files.file2, files.file3].filter(
          (f): f is File => !!f,
        );
        const uploadResult = await handleImageUpload(selectedFiles);
        const urls = uploadResult.map(r => r.url).filter(Boolean);
        const keys = uploadResult.map(r => r.key).filter(Boolean);

        console.log("Creating product with urls:", urls);
        const newProduct = await addProduct(product, urls, keys);
        console.log("Product created:", newProduct);
        clearForm();
      } else {
        // EDIT MODE: Handle image changes and update product
        if (!product.id) {
          throw new Error("Product ID required for edit mode");
        }

        // Get image changes from context
        const imageChanges = editImageContext?.getImageChanges() ?? {
          keepUrls: [],
          keepKeys: [],
          removeKeys: [],
          newFiles: [],
        };

        // Upload any new files
        const uploadResult = await handleImageUpload(imageChanges.newFiles);
        const newUrls = uploadResult.map(r => r.url).filter(Boolean);
        const newKeys = uploadResult.map(r => r.key).filter(Boolean);

        console.log("Updating product:", product.id);
        console.log("Image changes:", { ...imageChanges, newUrls, newKeys });

        // Call update server action
        await updateProduct(product.id, product, {
          keepKeys: imageChanges.keepKeys,
          removeKeys: imageChanges.removeKeys,
          newUrls,
          newKeys,
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

  return (
    <div className="flex flex-col gap-4">
      {/* Image selectors - pass mode for different behavior */}
      <div className="flex items-center justify-center gap-4 p-4">
        <FileSelector
          num="1"
          mode={mode}
          existingUrl={initialImageUrls[0]}
          existingKey={initialImageKeys[0]}
        />
        <FileSelector
          num="2"
          mode={mode}
          existingUrl={initialImageUrls[1]}
          existingKey={initialImageKeys[1]}
        />
        <FileSelector
          num="3"
          mode={mode}
          existingUrl={initialImageUrls[2]}
          existingKey={initialImageKeys[2]}
        />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4">
          {/* Title field */}
          <div>
            <label>Title: </label>
            <input
              className="text-black"
              type="text"
              value={product.title}
              onChange={(e) =>
                setProduct({ ...product, title: e.target.value })
              }
              required
            />
          </div>

          {/* Price field */}
          <div>
            <label>Price: </label>
            <input
              className="text-black"
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

          {/* Description field */}
          <div>
            <label>Description: </label>
            <input
              className="text-black"
              type="text"
              value={product.description}
              onChange={(e) =>
                setProduct({ ...product, description: e.target.value })
              }
              required
            />
          </div>

          {/* Inventory field */}
          <div>
            <label>Inventory: </label>
            <input
              className="text-black"
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

          {/* SKU field - optional */}
          <div>
            <label>SKU: </label>
            <input
              className="text-black"
              type="text"
              value={product.sku ?? ""}
              onChange={(e) =>
                setProduct({ ...product, sku: e.target.value || undefined })
              }
              placeholder="Optional"
            />
          </div>

          {/* Category dropdown - optional */}
          <div>
            <label>Category: </label>
            <select
              className="text-black"
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

            {/* Cancel button only shown in edit mode */}
            {mode === "edit" && onCancel && (
              <button
                type="button"
                onClick={handleCancel}
                className="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
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

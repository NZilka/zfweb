/**
 * ProductEditForm - Full product edit form with two-column layout
 * Left column: Image gallery, product info, price/stock, categories
 * Right column: Status sidebar with status dropdown and on-sale toggle
 */
"use client";

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useRouter } from "next/navigation";
import { useProduct } from "~/app/_context/ProductContext";
import { useEditImage } from "~/app/_context/EditImageContext";
import { useUploadThing } from "~/utils/uploadthing";
import { addProduct, updateProduct, checkUrlHandleExists } from "~/app/admin/_components/db_connect";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toast } from "sonner";
import { ImageGalleryEditor } from "./ImageGalleryEditor";
import { ShippingEditor } from "./ShippingEditor";
import type { ProductData } from "./ProductsClient";
import type { CategoryType } from "~/app/admin/_components/ProductForm";

// Crop entry type matching schema
type CropEntry = {
  croppedArea: { x: number; y: number; width: number; height: number };
  zoom: number;
} | null;

interface ProductEditFormProps {
  mode: "create" | "edit";
  product?: ProductData;
  categories: CategoryType[];
  initialImageUrls: string[];
  initialImageKeys: string[];
  // Initial crop data parallel to urls/keys for image positioning
  initialImageCrops?: CropEntry[];
  onSuccess?: () => void;
  setIsSubmitting: (value: boolean) => void;
  // Callback to notify parent when form validity changes
  setIsFormValid: (value: boolean) => void;
}

// Field-level error state
interface FormErrors {
  title?: string;
  price?: string;
  urlHandle?: string;
  images?: string;
}

// Expose submit method to parent via ref
export interface ProductEditFormHandle {
  submit: () => Promise<void>;
}

/**
 * Two-column form layout with all product fields
 */
export const ProductEditForm = forwardRef<ProductEditFormHandle, ProductEditFormProps>(
  function ProductEditForm(
    {
      mode,
      product,
      categories,
      initialImageUrls,
      initialImageKeys,
      initialImageCrops,
      onSuccess,
      setIsSubmitting,
      setIsFormValid,
    },
    ref
  ) {
    const router = useRouter();
    const { product: formProduct, setProduct } = useProduct();
    const { getImageChanges, initializeFromProduct } = useEditImage();
    const $ut = useUploadThing("imageUploader");

    // Extended form state for new fields (status, on_sale, url_handle)
    const [status, setStatus] = useState(product?.status ?? "active");
    const [onSale, setOnSale] = useState(product?.on_sale ?? false);
    const [urlHandle, setUrlHandle] = useState(product?.url_handle ?? "");

    // Field-level validation errors
    const [errors, setErrors] = useState<FormErrors>({});
    // Track if URL handle is being checked for duplicates
    const [isCheckingUrlHandle, setIsCheckingUrlHandle] = useState(false);

    // Track if images have been initialized
    const hasInitializedImages = useRef(false);

    // Initialize image slots from existing product data in edit mode
    // Passes crop data alongside urls/keys so images render with positioning
    useEffect(() => {
      if (mode === "edit" && initialImageUrls.length > 0 && !hasInitializedImages.current) {
        initializeFromProduct(initialImageUrls, initialImageKeys, initialImageCrops);
        hasInitializedImages.current = true;
      }
      if (mode === "create") {
        hasInitializedImages.current = false;
      }
    }, [mode, initialImageUrls, initialImageKeys, initialImageCrops, initializeFromProduct]);

    // Get current image count for validation
    const imageChanges = getImageChanges();
    const imageCount = imageChanges.keepUrls.length + imageChanges.newFiles.length;

    // Derive form validity from current state and errors
    const isFormValid =
      formProduct.title.trim() !== "" &&
      formProduct.price >= 0 &&
      imageCount > 0 &&
      !errors.title &&
      !errors.price &&
      !errors.urlHandle &&
      !errors.images &&
      !isCheckingUrlHandle;

    // Notify parent when form validity changes
    useEffect(() => {
      setIsFormValid(isFormValid);
    }, [isFormValid, setIsFormValid]);

    // Validate URL handle on blur - check for duplicates
    const handleUrlHandleBlur = async () => {
      const handle = urlHandle.trim();
      if (!handle) {
        // Clear error if empty (will auto-generate on save)
        setErrors((prev) => ({ ...prev, urlHandle: undefined }));
        return;
      }

      setIsCheckingUrlHandle(true);
      try {
        const exists = await checkUrlHandleExists(handle, product?.id);
        if (exists) {
          setErrors((prev) => ({
            ...prev,
            urlHandle: "This URL handle is already in use",
          }));
        } else {
          setErrors((prev) => ({ ...prev, urlHandle: undefined }));
        }
      } catch (err) {
        console.error("Error checking URL handle:", err);
      } finally {
        setIsCheckingUrlHandle(false);
      }
    };

    // Validate title on change
    const handleTitleChange = (value: string) => {
      setProduct({ ...formProduct, title: value });
      if (!value.trim()) {
        setErrors((prev) => ({ ...prev, title: "Product name is required" }));
      } else {
        setErrors((prev) => ({ ...prev, title: undefined }));
      }
    };

    // Validate price on change
    const handlePriceChange = (value: number) => {
      setProduct({ ...formProduct, price: value });
      if (value < 0) {
        setErrors((prev) => ({ ...prev, price: "Price must be 0 or greater" }));
      } else {
        setErrors((prev) => ({ ...prev, price: undefined }));
      }
    };

    // Upload new files to UploadThing. Throws on any failure so the caller
    // can abort the form submit before writing a product row to the DB
    // (otherwise an orphan product with no images would be created and the
    // user would only see a generic "no images" UI state).
    const handleImageUpload = async (filesToUpload: File[]) => {
      if (filesToUpload.length === 0) return [];
      let result;
      try {
        result = await $ut.startUpload(filesToUpload);
      } catch (err: any) {
        // Newer UT versions throw network/SDK errors here
        throw new Error(
          `Image upload failed: ${err?.message ?? "unknown error"}`,
        );
      }
      if (!result) {
        // Older UT versions return undefined on failure without throwing
        throw new Error(
          "Image upload failed — no response from UploadThing. Check that UPLOADTHING_TOKEN is configured correctly.",
        );
      }
      if (result.length !== filesToUpload.length) {
        throw new Error(
          `Image upload partially failed (${result.length}/${filesToUpload.length} succeeded).`,
        );
      }
      // Defensive: every result must have both url and key
      const broken = result.findIndex((r) => !r?.url || !r?.key);
      if (broken !== -1) {
        throw new Error(
          `Image upload returned incomplete data for file ${broken + 1}.`,
        );
      }
      return result;
    };

    // Handle form submission
    const handleSubmit = async () => {
      setIsSubmitting(true);

      try {
        // Validate required fields
        if (!formProduct.title.trim()) {
          throw new Error("Product name is required");
        }
        if (formProduct.price < 0) {
          throw new Error("Price must be non-negative");
        }

        // Auto-generate URL handle from title if empty
        const finalUrlHandle = urlHandle.trim() || formProduct.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        // Get image data from context
        const imageChanges = getImageChanges();

        // Upload any new files. handleImageUpload throws on any failure, so
        // a throw here aborts the form submit before addProduct/updateProduct
        // runs. No .filter(Boolean) needed — the helper validates each entry
        // has both url and key.
        const uploadResult = await handleImageUpload(imageChanges.newFiles);
        const newUrls = uploadResult.map((r) => r.url);
        const newKeys = uploadResult.map((r) => r.key);

        if (mode === "create") {
          // CREATE MODE: Create product with uploaded images + crop data
          // Build crops array parallel to urls: new images use newCrops
          await addProduct(
            formProduct,
            newUrls,
            newKeys,
            finalUrlHandle,
            imageChanges.newCrops,
          );
          toast.success("Product created");
        } else {
          // EDIT MODE: Update product with image changes + crop data
          if (!formProduct.id) {
            throw new Error("Product ID required for edit mode");
          }

          await updateProduct(formProduct.id, formProduct, {
            keepUrls: imageChanges.keepUrls,
            keepKeys: imageChanges.keepKeys,
            removeKeys: imageChanges.removeKeys,
            newUrls,
            newKeys,
            orderedImages: imageChanges.orderedImages,
            keepCrops: imageChanges.keepCrops,
            newCrops: imageChanges.newCrops,
          }, finalUrlHandle);
          toast.success("Product updated");
        }

        onSuccess?.();
      } catch (err: any) {
        console.error("Error saving product:", err);
        toast.error(err.message ?? "Failed to save product");
      } finally {
        setIsSubmitting(false);
      }
    };

    // Expose submit method to parent component via ref
    useImperativeHandle(ref, () => ({
      submit: handleSubmit,
    }));

    // Generate URL handle from title (auto-slug)
    const generateUrlHandle = () => {
      const slug = formProduct.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      setUrlHandle(slug);
    };

    return (
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 p-4 lg:p-6">
        {/* Left Column - Main form content (full width on mobile) */}
        <div className="flex-1 space-y-4 lg:space-y-6">
          {/* Image Gallery Section */}
          <section className={`rounded-lg border bg-white p-4 ${imageCount === 0 ? "border-red-300" : ""}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Image gallery</h3>
              <ImageGalleryEditor />
            </div>
            {/* Show error if no images */}
            {imageCount === 0 && (
              <p className="text-sm text-red-600">At least one image is required</p>
            )}
          </section>

          {/* Product Info Section */}
          <section className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Product info</h3>
            <div className="space-y-4">
              {/* Product Name */}
              <div>
                <Label htmlFor="product-name" className="text-gray-700">
                  Product name
                </Label>
                <Input
                  id="product-name"
                  value={formProduct.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Enter product name"
                  className={`mt-1 bg-white text-gray-900 ${errors.title ? "border-red-300" : ""}`}
                  required
                />
                {/* Show error if title is empty */}
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">{errors.title}</p>
                )}
              </div>

              {/* URL Handle */}
              <div>
                <Label htmlFor="url-handle" className="text-gray-700">
                  URL handle
                </Label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm text-gray-500">/product/</span>
                  <Input
                    id="url-handle"
                    value={urlHandle}
                    onChange={(e) => {
                      setUrlHandle(e.target.value);
                      // Clear error when user starts typing again
                      if (errors.urlHandle) {
                        setErrors((prev) => ({ ...prev, urlHandle: undefined }));
                      }
                    }}
                    // Check for duplicates when user leaves the field
                    onBlur={handleUrlHandleBlur}
                    placeholder="product-url-slug"
                    className={`flex-1 bg-white text-gray-900 ${errors.urlHandle ? "border-red-300" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={generateUrlHandle}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Generate
                  </button>
                </div>
                {/* Show checking indicator or error */}
                {isCheckingUrlHandle && (
                  <p className="mt-1 text-sm text-gray-500">Checking availability...</p>
                )}
                {errors.urlHandle && (
                  <p className="mt-1 text-sm text-red-600">{errors.urlHandle}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description" className="text-gray-700">
                  Description
                </Label>
                <textarea
                  id="description"
                  value={formProduct.description}
                  onChange={(e) =>
                    setProduct({ ...formProduct, description: e.target.value })
                  }
                  placeholder="Enter product description"
                  rows={4}
                  className="mt-1 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                />
              </div>
            </div>
          </section>

          {/* Price and Stock Section */}
          <section className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Price and stock</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Price */}
              <div>
                <Label htmlFor="price" className="text-gray-700">
                  Price
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formProduct.price}
                    onChange={(e) => handlePriceChange(Number(e.target.value))}
                    // Auto-select value on focus so typing replaces the default 0
                    onFocus={(e) => e.target.select()}
                    className={`pl-7 bg-white text-gray-900 ${errors.price ? "border-red-300" : ""}`}
                    required
                  />
                </div>
                {/* Show error if price is invalid */}
                {errors.price && (
                  <p className="mt-1 text-sm text-red-600">{errors.price}</p>
                )}
              </div>

              {/* Stock */}
              <div>
                <Label htmlFor="stock" className="text-gray-700">
                  Stock
                </Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  value={formProduct.inventory}
                  onChange={(e) =>
                    setProduct({
                      ...formProduct,
                      inventory: Number(e.target.value),
                    })
                  }
                  // Auto-select value on focus so typing replaces the default 0
                  onFocus={(e) => e.target.select()}
                  className="mt-1 bg-white text-gray-900"
                  required
                />
              </div>

              {/* SKU */}
              <div className="col-span-2">
                <Label htmlFor="sku" className="text-gray-700">
                  SKU (optional)
                </Label>
                <Input
                  id="sku"
                  value={formProduct.sku ?? ""}
                  onChange={(e) =>
                    setProduct({
                      ...formProduct,
                      sku: e.target.value || undefined,
                    })
                  }
                  placeholder="Stock keeping unit"
                  className="mt-1 bg-white text-gray-900"
                />
              </div>
            </div>
          </section>

          {/* Shipping Section - displays available shipping zones and rates */}
          <section className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Shipping</h3>
            <ShippingEditor />
          </section>

          {/* Categories Section */}
          <section className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Categories</h3>
            <Select
              value={formProduct.category_id ? String(formProduct.category_id) : "none"}
              onValueChange={(value) =>
                setProduct({
                  ...formProduct,
                  category_id: value === "none" ? undefined : Number(value),
                })
              }
            >
              <SelectTrigger className="bg-white text-gray-900">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>
        </div>

        {/* Right Column - Status Sidebar (full width on mobile, fixed width on desktop) */}
        <div className="w-full lg:w-64 shrink-0 space-y-4 lg:space-y-6">
          {/* Status Section */}
          <section className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Status</h3>
            <div className="space-y-4">
              {/* Status Dropdown */}
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-white text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="sold_out">Sold Out</SelectItem>
                  <SelectItem value="hidden">Hidden</SelectItem>
                </SelectContent>
              </Select>

              {/* On Sale Checkbox */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="on-sale"
                  checked={onSale}
                  onCheckedChange={(checked) => setOnSale(checked === true)}
                />
                <Label htmlFor="on-sale" className="text-gray-700 cursor-pointer">
                  On sale
                </Label>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }
);

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
import { addProduct, updateProduct } from "~/app/admin/_components/db_connect";
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

interface ProductEditFormProps {
  mode: "create" | "edit";
  product?: ProductData;
  categories: CategoryType[];
  initialImageUrls: string[];
  initialImageKeys: string[];
  onSuccess?: () => void;
  setIsSubmitting: (value: boolean) => void;
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
      onSuccess,
      setIsSubmitting,
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

    // Track if images have been initialized
    const hasInitializedImages = useRef(false);

    // Initialize image slots from existing product data in edit mode
    useEffect(() => {
      if (mode === "edit" && initialImageUrls.length > 0 && !hasInitializedImages.current) {
        initializeFromProduct(initialImageUrls, initialImageKeys);
        hasInitializedImages.current = true;
      }
      if (mode === "create") {
        hasInitializedImages.current = false;
      }
    }, [mode, initialImageUrls, initialImageKeys, initializeFromProduct]);

    // Upload new files to UploadThing
    const handleImageUpload = async (filesToUpload: File[]) => {
      if (filesToUpload.length === 0) return [];
      const result = await $ut.startUpload(filesToUpload);
      return result ?? [];
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

        // Get image data from context
        const imageChanges = getImageChanges();

        // Upload any new files
        const uploadResult = await handleImageUpload(imageChanges.newFiles);
        const newUrls = uploadResult.map((r) => r.url).filter(Boolean);
        const newKeys = uploadResult.map((r) => r.key).filter(Boolean);

        if (mode === "create") {
          // CREATE MODE: Create product with uploaded images
          await addProduct(formProduct, newUrls, newKeys);
          toast.success("Product created");
        } else {
          // EDIT MODE: Update product with image changes
          if (!formProduct.id) {
            throw new Error("Product ID required for edit mode");
          }

          // Note: status, on_sale, url_handle updates would require extending
          // the updateProduct server action. For now, we update core fields.
          await updateProduct(formProduct.id, formProduct, {
            keepUrls: imageChanges.keepUrls,
            keepKeys: imageChanges.keepKeys,
            removeKeys: imageChanges.removeKeys,
            newUrls,
            newKeys,
            orderedImages: imageChanges.orderedImages,
          });
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
          <section className="rounded-lg border bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Image gallery</h3>
              <ImageGalleryEditor />
            </div>
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
                  onChange={(e) =>
                    setProduct({ ...formProduct, title: e.target.value })
                  }
                  placeholder="Enter product name"
                  className="mt-1 bg-white text-gray-900"
                  required
                />
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
                    onChange={(e) => setUrlHandle(e.target.value)}
                    placeholder="product-url-slug"
                    className="flex-1 bg-white text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={generateUrlHandle}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Generate
                  </button>
                </div>
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
                    onChange={(e) =>
                      setProduct({
                        ...formProduct,
                        price: Number(e.target.value),
                      })
                    }
                    className="pl-7 bg-white text-gray-900"
                    required
                  />
                </div>
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

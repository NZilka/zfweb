/**
 * ProductEditModal - Full-featured product edit modal
 * Two-column layout with image gallery, form fields, and status sidebar
 */
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Copy, Trash2, Save, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "~/components/ui/dialog";
import { toast } from "sonner";
import { ProductProvider, type ProductType } from "~/app/_context/ProductContext";
import { EditImageProvider } from "~/app/_context/EditImageContext";
import { ProductEditForm } from "./ProductEditForm";
import { deleteProductAction } from "~/app/admin/_components/deleteAction";
import { addProduct, updateProduct } from "~/app/admin/_components/db_connect";
import { useUploadThing } from "~/utils/uploadthing";
import type { ProductData } from "./ProductsClient";
import type { CategoryType } from "~/app/admin/_components/ProductForm";

interface ProductEditModalProps {
  // Modal open state
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  // Product to edit (undefined = create mode)
  product?: ProductData;
  // Categories for dropdown
  categories: CategoryType[];
  // Callback after successful save
  onSuccess?: () => void;
}

/**
 * Main edit modal component with header actions and two-column layout
 */
export function ProductEditModal({
  isOpen,
  onOpenChange,
  product,
  categories,
  onSuccess,
}: ProductEditModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Ref to access form submission from header buttons
  const formRef = useRef<{ submit: () => Promise<void> } | null>(null);

  // Determine if we're in edit or create mode
  const isEditMode = !!product;
  const modalTitle = isEditMode ? "Edit Product" : "Create Product";

  // Convert ProductData to ProductType for context
  const getInitialProduct = (p: ProductData): ProductType => ({
    id: p.id,
    title: p.title,
    description: p.description,
    price: parseFloat(p.price),
    inventory: p.inventory,
    sku: p.sku ?? undefined,
    category_id: p.category_id ?? undefined,
  });

  // Handle Preview button - opens product page in new tab
  const handlePreview = () => {
    if (product?.url_handle) {
      window.open(`/shop/product/${product.url_handle}`, "_blank");
    } else if (product?.id) {
      window.open(`/shop/product/${product.id}`, "_blank");
    } else {
      toast.error("Save the product first to preview");
    }
  };

  // Handle Duplicate button - creates a copy of the product
  const handleDuplicate = async () => {
    if (!product) return;

    try {
      setIsSubmitting(true);
      // Create a new product with "(Copy)" suffix
      const duplicateProduct: ProductType = {
        title: `${product.title} (Copy)`,
        description: product.description,
        price: parseFloat(product.price),
        inventory: product.inventory,
        sku: product.sku ? `${product.sku}-copy` : undefined,
        category_id: product.category_id ?? undefined,
      };

      // Copy images from original product
      await addProduct(duplicateProduct, product.imgUrl, product.imgKey);
      toast.success("Product duplicated");
      onOpenChange(false);
      router.refresh();
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to duplicate product");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete button - confirms and deletes product
  const handleDelete = async () => {
    if (!product) return;

    if (!confirm(`Are you sure you want to delete "${product.title}"?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      await deleteProductAction(product.id);
      toast.success("Product deleted");
      onOpenChange(false);
      router.refresh();
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to delete product");
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Save button - triggers form submission
  const handleSave = async () => {
    if (formRef.current) {
      await formRef.current.submit();
    }
  };

  // Handle successful form submission
  const handleFormSuccess = () => {
    onOpenChange(false);
    router.refresh();
    onSuccess?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-5xl max-h-[90vh] overflow-hidden p-0">
        {/* Accessible title for screen readers - visually hidden */}
        <DialogTitle className="sr-only">{modalTitle}</DialogTitle>

        {/* Modal Header with action buttons - stacks on mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b px-4 sm:px-6 py-3 sm:py-4">
          {/* Left side: Back arrow and title */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="p-1"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="text-base sm:text-lg font-semibold">{modalTitle}</span>
          </div>

          {/* Right side: Action buttons - wrap on mobile */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Preview - only in edit mode */}
            {isEditMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreview}
                className="gap-1"
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
            )}

            {/* Duplicate - only in edit mode */}
            {isEditMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDuplicate}
                disabled={isSubmitting}
                className="gap-1"
              >
                <Copy className="h-4 w-4" />
                Duplicate
              </Button>
            )}

            {/* Delete - only in edit mode */}
            {isEditMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete
              </Button>
            )}

            {/* Save button */}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSubmitting}
              className="gap-1"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </div>

        {/* Modal Body - scrollable content area */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Key forces re-mount when switching products for fresh context state */}
          <EditImageProvider key={product?.id ?? "create"}>
            <ProductProvider
              initialProduct={product ? getInitialProduct(product) : undefined}
            >
              <ProductEditForm
                ref={formRef}
                mode={isEditMode ? "edit" : "create"}
                product={product}
                categories={categories}
                initialImageUrls={product?.imgUrl ?? []}
                initialImageKeys={product?.imgKey ?? []}
                onSuccess={handleFormSuccess}
                setIsSubmitting={setIsSubmitting}
              />
            </ProductProvider>
          </EditImageProvider>
        </div>
      </DialogContent>
    </Dialog>
  );
}

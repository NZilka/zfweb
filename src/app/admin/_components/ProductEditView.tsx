"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProductForm, type CategoryType } from "./ProductForm";
import { Button } from "~/components/ui/button";
import { FileProvider } from "~/app/_context/FileContext";
import { ProductProvider, type ProductType } from "~/app/_context/ProductContext";
import { ImgUploadProvider } from "~/app/_context/ImgUploadContext";
import { EditImageProvider } from "~/app/_context/EditImageContext";
import { deleteProductAction } from "./deleteAction";

// Product data type from database
interface ProductData {
  id: number;
  title: string;
  description: string;
  price: string;           // Decimal stored as string
  inventory: number;
  sku: string | null;
  category_id: number | null;
  imgUrl: string[];
  imgKey: string[];
  createdAt: Date;
  updatedAt: Date | null;
}

interface ProductEditViewProps {
  product: ProductData;
  categories?: CategoryType[];
}

// Client component that handles view/edit toggle for a product
// Wraps ProductForm with necessary context providers when in edit mode
export default function ProductEditView({ product, categories = [] }: ProductEditViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();

  // Convert database product to form-compatible ProductType
  const initialProduct: ProductType = {
    id: product.id,
    title: product.title,
    description: product.description,
    price: parseFloat(product.price),
    inventory: product.inventory,
    sku: product.sku ?? undefined,
    category_id: product.category_id ?? undefined,
  };

  // Handle successful edit - exit edit mode
  const handleEditSuccess = () => {
    setIsEditing(false);
    router.refresh();
  };

  // Handle edit cancel - exit edit mode without saving
  const handleEditCancel = () => {
    setIsEditing(false);
  };

  // Create bound delete action for form submission
  const boundDeleteAction = deleteProductAction.bind(null, product.id);

  // EDIT MODE: Render form with all context providers
  if (isEditing) {
    return (
      <div className="flex h-full w-full flex-col p-4">
        <h2 className="mb-4 text-xl font-bold">Edit Product</h2>
        {/* Wrap form with all required context providers */}
        <FileProvider>
          <EditImageProvider>
            <ProductProvider initialProduct={initialProduct}>
              <ImgUploadProvider>
                <ProductForm
                  mode="edit"
                  categories={categories}
                  initialImageUrls={product.imgUrl}
                  initialImageKeys={product.imgKey}
                  onCancel={handleEditCancel}
                  onSuccess={handleEditSuccess}
                />
              </ImgUploadProvider>
            </ProductProvider>
          </EditImageProvider>
        </FileProvider>
      </div>
    );
  }

  // VIEW MODE: Render read-only product details
  return (
    <div className="flex h-full w-full min-w-0">
      {/* Product image */}
      <div className="flex h-auto w-auto flex-shrink items-center justify-center">
        {product.imgUrl[0] ? (
          <img
            src={product.imgUrl[0]}
            alt={`Product ${product.id}`}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center bg-gray-700 text-gray-400">
            No Image
          </div>
        )}
      </div>

      {/* Product details sidebar */}
      <div className="flex w-48 flex-shrink-0 flex-col border-x border-white">
        {/* Title */}
        <div className="border-b border-white p-2 text-center text-lg">
          {product.title}
        </div>

        {/* Description */}
        <div className="flex flex-col p-2">
          <span className="font-semibold">Description:</span>
          <span>{product.description}</span>
        </div>

        {/* Price */}
        <div className="flex flex-col p-2">
          <span className="font-semibold">Price:</span>
          <span>${product.price}</span>
        </div>

        {/* Inventory */}
        <div className="flex flex-col p-2">
          <span className="font-semibold">Inventory:</span>
          <span>{product.inventory}</span>
        </div>

        {/* SKU (if set) */}
        {product.sku && (
          <div className="flex flex-col p-2">
            <span className="font-semibold">SKU:</span>
            <span>{product.sku}</span>
          </div>
        )}

        {/* Created date */}
        <div className="flex flex-col p-2">
          <span className="font-semibold">Created:</span>
          <span>{new Date(product.createdAt).toLocaleDateString()}</span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 p-2">
          {/* Edit button - toggles to edit mode */}
          <Button
            type="button"
            variant="default"
            onClick={() => setIsEditing(true)}
          >
            Edit
          </Button>

          {/* Delete button - triggers server action with redirect */}
          <form action={boundDeleteAction}>
            <Button type="submit" variant="destructive" className="w-full">
              Delete
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProductForm, type CategoryType } from "./ProductForm";
import { ProductProvider, type ProductType } from "~/app/_context/ProductContext";
import { EditImageProvider } from "~/app/_context/EditImageContext";
import { deleteProductAction } from "./deleteAction";
import { Button } from "~/components/ui/button";
import Image from "next/image";
import CategoryManager from "./CategoryManager";

// Product data type from database
interface ProductData {
  id: number;
  title: string;
  description: string;
  price: string;
  inventory: number;
  sku: string | null;
  category_id: number | null;
  imgUrl: string[];
  imgKey: string[];
  createdAt: Date;
  updatedAt: Date | null;
}

interface AdminPageClientProps {
  products: ProductData[];
  categories: CategoryType[];
}

// Client component that manages the admin page state
// Clicking a product selects it for editing in the form above
export default function AdminPageClient({ products, categories }: AdminPageClientProps) {
  // Track which product is selected for editing (null = create mode)
  const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null);
  const router = useRouter();

  // Convert database product to form-compatible ProductType
  const getInitialProduct = (product: ProductData): ProductType => ({
    id: product.id,
    title: product.title,
    description: product.description,
    price: parseFloat(product.price),
    inventory: product.inventory,
    sku: product.sku ?? undefined,
    category_id: product.category_id ?? undefined,
  });

  // Handle product selection from inventory
  const handleProductSelect = (product: ProductData) => {
    setSelectedProduct(product);
  };

  // Handle successful save - clear selection and refresh
  const handleSaveSuccess = () => {
    setSelectedProduct(null);
    router.refresh();
  };

  // Handle cancel - clear selection
  const handleCancel = () => {
    setSelectedProduct(null);
  };

  // Handle delete - uses server action
  const handleDelete = async () => {
    if (!selectedProduct) return;
    if (confirm("Are you sure you want to delete this product?")) {
      await deleteProductAction(selectedProduct.id);
    }
  };

  // Determine form mode based on selection
  const isEditMode = selectedProduct !== null;

  return (
    <div className="flex w-full flex-col items-center justify-center gap-16">
      <h1 className="text-4xl font-bold">Admin Page</h1>

      {/* Category management section - collapsible */}
      <div className="w-full max-w-2xl">
        <CategoryManager categories={categories} />
      </div>

      {/* Form section - switches between create and edit mode */}
      <div className="w-full max-w-2xl">
        {isEditMode && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Editing: {selectedProduct.title}</h2>
            {/* Delete button in edit mode */}
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        )}

        {/* Wrap form with context providers - key forces re-mount on selection change */}
        <EditImageProvider key={selectedProduct?.id ?? "create"}>
          <ProductProvider
            initialProduct={selectedProduct ? getInitialProduct(selectedProduct) : undefined}
          >
            <ProductForm
              mode={isEditMode ? "edit" : "create"}
              categories={categories}
              initialImageUrls={selectedProduct?.imgUrl ?? []}
              initialImageKeys={selectedProduct?.imgKey ?? []}
              onCancel={isEditMode ? handleCancel : undefined}
              onSuccess={handleSaveSuccess}
            />
          </ProductProvider>
        </EditImageProvider>
      </div>

      {/* Product inventory grid */}
      <div className="w-full">
        <h2 className="mb-4 text-center text-2xl font-semibold">Product Inventory</h2>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              onClick={() => handleProductSelect(product)}
              className={`cursor-pointer rounded-lg p-2 transition-all hover:bg-gray-700 ${
                selectedProduct?.id === product.id ? "ring-2 ring-blue-500 bg-gray-700" : ""
              }`}
            >
              <div className="relative max-w-sm">
                {product.imgUrl[0] ? (
                  <Image
                    src={product.imgUrl[0]}
                    style={{ objectFit: "contain" }}
                    width={192}
                    height={192}
                    alt={`Image ${product.id}`}
                  />
                ) : (
                  <div className="flex h-48 w-48 items-center justify-center bg-gray-600 text-gray-400">
                    No Image
                  </div>
                )}
                <div className="flex flex-col items-center p-5">
                  <h1 className="mb-2 text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                    {product.title}
                  </h1>
                  <p className="mb-3 text-xl font-normal text-gray-700 dark:text-gray-400">
                    ${product.price}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

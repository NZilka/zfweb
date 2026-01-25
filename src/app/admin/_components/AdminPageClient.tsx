"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProductForm, type CategoryType } from "./ProductForm";
import { ProductProvider, type ProductType } from "~/app/_context/ProductContext";
import { EditImageProvider } from "~/app/_context/EditImageContext";
import { deleteProductAction } from "./deleteAction";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { toast } from "sonner";
import Image from "next/image";
import CategoryManager from "./CategoryManager";
import { Plus } from "lucide-react";

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

  // Handle successful save - clear selection, refresh, and show toast
  const handleSaveSuccess = () => {
    const message = selectedProduct ? "Product updated" : "Product created";
    toast.success(message);
    setSelectedProduct(null);
    router.refresh();
  };

  // Handle cancel - clear selection
  const handleCancel = () => {
    setSelectedProduct(null);
  };

  // Handle delete - uses server action with toast notification
  const handleDelete = async () => {
    if (!selectedProduct) return;
    if (confirm("Are you sure you want to delete this product?")) {
      await deleteProductAction(selectedProduct.id);
      toast.success("Product deleted");
      setSelectedProduct(null);
      router.refresh();
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
        <div className="mb-4 flex items-center justify-between px-4">
          <h2 className="text-2xl font-semibold">Product Inventory</h2>
          {/* Add Product button - scrolls to form in create mode */}
          {!isEditMode && (
            <Button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              onClick={() => handleProductSelect(product)}
              // Product card uses theme muted colors for hover/selection states
              className={`cursor-pointer rounded-lg p-2 transition-all hover:bg-muted ${
                selectedProduct?.id === product.id ? "ring-2 ring-primary bg-muted" : ""
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
                  // Placeholder uses muted background and foreground
                  <div className="flex h-48 w-48 items-center justify-center bg-muted text-muted-foreground">
                    No Image
                  </div>
                )}
                {/* Inventory status badge - top right corner */}
                <div className="absolute right-2 top-2">
                  {product.inventory > 0 ? (
                    <Badge variant="default" className="bg-green-600 text-white">
                      In Stock ({product.inventory})
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Sold Out</Badge>
                  )}
                </div>
                <div className="flex flex-col items-center p-5">
                  {/* Title and price use theme foreground colors */}
                  <h1 className="mb-2 text-xl font-bold tracking-tight text-foreground">
                    {product.title}
                  </h1>
                  <p className="mb-1 text-xl font-normal text-muted-foreground">
                    ${product.price}
                  </p>
                  {/* Show SKU if available */}
                  {product.sku && (
                    <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

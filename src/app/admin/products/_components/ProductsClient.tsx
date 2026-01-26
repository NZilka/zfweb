/**
 * ProductsClient - Main client component for admin products page
 * Manages view mode, filters, selection, and edit modal state
 */
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload, Layout } from "lucide-react";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import { ProductsTable } from "./ProductsTable";
import { ProductsGrid } from "./ProductsGrid";
import { ProductFilters } from "./ProductFilters";
import { ViewToggle } from "./ViewToggle";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ProductProvider } from "~/app/_context/ProductContext";
import { EditImageProvider } from "~/app/_context/EditImageContext";
import { ProductForm, type CategoryType } from "~/app/admin/_components/ProductForm";
import { deleteProductAction } from "~/app/admin/_components/deleteAction";
import { filterProducts } from "./filterProducts";

// Product data type from database (matches schema)
export interface ProductData {
  id: number;
  title: string;
  description: string;
  price: string;
  inventory: number;
  sku: string | null;
  category_id: number | null;
  imgUrl: string[];
  imgKey: string[];
  // New fields for redesign
  status: string;
  on_sale: boolean;
  url_handle: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

// View mode type for list/grid toggle
export type ViewMode = "list" | "grid";

// Status filter options
export type StatusFilter = "all" | "active" | "sold_out" | "hidden";

interface ProductsClientProps {
  products: ProductData[];
  categories: CategoryType[];
}

/**
 * Main products admin interface with list/grid views and filtering
 */
export function ProductsClient({ products, categories }: ProductsClientProps) {
  const router = useRouter();

  // View mode state (list vs grid)
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<number | "all">("all");

  // Modal state for create/edit
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductData | undefined>();

  // Selection state for bulk actions (future use)
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());

  // Client-side filtering with useMemo for performance
  // Uses extracted filterProducts function for testability
  const filteredProducts = useMemo(() => {
    return filterProducts(products, {
      searchQuery,
      statusFilter,
      categoryFilter,
    });
  }, [products, searchQuery, statusFilter, categoryFilter]);

  // Open dialog for creating new product
  const handleCreate = () => {
    setEditingProduct(undefined);
    setIsDialogOpen(true);
  };

  // Open dialog for editing existing product
  const handleEdit = (product: ProductData) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  // Handle form success - close dialog and refresh
  const handleSuccess = () => {
    const message = editingProduct ? "Product updated" : "Product created";
    toast.success(message);
    setIsDialogOpen(false);
    setEditingProduct(undefined);
    router.refresh();
  };

  // Handle delete product
  const handleDelete = async (product: ProductData) => {
    if (!confirm(`Are you sure you want to delete "${product.title}"?`)) return;

    await deleteProductAction(product.id);
    toast.success("Product deleted");
    setIsDialogOpen(false);
    setEditingProduct(undefined);
    router.refresh();
  };

  // Handle selection toggle for bulk actions
  const handleSelectProduct = (id: number) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedProducts(newSelected);
  };

  // Handle select all toggle
  const handleSelectAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  // Convert ProductData to ProductType for form context
  const getInitialProduct = (product: ProductData) => ({
    id: product.id,
    title: product.title,
    description: product.description,
    price: parseFloat(product.price),
    inventory: product.inventory,
    sku: product.sku ?? undefined,
    category_id: product.category_id ?? undefined,
  });

  // Get category name by ID for display
  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return null;
    return categories.find((c) => c.id === categoryId)?.name ?? null;
  };

  return (
    <div className="space-y-6">
      {/* Header with title and action buttons */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <div className="flex items-center gap-2">
          {/* Import button - placeholder for future functionality */}
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Import
          </Button>
          {/* Arrange shop button - placeholder for future functionality */}
          <Button variant="outline" className="gap-2">
            <Layout className="h-4 w-4" />
            Arrange shop
          </Button>
          {/* Create product button */}
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters and view toggle row */}
      <div className="flex flex-col gap-4">
        {/* Filter controls */}
        <ProductFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          categories={categories}
        />
        {/* View toggle aligned right */}
        <div className="flex justify-end">
          <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>
      </div>

      {/* Products display - table or grid based on viewMode */}
      {filteredProducts.length === 0 ? (
        // Empty state
        <div className="rounded-lg border border-gray-300 bg-white p-8 text-center">
          <p className="text-gray-500">
            {products.length === 0
              ? "No products yet"
              : "No products match your filters"}
          </p>
          {products.length === 0 && (
            <Button onClick={handleCreate} variant="outline" className="mt-4">
              Create your first product
            </Button>
          )}
        </div>
      ) : viewMode === "list" ? (
        // List view (table)
        <ProductsTable
          products={filteredProducts}
          categories={categories}
          selectedProducts={selectedProducts}
          onSelectProduct={handleSelectProduct}
          onSelectAll={handleSelectAll}
          onEdit={handleEdit}
          getCategoryName={getCategoryName}
        />
      ) : (
        // Grid view (cards)
        <ProductsGrid
          products={filteredProducts}
          onEdit={handleEdit}
          getCategoryName={getCategoryName}
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Product" : "Create Product"}
            </DialogTitle>
          </DialogHeader>
          {/* Key ensures fresh context state when switching products */}
          <EditImageProvider key={editingProduct?.id ?? "create"}>
            <ProductProvider
              initialProduct={editingProduct ? getInitialProduct(editingProduct) : undefined}
            >
              <ProductForm
                mode={editingProduct ? "edit" : "create"}
                categories={categories}
                initialImageUrls={editingProduct?.imgUrl ?? []}
                initialImageKeys={editingProduct?.imgKey ?? []}
                onCancel={() => setIsDialogOpen(false)}
                onSuccess={handleSuccess}
              />
            </ProductProvider>
          </EditImageProvider>
          {/* Delete button shown only in edit mode */}
          {editingProduct && (
            <div className="mt-4 flex justify-end border-t pt-4">
              <Button
                variant="destructive"
                onClick={() => handleDelete(editingProduct)}
              >
                Delete Product
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

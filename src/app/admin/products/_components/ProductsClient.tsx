/**
 * ProductsClient - Main client component for admin products page
 * Manages view mode, filters, selection, drag-and-drop reorder, and edit modal state
 */
"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, Upload, Layout } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "~/components/ui/button";
import { ProductsTable } from "./ProductsTable";
import { ProductsGrid } from "./ProductsGrid";
import { ProductFilters } from "./ProductFilters";
import { ViewToggle } from "./ViewToggle";
import { ProductEditModal } from "./ProductEditModal";
import { updateProductSortOrder } from "~/server/product-actions";
import type { CategoryType } from "~/app/admin/_components/ProductForm";
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
  // Sort order for drag-and-drop reordering
  sort_order: number;
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
 * Main products admin interface with list/grid views, filtering, and drag reorder
 */
export function ProductsClient({ products, categories }: ProductsClientProps) {
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

  // Local product order for optimistic drag-and-drop reordering
  const [orderedProducts, setOrderedProducts] = useState<ProductData[]>(products);
  // Re-sync local order when server products prop changes (edit, delete, revalidation)
  useEffect(() => {
    setOrderedProducts(products);
  }, [products]);

  // dnd-kit sensors — pointer + keyboard for accessibility
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Whether any filters are active — disable drag when filtering
  const hasActiveFilters =
    searchQuery !== "" || statusFilter !== "all" || categoryFilter !== "all";

  // Client-side filtering with useMemo for performance
  // Uses extracted filterProducts function for testability
  const filteredProducts = useMemo(() => {
    return filterProducts(hasActiveFilters ? products : orderedProducts, {
      searchQuery,
      statusFilter,
      categoryFilter,
    });
  }, [products, orderedProducts, searchQuery, statusFilter, categoryFilter, hasActiveFilters]);

  // Handle drag end — optimistic reorder with rollback on server failure
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedProducts.findIndex((p) => p.id === active.id);
    const newIndex = orderedProducts.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Save previous order for rollback, then optimistically apply new order
    const previousOrder = orderedProducts;
    const reordered = arrayMove(orderedProducts, oldIndex, newIndex);
    setOrderedProducts(reordered);

    try {
      await updateProductSortOrder(reordered.map((p) => p.id));
    } catch (error) {
      // Rollback to previous order on failure
      setOrderedProducts(previousOrder);
      console.error("Failed to update product order:", error);
    }
  };

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

  // Handle modal close - resets editing state
  const handleModalClose = () => {
    setIsDialogOpen(false);
    setEditingProduct(undefined);
  };

  // Handle successful save/delete from modal
  const handleSuccess = () => {
    handleModalClose();
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

  // Get category name by ID for display
  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return null;
    return categories.find((c) => c.id === categoryId)?.name ?? null;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with title and action buttons - stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Products</h1>
        <div className="flex items-center gap-2">
          {/* Import button - icon only on mobile */}
          <Button variant="outline" className="gap-2 px-2 sm:px-4">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          {/* Arrange shop button - icon only on mobile */}
          <Button variant="outline" className="gap-2 px-2 sm:px-4">
            <Layout className="h-4 w-4" />
            <span className="hidden sm:inline">Arrange shop</span>
          </Button>
          {/* Create product button */}
          <Button onClick={handleCreate} className="gap-2 px-2 sm:px-4">
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

      {/* Drag disabled message when filters are active */}
      {hasActiveFilters && (
        <p className="text-xs text-gray-400">
          Clear filters to enable drag-and-drop reordering.
        </p>
      )}

      {/* Products display wrapped in DndContext for drag-and-drop reordering */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={filteredProducts.map((p) => p.id)}
          strategy={viewMode === "list" ? verticalListSortingStrategy : rectSortingStrategy}
        >
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
            // List view (table) with drag handles
            <ProductsTable
              products={filteredProducts}
              categories={categories}
              selectedProducts={selectedProducts}
              onSelectProduct={handleSelectProduct}
              onSelectAll={handleSelectAll}
              onEdit={handleEdit}
              getCategoryName={getCategoryName}
              isDragEnabled={!hasActiveFilters}
            />
          ) : (
            // Grid view (cards) with drag handles
            <ProductsGrid
              products={filteredProducts}
              onEdit={handleEdit}
              getCategoryName={getCategoryName}
              isDragEnabled={!hasActiveFilters}
            />
          )}
        </SortableContext>
      </DndContext>

      {/* Create/Edit Modal - full-featured two-column layout */}
      <ProductEditModal
        isOpen={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleModalClose();
          else setIsDialogOpen(open);
        }}
        product={editingProduct}
        categories={categories}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

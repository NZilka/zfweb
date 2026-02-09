/**
 * ProductsTable - List view for products as a table
 * Displays products with columns: drag handle, checkbox, thumbnail, name, price, stock, status, categories, created
 */
"use client";

import Image from "next/image";
import { GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";
import type { ProductData } from "./ProductsClient";
import type { CategoryType } from "~/app/admin/_components/ProductForm";

interface ProductsTableProps {
  products: ProductData[];
  categories: CategoryType[];
  selectedProducts: Set<number>;
  onSelectProduct: (id: number) => void;
  onSelectAll: () => void;
  onEdit: (product: ProductData) => void;
  getCategoryName: (categoryId: number | null) => string | null;
  // Whether drag handles are active (disabled when filters are on)
  isDragEnabled: boolean;
}

/**
 * Renders product status badge with appropriate styling
 */
function StatusBadge({ status }: { status: string }) {
  // Map status to badge variant and display text
  switch (status) {
    case "active":
      return <Badge className="bg-green-600 text-white">Active</Badge>;
    case "sold_out":
      return <Badge variant="destructive">Sold Out</Badge>;
    case "hidden":
      return <Badge variant="secondary">Hidden</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

/**
 * Format date for display in table
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Sortable table row — wraps each product row with drag-and-drop
function SortableTableRow({
  product,
  isDragEnabled,
  selectedProducts,
  onSelectProduct,
  onEdit,
  getCategoryName,
}: {
  product: ProductData;
  isDragEnabled: boolean;
  selectedProducts: Set<number>;
  onSelectProduct: (id: number) => void;
  onEdit: (product: ProductData) => void;
  getCategoryName: (categoryId: number | null) => string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: product.id, disabled: !isDragEnabled });

  // Apply drag transform + transition from dnd-kit
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className="cursor-pointer hover:bg-gray-50"
      onClick={() => onEdit(product)}
    >
      {/* Drag handle — first cell, stop propagation to prevent row click */}
      <TableCell
        onClick={(e) => e.stopPropagation()}
        className="w-8 p-2"
      >
        {isDragEnabled && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none text-gray-400 hover:text-gray-600"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
      </TableCell>
      {/* Selection checkbox — hidden on mobile */}
      <TableCell onClick={(e) => e.stopPropagation()} className="hidden sm:table-cell">
        <Checkbox
          checked={selectedProducts.has(product.id)}
          onCheckedChange={() => onSelectProduct(product.id)}
        />
      </TableCell>
      {/* Product thumbnail */}
      <TableCell className="p-2 sm:p-4">
        {product.imgUrl[0] ? (
          <Image
            src={product.imgUrl[0]}
            alt={product.title}
            width={40}
            height={40}
            className="rounded object-cover w-8 h-8 sm:w-10 sm:h-10"
          />
        ) : (
          <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded bg-gray-200 text-xs text-gray-400">
            N/A
          </div>
        )}
      </TableCell>
      {/* Product name and SKU */}
      <TableCell className="p-2 sm:p-4">
        <div className="font-medium text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">{product.title}</div>
        {product.sku && (
          <div className="text-xs text-gray-500 truncate">SKU: {product.sku}</div>
        )}
      </TableCell>
      {/* Price */}
      <TableCell className="text-right font-medium text-sm sm:text-base p-2 sm:p-4">
        ${product.price}
      </TableCell>
      {/* Stock — hidden on mobile */}
      <TableCell className="text-right hidden sm:table-cell">
        <span
          className={
            product.inventory === 0
              ? "text-red-600 font-medium"
              : product.inventory < 5
              ? "text-yellow-600"
              : ""
          }
        >
          {product.inventory}
        </span>
      </TableCell>
      {/* Status badge */}
      <TableCell className="text-center p-2 sm:p-4">
        <StatusBadge status={product.status} />
      </TableCell>
      {/* Category — hidden on mobile/tablet */}
      <TableCell className="hidden lg:table-cell">
        {getCategoryName(product.category_id) ?? (
          <span className="text-gray-400">Uncategorized</span>
        )}
      </TableCell>
      {/* Created date — hidden on mobile/tablet */}
      <TableCell className="text-right text-gray-500 hidden lg:table-cell">
        {formatDate(product.createdAt)}
      </TableCell>
    </TableRow>
  );
}

export function ProductsTable({
  products,
  categories,
  selectedProducts,
  onSelectProduct,
  onSelectAll,
  onEdit,
  getCategoryName,
  isDragEnabled,
}: ProductsTableProps) {
  // Check if all visible products are selected
  const allSelected =
    products.length > 0 && selectedProducts.size === products.length;
  // Check if some (but not all) products are selected
  const someSelected = selectedProducts.size > 0 && !allSelected;

  return (
    // Table container with white background, horizontal scroll on mobile if needed
    <div className="rounded-lg border border-gray-300 bg-white text-gray-900 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {/* Drag handle column */}
            <TableHead className="w-8" />
            {/* Select all checkbox - hidden on mobile */}
            <TableHead className="w-10 sm:w-12 hidden sm:table-cell">
              <Checkbox
                checked={allSelected}
                // Use indeterminate state when some are selected
                data-state={someSelected ? "indeterminate" : undefined}
                onCheckedChange={onSelectAll}
              />
            </TableHead>
            {/* Thumbnail column */}
            <TableHead className="w-12 sm:w-16">Image</TableHead>
            {/* Product name */}
            <TableHead>Name</TableHead>
            {/* Price */}
            <TableHead className="text-right">Price</TableHead>
            {/* Stock/inventory - hidden on mobile */}
            <TableHead className="text-right hidden sm:table-cell">Stock</TableHead>
            {/* Status badge */}
            <TableHead className="text-center">Status</TableHead>
            {/* Category name - hidden on mobile and tablet */}
            <TableHead className="hidden lg:table-cell">Category</TableHead>
            {/* Created date - hidden on mobile and tablet */}
            <TableHead className="text-right hidden lg:table-cell">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <SortableTableRow
              key={product.id}
              product={product}
              isDragEnabled={isDragEnabled}
              selectedProducts={selectedProducts}
              onSelectProduct={onSelectProduct}
              onEdit={onEdit}
              getCategoryName={getCategoryName}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * ProductsTable - List view for products as a table
 * Displays products with columns: checkbox, thumbnail, name, price, stock, status, categories, created
 */
"use client";

import Image from "next/image";
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

export function ProductsTable({
  products,
  categories,
  selectedProducts,
  onSelectProduct,
  onSelectAll,
  onEdit,
  getCategoryName,
}: ProductsTableProps) {
  // Check if all visible products are selected
  const allSelected =
    products.length > 0 && selectedProducts.size === products.length;
  // Check if some (but not all) products are selected
  const someSelected = selectedProducts.size > 0 && !allSelected;

  return (
    // Table container with white background for readability
    <div className="rounded-lg border border-gray-300 bg-white text-gray-900">
      <Table>
        <TableHeader>
          <TableRow>
            {/* Select all checkbox */}
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                // Use indeterminate state when some are selected
                data-state={someSelected ? "indeterminate" : undefined}
                onCheckedChange={onSelectAll}
              />
            </TableHead>
            {/* Thumbnail column */}
            <TableHead className="w-16">Image</TableHead>
            {/* Product name */}
            <TableHead>Name</TableHead>
            {/* Price */}
            <TableHead className="text-right">Price</TableHead>
            {/* Stock/inventory */}
            <TableHead className="text-right">Stock</TableHead>
            {/* Status badge */}
            <TableHead className="text-center">Status</TableHead>
            {/* Category name */}
            <TableHead>Category</TableHead>
            {/* Created date */}
            <TableHead className="text-right">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow
              key={product.id}
              // Clickable row to open edit modal
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => onEdit(product)}
            >
              {/* Selection checkbox - stop propagation to prevent row click */}
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedProducts.has(product.id)}
                  onCheckedChange={() => onSelectProduct(product.id)}
                />
              </TableCell>
              {/* Product thumbnail */}
              <TableCell>
                {product.imgUrl[0] ? (
                  <Image
                    src={product.imgUrl[0]}
                    alt={product.title}
                    width={40}
                    height={40}
                    className="rounded object-cover"
                    style={{ width: 40, height: 40 }}
                  />
                ) : (
                  // Placeholder for products without images
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-200 text-xs text-gray-400">
                    N/A
                  </div>
                )}
              </TableCell>
              {/* Product name and SKU */}
              <TableCell>
                <div className="font-medium">{product.title}</div>
                {product.sku && (
                  <div className="text-xs text-gray-500">SKU: {product.sku}</div>
                )}
              </TableCell>
              {/* Price */}
              <TableCell className="text-right font-medium">
                ${product.price}
              </TableCell>
              {/* Stock with low stock warning */}
              <TableCell className="text-right">
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
              <TableCell className="text-center">
                <StatusBadge status={product.status} />
              </TableCell>
              {/* Category name or uncategorized */}
              <TableCell>
                {getCategoryName(product.category_id) ?? (
                  <span className="text-gray-400">Uncategorized</span>
                )}
              </TableCell>
              {/* Created date */}
              <TableCell className="text-right text-gray-500">
                {formatDate(product.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

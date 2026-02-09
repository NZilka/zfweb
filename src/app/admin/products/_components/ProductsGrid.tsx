/**
 * ProductsGrid - Grid view for products as cards
 * Displays product cards with image, name, price, stock, and drag handles
 */
"use client";

import Image from "next/image";
import { GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import type { ProductData } from "./ProductsClient";

interface ProductsGridProps {
  products: ProductData[];
  onEdit: (product: ProductData) => void;
  getCategoryName: (categoryId: number | null) => string | null;
  // Whether drag handles are active (disabled when filters are on)
  isDragEnabled: boolean;
}

// Sortable product card — wraps each card with drag-and-drop
function SortableProductCard({
  product,
  onEdit,
  getCategoryName,
  isDragEnabled,
}: {
  product: ProductData;
  onEdit: (product: ProductData) => void;
  getCategoryName: (categoryId: number | null) => string | null;
  isDragEnabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: product.id, disabled: !isDragEnabled });

  // Apply drag transform + transition from dnd-kit
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="cursor-pointer overflow-hidden transition-all hover:ring-2 hover:ring-blue-500"
      onClick={() => onEdit(product)}
    >
      {/* Product image container */}
      <div className="relative aspect-square bg-gray-100">
        {product.imgUrl[0] ? (
          <Image
            src={product.imgUrl[0]}
            alt={product.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            No Image
          </div>
        )}
        {/* Drag handle — overlaid top-left, only shown when drag enabled */}
        {isDragEnabled && (
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="absolute left-2 top-2 cursor-grab touch-none rounded bg-black/50 p-1 text-white hover:bg-black/70"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        {/* Status badges overlaid on image */}
        <div className="absolute right-2 top-2 flex flex-col gap-1">
          {product.on_sale && (
            <Badge className="bg-orange-500 text-white">Sale</Badge>
          )}
          {product.status === "sold_out" && (
            <Badge variant="destructive">Sold Out</Badge>
          )}
          {product.status === "hidden" && (
            <Badge variant="secondary">Hidden</Badge>
          )}
        </div>
        {/* Stock badge in bottom left */}
        <div className="absolute bottom-2 left-2">
          <Badge
            className={
              product.inventory === 0
                ? "bg-red-600 text-white"
                : product.inventory < 5
                ? "bg-yellow-500 text-white"
                : "bg-green-600 text-white"
            }
          >
            {product.inventory === 0
              ? "Out of Stock"
              : `${product.inventory} in stock`}
          </Badge>
        </div>
      </div>
      {/* Product info section */}
      <CardContent className="p-4">
        <h3 className="truncate font-medium text-gray-900">{product.title}</h3>
        <p className="mt-1 text-lg font-bold text-gray-900">${product.price}</p>
        {getCategoryName(product.category_id) && (
          <p className="mt-1 text-xs text-gray-500">
            {getCategoryName(product.category_id)}
          </p>
        )}
        {product.sku && (
          <p className="mt-1 text-xs text-gray-400">SKU: {product.sku}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function ProductsGrid({
  products,
  onEdit,
  getCategoryName,
  isDragEnabled,
}: ProductsGridProps) {
  return (
    // Responsive grid layout: 2 cols on mobile, 3 on md, 4 on lg, 5 on xl
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product) => (
        <SortableProductCard
          key={product.id}
          product={product}
          onEdit={onEdit}
          getCategoryName={getCategoryName}
          isDragEnabled={isDragEnabled}
        />
      ))}
    </div>
  );
}

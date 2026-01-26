/**
 * ProductsGrid - Grid view for products as cards
 * Displays product cards with image, name, price, stock
 */
"use client";

import Image from "next/image";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import type { ProductData } from "./ProductsClient";

interface ProductsGridProps {
  products: ProductData[];
  onEdit: (product: ProductData) => void;
  getCategoryName: (categoryId: number | null) => string | null;
}

/**
 * Renders a single product card in grid view
 */
function ProductCard({
  product,
  onEdit,
  getCategoryName,
}: {
  product: ProductData;
  onEdit: (product: ProductData) => void;
  getCategoryName: (categoryId: number | null) => string | null;
}) {
  return (
    <Card
      // Clickable card to open edit modal
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
          // Placeholder for products without images
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            No Image
          </div>
        )}
        {/* Status badges overlaid on image */}
        <div className="absolute right-2 top-2 flex flex-col gap-1">
          {/* On sale badge */}
          {product.on_sale && (
            <Badge className="bg-orange-500 text-white">Sale</Badge>
          )}
          {/* Status badge for non-active products */}
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
        {/* Product title */}
        <h3 className="truncate font-medium text-gray-900">{product.title}</h3>
        {/* Price */}
        <p className="mt-1 text-lg font-bold text-gray-900">${product.price}</p>
        {/* Category if assigned */}
        {getCategoryName(product.category_id) && (
          <p className="mt-1 text-xs text-gray-500">
            {getCategoryName(product.category_id)}
          </p>
        )}
        {/* SKU if available */}
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
}: ProductsGridProps) {
  return (
    // Responsive grid layout: 2 cols on mobile, 3 on md, 4 on lg, 5 on xl
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onEdit={onEdit}
          getCategoryName={getCategoryName}
        />
      ))}
    </div>
  );
}

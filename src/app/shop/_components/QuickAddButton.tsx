/**
 * QuickAddButton — Small "+" overlay button for product cards
 * Positioned on bottom-right of product image for quick add-to-cart
 * Hidden when product is sold out (inventory exhausted)
 */
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useCart } from "~/app/_context/CartContext";

interface QuickAddButtonProps {
  productId: number;
  availableInventory: number;
}

export function QuickAddButton({
  productId,
  availableInventory,
}: QuickAddButtonProps) {
  const { addToCart } = useCart();
  const [isLoading, setIsLoading] = useState(false);

  // Don't render when sold out (inventory exhausted)
  if (availableInventory === 0) return null;

  const handleClick = async (e: React.MouseEvent) => {
    // Prevent navigating to product detail page (parent is a Link)
    e.preventDefault();
    e.stopPropagation();
    setIsLoading(true);
    try {
      await addToCart(productId, 1);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black disabled:opacity-50"
      aria-label="Quick add to cart"
    >
      <Plus className="h-4 w-4" />
    </button>
  );
}

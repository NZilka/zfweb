"use client";

import { useCart } from "~/app/_context/CartContext";
import { ShoppingCart } from "lucide-react";

// Cart button for navigation - shows cart icon with item count badge
// Clicking opens the cart drawer
export function CartButton() {
  const { itemCount, toggleCart, isLoading } = useCart();

  return (
    <button
      onClick={toggleCart}
      className="relative flex items-center gap-2 hover:text-gray-600"
      aria-label={`Cart with ${itemCount} items`}
    >
      <ShoppingCart className="h-6 w-6" />
      <span className="hidden sm:inline">Cart</span>
      {/* Item count badge - only show when there are items */}
      {!isLoading && itemCount > 0 && (
        <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </button>
  );
}

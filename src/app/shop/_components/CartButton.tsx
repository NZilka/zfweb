"use client";

import { useCart } from "~/app/_context/CartContext";
import { ShoppingCart } from "lucide-react";

// Cart button for navigation — icon-only at all breakpoints
// Shows item count badge when cart has items
// Clicking toggles the cart drawer open/closed
export function CartButton() {
  const { itemCount, toggleCart, isLoading } = useCart();

  return (
    <button
      onClick={toggleCart}
      className="relative hover:text-neutral-500"
      aria-label={`Cart with ${itemCount} items`}
    >
      <ShoppingCart className="h-5 w-5" />
      {/* Item count badge — only shown when cart has items and not loading */}
      {!isLoading && itemCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[10px] font-medium text-white">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </button>
  );
}

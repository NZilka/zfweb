"use client";

import { useState } from "react";
import { useCart } from "~/app/_context/CartContext";

interface AddToCartButtonProps {
  productId: number;
  disabled?: boolean;
  // Visual variant - "card" for product cards, "full" for detail pages
  variant?: "card" | "full";
  // Show quantity selector (for detail pages)
  showQuantity?: boolean;
  // Maximum quantity (typically inventory count)
  maxQuantity?: number;
  // Callback after successful add (e.g., to close modal)
  onSuccess?: () => void;
}

// Reusable Add to Cart button with optional quantity selector
// Used in product cards and product detail pages
export function AddToCartButton({
  productId,
  disabled = false,
  variant = "card",
  showQuantity = false,
  maxQuantity = 99,
  onSuccess,
}: AddToCartButtonProps) {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddToCart = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await addToCart(productId, quantity);
      // Reset quantity after successful add
      setQuantity(1);
      // Call success callback (e.g., to close modal)
      onSuccess?.();
    } catch (err: any) {
      setError(err.message ?? "Failed to add to cart");
    } finally {
      setIsLoading(false);
    }
  };

  // Quantity adjustment handlers
  const incrementQuantity = () => {
    if (quantity < maxQuantity) {
      setQuantity((q) => q + 1);
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity((q) => q - 1);
    }
  };

  // Base button styles based on variant
  const buttonStyles =
    variant === "card"
      ? "inline-flex items-center rounded-md border border-gray-700 bg-black px-3 py-2 text-center text-sm font-medium text-white hover:bg-zinc-700 focus:outline-hidden focus:ring-4 focus:ring-zinc-300 dark:bg-zinc-600 dark:hover:bg-black dark:focus:ring-zinc-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
      : "inline-flex items-center justify-center rounded-md border border-gray-700 bg-black px-6 py-3 text-white hover:bg-zinc-700 disabled:bg-gray-400 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Quantity selector (optional) */}
      {showQuantity && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={decrementQuantity}
            disabled={quantity <= 1 || isLoading}
            className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            -
          </button>
          <span className="w-12 text-center">{quantity}</span>
          <button
            type="button"
            onClick={incrementQuantity}
            disabled={quantity >= maxQuantity || isLoading}
            className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            +
          </button>
        </div>
      )}

      {/* Add to Cart button */}
      <button
        onClick={handleAddToCart}
        disabled={disabled || isLoading}
        className={buttonStyles}
      >
        {isLoading ? "Adding..." : "Add to Cart"}
      </button>

      {/* Error message */}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

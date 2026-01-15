"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "~/app/_context/CartContext";
import { Button } from "./button";

// Slide-out cart drawer component
// Shows cart contents with quantity controls and checkout CTA
export function CartDrawer() {
  const {
    items,
    itemCount,
    total,
    isLoading,
    isOpen,
    closeCart,
    updateQuantity,
    removeItem,
  } = useCart();

  // Close drawer on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when drawer is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, closeCart]);

  // Handle quantity update with loading state
  const handleQuantityChange = async (cartItemId: number, newQuantity: number) => {
    try {
      await updateQuantity(cartItemId, newQuantity);
    } catch (error) {
      // Error already logged in context
    }
  };

  // Handle item removal
  const handleRemove = async (cartItemId: number) => {
    try {
      await removeItem(cartItemId);
    } catch (error) {
      // Error already logged in context
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 transition-opacity"
        onClick={closeCart}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold">
            Shopping Cart ({itemCount} {itemCount === 1 ? "item" : "items"})
          </h2>
          <button
            onClick={closeCart}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close cart"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Cart contents */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-gray-500">Loading cart...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <ShoppingBag className="h-16 w-16 text-gray-300" />
              <p className="text-gray-500">Your cart is empty</p>
              <Button onClick={closeCart}>Continue Shopping</Button>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-4 rounded-lg border p-3 dark:border-gray-700"
                >
                  {/* Product image */}
                  <div className="h-20 w-20 flex-shrink-0">
                    {item.product.imgUrl[0] ? (
                      <Image
                        src={item.product.imgUrl[0]}
                        alt={item.product.title}
                        width={80}
                        height={80}
                        className="h-full w-full rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded bg-gray-200 text-xs text-gray-400">
                        No Image
                      </div>
                    )}
                  </div>

                  {/* Product details */}
                  <div className="flex flex-1 flex-col">
                    <h3 className="font-medium">{item.product.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      ${item.product.price}
                    </p>

                    {/* Quantity controls */}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="flex h-7 w-7 items-center justify-center rounded border hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                        disabled={item.quantity >= item.product.inventory}
                        className="flex h-7 w-7 items-center justify-center rounded border hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="ml-auto flex h-7 w-7 items-center justify-center rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer with totals and checkout */}
        {items.length > 0 && (
          <div className="border-t p-4 dark:border-gray-700">
            {/* Subtotal */}
            <div className="mb-4 flex items-center justify-between text-lg font-semibold">
              <span>Subtotal</span>
              <span>${total}</span>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <Link href="/shop/checkout" onClick={closeCart}>
                <Button className="w-full">Proceed to Checkout</Button>
              </Link>
              <Link href="/shop/cart" onClick={closeCart}>
                <Button variant="outline" className="w-full">
                  View Full Cart
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

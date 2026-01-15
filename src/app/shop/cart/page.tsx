"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from "lucide-react";
import { useCart } from "~/app/_context/CartContext";
import { Button } from "~/components/ui/button";

// Full cart page for detailed cart review
// Provides larger view of cart items with full controls
export default function CartPage() {
  const {
    items,
    itemCount,
    total,
    isLoading,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCart();

  // Handle quantity update
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

  // Handle clear cart
  const handleClearCart = async () => {
    if (confirm("Are you sure you want to clear your cart?")) {
      try {
        await clearCart();
      } catch (error) {
        // Error already logged in context
      }
    }
  };

  // Calculate line item total
  const getLineTotal = (price: string, quantity: number) => {
    return (parseFloat(price) * quantity).toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-gray-500">Loading cart...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/shop"
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Continue Shopping
        </Link>
        <h1 className="text-3xl font-bold">Shopping Cart</h1>
        <p className="text-gray-500">
          {itemCount} {itemCount === 1 ? "item" : "items"} in your cart
        </p>
      </div>

      {items.length === 0 ? (
        // Empty cart state
        <div className="flex flex-col items-center justify-center gap-6 py-16">
          <ShoppingBag className="h-24 w-24 text-gray-300" />
          <div className="text-center">
            <h2 className="text-xl font-semibold">Your cart is empty</h2>
            <p className="mt-2 text-gray-500">
              Looks like you haven&apos;t added any items yet.
            </p>
          </div>
          <Link href="/shop">
            <Button size="lg">Start Shopping</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Cart items list */}
          <div className="lg:col-span-2">
            {/* Clear cart button */}
            <div className="mb-4 flex justify-end">
              <Button variant="ghost" size="sm" onClick={handleClearCart}>
                Clear Cart
              </Button>
            </div>

            {/* Items */}
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 rounded-lg border p-4 dark:border-gray-700"
                >
                  {/* Product image - larger on full page */}
                  <Link href={`/shop/product/${item.product.id}`} className="flex-shrink-0">
                    {item.product.imgUrl[0] ? (
                      <Image
                        src={item.product.imgUrl[0]}
                        alt={item.product.title}
                        width={120}
                        height={120}
                        className="h-[120px] w-[120px] rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-[120px] w-[120px] items-center justify-center rounded-lg bg-gray-200 text-sm text-gray-400">
                        No Image
                      </div>
                    )}
                  </Link>

                  {/* Product details */}
                  <div className="flex flex-1 flex-col">
                    <Link
                      href={`/shop/product/${item.product.id}`}
                      className="text-lg font-semibold hover:underline"
                    >
                      {item.product.title}
                    </Link>
                    <p className="text-gray-600 dark:text-gray-400">
                      ${item.product.price} each
                    </p>

                    {/* Quantity and remove controls */}
                    <div className="mt-auto flex items-center justify-between pt-4">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">Qty:</span>
                        <button
                          onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="flex h-8 w-8 items-center justify-center rounded border hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                          disabled={item.quantity >= item.product.inventory}
                          className="flex h-8 w-8 items-center justify-center rounded border hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRemove(item.id)}
                          className="ml-4 flex items-center gap-1 text-sm text-red-500 hover:text-red-700"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </button>
                      </div>

                      {/* Line total */}
                      <p className="text-lg font-semibold">
                        ${getLineTotal(item.product.price, item.quantity)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order summary sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 rounded-lg border bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-4 text-xl font-semibold">Order Summary</h2>

              {/* Summary details */}
              <div className="space-y-3 border-b pb-4 dark:border-gray-700">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
                  </span>
                  <span>${total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Shipping</span>
                  <span className="text-gray-500">Calculated at checkout</span>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between py-4 text-lg font-semibold">
                <span>Estimated Total</span>
                <span>${total}</span>
              </div>

              {/* Checkout button */}
              <Link href="/shop/checkout">
                <Button className="w-full" size="lg">
                  Proceed to Checkout
                </Button>
              </Link>

              {/* Continue shopping link */}
              <Link
                href="/shop"
                className="mt-4 block text-center text-sm text-gray-500 hover:text-gray-700"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

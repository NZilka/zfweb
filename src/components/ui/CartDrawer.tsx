"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "~/app/_context/CartContext";

// Slide-out cart drawer — always rendered in DOM for CSS transition
// Slides in from the right using transform, slower ease-in-out animation
// Styled to match NUIT pattern: clean header, product cards, checkout CTA
export function CartDrawer() {
  const router = useRouter();
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

  // Navigate to shop and close cart — full navigation to refresh page
  const handleContinueShopping = () => {
    closeCart();
    router.push("/shop");
    router.refresh();
  };

  // Close drawer on Escape key and lock body scroll when open
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, closeCart]);

  // Handle quantity update — error already logged in context
  const handleQuantityChange = async (
    cartItemId: number,
    newQuantity: number,
  ) => {
    try {
      await updateQuantity(cartItemId, newQuantity);
    } catch {
      // Error already logged in context
    }
  };

  // Handle item removal — error already logged in context
  const handleRemove = async (cartItemId: number) => {
    try {
      await removeItem(cartItemId);
    } catch {
      // Error already logged in context
    }
  };

  return (
    <>
      {/* Backdrop — fades in/out, always in DOM for transition */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-500 ease-in-out ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeCart}
        aria-hidden="true"
      />

      {/* Drawer panel — slides from right with transform */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white text-black shadow-xl transition-transform duration-500 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header — clean "Cart" title + close button */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest">
            Cart
          </h2>
          <button
            onClick={closeCart}
            className="rounded p-1 hover:bg-neutral-100"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cart contents — scrollable area */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-neutral-400">Loading cart...</p>
            </div>
          ) : items.length === 0 ? (
            // Empty cart state
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <ShoppingBag className="h-12 w-12 text-neutral-200" />
              <p className="text-sm text-neutral-400">Your cart is empty</p>
              <button
                onClick={handleContinueShopping}
                className="text-sm underline underline-offset-4 hover:text-neutral-500"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            // Cart items list
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id} className="flex gap-4 py-4">
                  {/* Product image */}
                  <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded bg-neutral-50">
                    {item.product.imgUrl[0] ? (
                      <Image
                        src={item.product.imgUrl[0]}
                        alt={item.product.title}
                        width={80}
                        height={80}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-neutral-300">
                        No Image
                      </div>
                    )}
                  </div>

                  {/* Product details + quantity + remove */}
                  <div className="flex flex-1 flex-col">
                    <h3 className="text-sm font-medium">{item.product.title}</h3>
                    <p className="mt-0.5 text-sm text-neutral-500">
                      ${item.product.price}
                    </p>

                    {/* Quantity controls: - num + */}
                    <div className="mt-auto flex items-center gap-0 pt-2">
                      <button
                        onClick={() =>
                          handleQuantityChange(item.id, item.quantity - 1)
                        }
                        disabled={item.quantity <= 1}
                        className="flex h-7 w-7 items-center justify-center border text-neutral-600 hover:bg-neutral-50 disabled:opacity-30"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="flex h-7 w-8 items-center justify-center border-y text-xs">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          handleQuantityChange(item.id, item.quantity + 1)
                        }
                        disabled={item.quantity >= item.product.inventory}
                        className="flex h-7 w-7 items-center justify-center border text-neutral-600 hover:bg-neutral-50 disabled:opacity-30"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Remove link — text style, not icon */}
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="mt-1 self-start text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-600"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer — shipping note + checkout CTA with total */}
        {items.length > 0 && (
          <div className="border-t px-5 py-4">
            <p className="mb-3 text-center text-xs text-neutral-400">
              Taxes and shipping calculated at checkout
            </p>
            <Link href="/shop/checkout" onClick={closeCart}>
              <button className="w-full bg-black py-3 text-sm font-semibold uppercase tracking-widest text-white hover:bg-neutral-800">
                Checkout &bull; ${total}
              </button>
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

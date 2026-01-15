"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  getCartItems,
  getCartSummary,
  addToCart as addToCartAction,
  updateCartItemQuantity as updateQuantityAction,
  removeFromCart as removeFromCartAction,
  clearCart as clearCartAction,
  type CartItemWithProduct,
} from "~/server/cart-actions";

// Cart context state and methods
interface CartContextType {
  // Cart data
  items: CartItemWithProduct[];
  itemCount: number;
  total: string;
  isLoading: boolean;
  // Cart drawer visibility
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  // Cart operations (async - call server actions)
  addToCart: (productId: number, quantity?: number) => Promise<void>;
  updateQuantity: (cartItemId: number, quantity: number) => Promise<void>;
  removeItem: (cartItemId: number) => Promise<void>;
  clearCart: () => Promise<void>;
  // Refresh cart data from server
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Custom hook to access cart context
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

interface CartProviderProps {
  children: ReactNode;
}

// Cart provider component - wraps app to provide cart state
export function CartProvider({ children }: CartProviderProps) {
  // Cart data state
  const [items, setItems] = useState<CartItemWithProduct[]>([]);
  const [itemCount, setItemCount] = useState(0);
  const [total, setTotal] = useState("0.00");
  const [isLoading, setIsLoading] = useState(true);

  // Cart drawer visibility state
  const [isOpen, setIsOpen] = useState(false);

  // Fetch cart data from server
  const refreshCart = useCallback(async () => {
    try {
      const [cartItems, summary] = await Promise.all([
        getCartItems(),
        getCartSummary(),
      ]);
      setItems(cartItems);
      setItemCount(summary.itemCount);
      setTotal(summary.total);
    } catch (error) {
      console.error("Failed to fetch cart:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load cart on mount
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  // Cart drawer controls
  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);
  const toggleCart = () => setIsOpen((prev) => !prev);

  // Add item to cart
  const addToCart = async (productId: number, quantity: number = 1) => {
    try {
      await addToCartAction(productId, quantity);
      await refreshCart();
      // Auto-open cart drawer on add
      openCart();
    } catch (error: any) {
      console.error("Failed to add to cart:", error);
      throw error; // Re-throw for UI error handling
    }
  };

  // Update item quantity
  const updateQuantity = async (cartItemId: number, quantity: number) => {
    try {
      await updateQuantityAction(cartItemId, quantity);
      await refreshCart();
    } catch (error: any) {
      console.error("Failed to update quantity:", error);
      throw error;
    }
  };

  // Remove item from cart
  const removeItem = async (cartItemId: number) => {
    try {
      await removeFromCartAction(cartItemId);
      await refreshCart();
    } catch (error: any) {
      console.error("Failed to remove item:", error);
      throw error;
    }
  };

  // Clear entire cart
  const clearCart = async () => {
    try {
      await clearCartAction();
      await refreshCart();
    } catch (error: any) {
      console.error("Failed to clear cart:", error);
      throw error;
    }
  };

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        total,
        isLoading,
        isOpen,
        openCart,
        closeCart,
        toggleCart,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

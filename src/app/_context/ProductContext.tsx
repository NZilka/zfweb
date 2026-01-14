"use client";

import React, { createContext, useState, useContext, ReactNode, useEffect } from "react";

// Extended interface to support edit mode - includes id for tracking, sku and category_id from schema
export interface ProductType {
  id?: number;           // Product ID when editing existing product
  title: string;
  price: number;
  description: string;
  inventory: number;
  sku?: string;          // Optional SKU field from schema
  category_id?: number;  // Optional category reference
}

interface ProductContextType {
  product: ProductType;
  setProduct: React.Dispatch<React.SetStateAction<ProductType>>;
  resetProduct: () => void;  // Helper to clear form state
}

// Default empty product state for create mode
const defaultProduct: ProductType = {
  title: "",
  price: 0,
  description: "",
  inventory: 0,
  sku: "",
  category_id: undefined,
};

const ProductContext = createContext<ProductContextType | undefined>(undefined);

// Provider accepts optional initialProduct for edit mode pre-population
export const ProductProvider = ({
  children,
  initialProduct,
}: {
  children: ReactNode;
  initialProduct?: ProductType;
}) => {
  const [product, setProduct] = useState<ProductType>(initialProduct ?? defaultProduct);

  // Reset to initial state (for clearing form or canceling edit)
  const resetProduct = () => {
    setProduct(initialProduct ?? defaultProduct);
  };

  // Update state if initialProduct changes (e.g., navigating to different product)
  useEffect(() => {
    if (initialProduct) {
      setProduct(initialProduct);
    }
  }, [initialProduct?.id]);

  return (
    <ProductContext.Provider value={{ product, setProduct, resetProduct }}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProduct = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error("useProduct must be used within a ProductProvider");
  }
  return context;
};

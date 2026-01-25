"use client";

import { useRouter } from "next/navigation";
import { AddToCartButton } from "~/app/shop/_components/AddToCartButton";

interface ModalAddToCartProps {
  productId: number;
  disabled: boolean;
  maxQuantity: number;
}

// Client wrapper for AddToCartButton in modal context
// Closes modal after successful add to cart
export function ModalAddToCart({
  productId,
  disabled,
  maxQuantity,
}: ModalAddToCartProps) {
  const router = useRouter();

  // Close modal by navigating back after successful add
  const handleSuccess = () => {
    router.back();
  };

  return (
    <AddToCartButton
      productId={productId}
      disabled={disabled}
      variant="full"
      showQuantity={true}
      maxQuantity={maxQuantity}
      onSuccess={handleSuccess}
    />
  );
}

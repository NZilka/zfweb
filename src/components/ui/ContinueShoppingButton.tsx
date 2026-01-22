"use client";

import { useRouter } from "next/navigation";
import { Button } from "./button";

// Client component button that navigates to shop with refresh
// Ensures fresh product data is loaded after navigation
export function ContinueShoppingButton({
  className,
}: {
  className?: string;
}) {
  const router = useRouter();

  const handleClick = () => {
    router.push("/shop");
    router.refresh();
  };

  return (
    <Button className={className} onClick={handleClick}>
      Continue Shopping
    </Button>
  );
}

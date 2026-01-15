"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Client component that polls for order creation
// Refreshes the page every 3 seconds until order is found
export function OrderPolling() {
  const router = useRouter();

  useEffect(() => {
    // Poll every 3 seconds
    const interval = setInterval(() => {
      router.refresh();
    }, 3000);

    return () => clearInterval(interval);
  }, [router]);

  return null;
}

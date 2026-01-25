/**
 * Client-side component that tracks checkout started event
 * Fires once on component mount with cart value
 */
"use client";

import { useEffect, useRef } from "react";
import { trackCheckoutStarted } from "~/lib/posthog";

interface CheckoutTrackerProps {
  cartValue: number;
}

export function CheckoutTracker({ cartValue }: CheckoutTrackerProps) {
  // Use ref to ensure we only track once per mount
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!hasTracked.current && cartValue > 0) {
      // Track checkout started event with cart value
      trackCheckoutStarted(cartValue);
      hasTracked.current = true;
    }
  }, [cartValue]);

  // Render nothing - this is a tracking-only component
  return null;
}

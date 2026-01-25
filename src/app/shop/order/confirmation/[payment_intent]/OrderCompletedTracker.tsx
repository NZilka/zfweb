/**
 * Client-side component that tracks order completed event
 * Fires once on component mount with order details
 */
"use client";

import { useEffect, useRef } from "react";
import { trackOrderCompleted } from "~/lib/posthog";

interface OrderCompletedTrackerProps {
  orderId: number;
  orderTotal: number;
}

export function OrderCompletedTracker({
  orderId,
  orderTotal,
}: OrderCompletedTrackerProps) {
  // Use ref to ensure we only track once per mount
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!hasTracked.current) {
      // Track order completed event with order details
      trackOrderCompleted(orderId, orderTotal);
      hasTracked.current = true;
    }
  }, [orderId, orderTotal]);

  // Render nothing - this is a tracking-only component
  return null;
}

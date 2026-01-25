/**
 * Client-side component that tracks product views for analytics
 * Fires a PostHog event on component mount
 */
"use client";

import { useEffect } from "react";
import { trackProductViewed } from "~/lib/posthog";

interface ProductViewTrackerProps {
  productId: number;
  categoryId?: number;
}

export function ProductViewTracker({
  productId,
  categoryId,
}: ProductViewTrackerProps) {
  useEffect(() => {
    // Track product view event when component mounts
    trackProductViewed(productId, categoryId);
  }, [productId, categoryId]);

  // Render nothing - this is a tracking-only component
  return null;
}

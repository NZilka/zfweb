"use client";

import { useEffect } from "react";

// Component that scrolls the nearest scrollable parent to top on mount
// Used for pages like cart/checkout that should start at the top
export function ScrollToTop() {
  useEffect(() => {
    // Find the scrollable main element in the shop layout
    const scrollContainer = document.querySelector("main.overflow-y-scroll");
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: "instant" });
    }
    // Also scroll window in case layout changes
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return null;
}

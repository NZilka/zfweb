/**
 * PostHog client-side provider configuration
 * Handles initialization and page view tracking for analytics
 */
"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense, type ReactNode } from "react";

// Skip analytics on Vercel preview deploys (both staging and feature-branch previews)
// so non-prod traffic never pollutes the production PostHog project.
// Vercel auto-exposes NEXT_PUBLIC_VERCEL_ENV for Next.js apps.
const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
const isPreviewDeploy = vercelEnv === "preview";

// Initialize PostHog only on client, when keys are available, and not on preview deploys
if (
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_POSTHOG_KEY &&
  !isPreviewDeploy
) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    // PostHog cloud host URL
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    // Capture page views manually via Next.js router events for SPA navigation
    capture_pageview: false,
    // Capture page leaves for session duration tracking
    capture_pageleave: true,
    // Disable in development to avoid polluting analytics
    loaded: (posthog) => {
      if (process.env.NODE_ENV === "development") {
        posthog.debug();
      }
    },
  });
}

/**
 * Component that captures page views on route changes
 * Must be wrapped in Suspense due to useSearchParams
 */
function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname && typeof window !== "undefined") {
      // Construct full URL for page view event
      let url = window.origin + pathname;
      if (searchParams?.toString()) {
        url += "?" + searchParams.toString();
      }
      posthog.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams]);

  return null;
}

/**
 * PostHog provider wrapper for the application
 * Provides PostHog context and automatic page view tracking
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  // Skip PostHog in SSR, if not configured, or on preview deploys (staging/feature previews)
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || isPreviewDeploy) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      {/* Suspense required for useSearchParams in page view tracker */}
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}

/**
 * Custom event tracking helpers for e-commerce analytics
 */
export const trackProductViewed = (productId: number, categoryId?: number) => {
  posthog.capture("product_viewed", {
    product_id: productId,
    category_id: categoryId,
  });
};

export const trackCategoryViewed = (categoryId: number) => {
  posthog.capture("category_viewed", {
    category_id: categoryId,
  });
};

export const trackCheckoutStarted = (cartValue: number) => {
  posthog.capture("checkout_started", {
    cart_value: cartValue,
  });
};

export const trackOrderCompleted = (orderId: number, orderTotal: number) => {
  posthog.capture("order_completed", {
    order_id: orderId,
    order_total: orderTotal,
  });
};

// Re-export posthog instance for direct access if needed
export { posthog };

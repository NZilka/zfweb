# Lesson: PostHog Analytics Integration

## What We Built
Integrated PostHog for visitor tracking, page views, and custom event tracking (product views, checkout started, etc.).

## Why This Approach

**PostHog over alternatives:** PostHog provides:
- Self-hostable option for data ownership
- Product analytics (funnels, retention) beyond basic page views
- Feature flags for A/B testing (future use)
- Event-based tracking for custom metrics

**Client-side provider pattern:** Wrapped the app in a PostHog provider that initializes once and captures page views automatically.

## Key Concepts

- **Client components for analytics**: PostHog must run in the browser, so the provider is a "use client" component
- **Environment variables**: `NEXT_PUBLIC_` prefix exposes keys to the browser
- **Custom events**: Track specific actions like product views and checkout

## Code Walkthrough

```tsx
// src/lib/posthog.tsx
"use client";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

// Initialize PostHog
if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    capture_pageview: true,
  });
}

// Custom event tracking
export function trackProductViewed(productId: number, title: string) {
  posthog.capture('product_viewed', { productId, title });
}

export function trackCheckoutStarted(cartValue: number) {
  posthog.capture('checkout_started', { cartValue });
}
```

**Provider wrapper in layout:**
```tsx
// src/app/layout.tsx
<PostHogClientProvider>
  {children}
</PostHogClientProvider>
```

## Testing Strategy
PostHog integration is verified by checking the PostHog dashboard for incoming events. Client-side tracking is difficult to unit test; instead, we rely on manual verification and PostHog's built-in debugging tools.

## What You Learned
- How to integrate third-party analytics in Next.js App Router
- The client/server split for browser-only libraries
- Custom event tracking for product analytics

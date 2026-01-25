# Lesson: Dashboard PostHog Metrics and Recent Activity

## What We Built
Added visitor count and conversion rate metrics from PostHog, plus lists of recent orders and recent shipments.

## Why This Approach

**PostHog for visitor metrics:** Unlike sales data (in our database), visitor counts require analytics tracking. PostHog captures unique visitors automatically.

**Conversion rate calculation:** `(Orders / Visitors) × 100` gives a simple but useful metric for understanding how many visitors become customers.

**Recent activity lists:** Showing the last 5 orders and shipments gives quick operational awareness without requiring full table views.

## Key Concepts

- **Server-side PostHog queries**: Using `posthog-node` for server-side API calls
- **Parallel data fetching**: Fetching multiple data sources concurrently with `Promise.all`
- **Limit queries**: Using `.limit(5)` for recent activity

## Code Walkthrough

**Recent orders query:**
```typescript
// src/server/analytics-queries.ts
export async function getRecentOrders(limit = 5) {
  return db
    .select({
      id: order.id,
      customerName: order.customer_name,
      total: order.total,
      createdAt: order.createdAt,
    })
    .from(order)
    .where(eq(order.status, "paid"))
    .orderBy(desc(order.createdAt))
    .limit(limit);
}
```

**Recent shipments query:**
```typescript
export async function getRecentShipments(limit = 5) {
  return db
    .select({ /* ... */ })
    .from(order)
    .where(and(
      eq(order.status, "paid"),
      eq(order.is_shipped, true)
    ))
    .orderBy(desc(order.shipped_at))
    .limit(limit);
}
```

**Parallel fetching in dashboard:**
```typescript
// Server component
const [metrics, recentOrders, recentShipments] = await Promise.all([
  getSalesMetrics(start, end),
  getRecentOrders(5),
  getRecentShipments(5),
]);
```

## Testing Strategy
Query functions are tested through manual verification and type checking. PostHog metrics require the PostHog dashboard to verify data is flowing correctly.

## What You Learned
- How to combine first-party data (orders) with third-party analytics (PostHog)
- Parallel data fetching patterns for dashboard performance
- Simple conversion rate calculations

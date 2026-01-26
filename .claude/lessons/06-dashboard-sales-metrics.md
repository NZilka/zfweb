# Lesson: Dashboard Tab with Date Range and Sales Metrics

## What We Built
Created the admin dashboard with date range filtering (7d, 30d, Month, Year, All) and sales metrics (Revenue, Orders, Units Sold, Average Order Value).

## Why This Approach

**URL-based date range:** The selected date range is stored in URL search params (`?range=30d`). This allows:
- Bookmarkable dashboard views
- Shareable links with specific date ranges
- Server-side data fetching based on the range

**Server-side aggregation:** Metrics are calculated using SQL aggregations directly in the database, not by fetching all orders and summing in JavaScript. This scales better with large datasets.

## Key Concepts

- **SQL aggregations**: `SUM()`, `COUNT()`, `AVG()` calculated in the database
- **Date range calculation**: Pure function converts preset to start/end dates
- **Server components for data**: Dashboard page is a server component that fetches data

## Code Walkthrough

**Date range calculation (tested in `analytics-queries.test.ts`):**
```typescript
// src/server/analytics-queries.ts
export function getDateRangeFromPreset(preset: DateRangePreset) {
  const now = new Date();
  switch (preset) {
    case "7d":
      return { start: new Date(now - 7 days), end: now };
    case "year":
      // Calendar year: Jan 1 to today
      return { start: new Date(now.getFullYear(), 0, 1), end: now };
    // ...
  }
}
```

**SQL aggregation query:**
```typescript
export async function getSalesMetrics(startDate: Date, endDate: Date) {
  const orderStats = await db
    .select({
      revenue: sql`COALESCE(SUM(${order.total}::numeric), 0)`,
      orderCount: sql`COUNT(${order.id})::int`,
    })
    .from(order)
    .where(and(
      eq(order.status, "paid"),
      gte(order.createdAt, startDate),
      lte(order.createdAt, endDate)
    ));
  // ...
}
```

**MetricCard component:**
```tsx
function MetricCard({ label, value, prefix = "" }) {
  return (
    <Card>
      <CardHeader><CardTitle>{label}</CardTitle></CardHeader>
      <CardContent>
        <span className="text-3xl font-bold">{prefix}{value}</span>
      </CardContent>
    </Card>
  );
}
```

## Testing Strategy
The `getDateRangeFromPreset` function is unit tested with fake timers to verify correct date calculations for each preset. SQL queries are validated by type checking and manual verification.

## What You Learned
- How to implement date range filtering with URL state
- SQL aggregation patterns with Drizzle ORM
- The pattern of server components fetching data and passing to client components

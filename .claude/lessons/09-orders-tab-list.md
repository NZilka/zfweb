# Lesson: Orders Tab with Sub-tabs and List

## What We Built
Created the Orders tab with sub-tabs for different fulfillment statuses: Unshipped, In Process, Shipped, and All Orders.

## Why This Approach

**Sub-tabs for workflow:** The fulfillment workflow has distinct stages:
1. **Unshipped**: New paid orders waiting to be processed
2. **In Process**: Orders downloaded for shipping but not yet shipped
3. **Shipped**: Completed orders with tracking

**Badge counts:** Each sub-tab shows a count badge so admins can quickly see pending work.

**Expandable rows:** Orders expand to show line items without leaving the page.

## Key Concepts

- **Conditional WHERE clauses**: Different filters for each sub-tab
- **Nested data fetching**: Orders with their line items
- **URL-based sub-tab state**: `?tab=unshipped` in the URL

## Code Walkthrough

**Filter logic:**
```typescript
// src/server/admin-queries.ts
export async function getOrdersByFulfillmentStatus(filter: FulfillmentFilter) {
  const conditions = [eq(order.status, "paid")];

  switch (filter) {
    case "unshipped":
      conditions.push(eq(order.is_downloaded, false));
      break;
    case "in_process":
      conditions.push(eq(order.is_downloaded, true));
      conditions.push(eq(order.is_shipped, false));
      break;
    case "shipped":
      conditions.push(eq(order.is_shipped, true));
      break;
    // "all" has no additional conditions
  }

  return db.select(...).from(order).where(and(...conditions));
}
```

**Count queries for badges:**
```typescript
export async function getOrderCounts() {
  const [unshipped, inProcess, shipped, all] = await Promise.all([
    db.select({ count: sql`COUNT(*)` }).from(order)
      .where(and(eq(order.status, "paid"), eq(order.is_downloaded, false))),
    // ... similar for other statuses
  ]);

  return { unshipped, inProcess, shipped, all };
}
```

**OrdersClient with sub-tabs:**
```tsx
export function OrdersClient({ orders, counts, currentTab }) {
  return (
    <Tabs value={currentTab}>
      <TabsList>
        <TabsTrigger value="unshipped">
          Unshipped <Badge>{counts.unshipped}</Badge>
        </TabsTrigger>
        {/* ... */}
      </TabsList>
      <OrdersTable orders={orders} />
    </Tabs>
  );
}
```

## Testing Strategy
Filter logic is tested manually by creating orders in different states and verifying they appear in the correct sub-tabs.

## What You Learned
- How to implement filtered views with dynamic WHERE conditions
- The pattern of count queries for badge/notification indicators
- Combining server data fetching with client-side tab interaction

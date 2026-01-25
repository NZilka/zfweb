# Lesson: Dashboard Product and Category Analytics

## What We Built
Added per-product and per-category sales statistics tables showing units sold and revenue for each, filtered by the selected date range.

## Why This Approach

**Grouped aggregations:** Instead of showing individual order data, we aggregate by product and category to answer "what's selling?" at a glance.

**Revenue over units:** Sorting by revenue (not units) surfaces high-value products even if they sell fewer units.

**Handling uncategorized:** Products without categories are grouped as "Uncategorized" using `COALESCE`.

## Key Concepts

- **GROUP BY aggregations**: SQL grouping with SUM for aggregated stats
- **JOINs for related data**: Joining order_items → orders → products → categories
- **COALESCE for defaults**: Handling NULL category names

## Code Walkthrough

**Per-product stats query:**
```typescript
export async function getProductSalesStats(startDate, endDate) {
  return db
    .select({
      productId: order_items.product_id,
      productTitle: product.title,
      unitsSold: sql`SUM(${order_items.quantity})::int`,
      revenue: sql`SUM(${order_items.quantity} * ${product.price}::numeric)`,
    })
    .from(order_items)
    .innerJoin(order, eq(order_items.order_id, order.id))
    .innerJoin(product, eq(order_items.product_id, product.id))
    .where(and(
      eq(order.status, "paid"),
      gte(order.createdAt, startDate),
      lte(order.createdAt, endDate)
    ))
    .groupBy(order_items.product_id, product.title)
    .orderBy(desc(sql`SUM(...)`));
}
```

**Per-category stats with COALESCE:**
```typescript
export async function getCategorySalesStats(startDate, endDate) {
  return db
    .select({
      categoryId: product.category_id,
      categoryName: sql`COALESCE(${product_category.name}, 'Uncategorized')`,
      unitsSold: sql`SUM(${order_items.quantity})::int`,
      revenue: sql`SUM(...)`,
    })
    .from(order_items)
    .innerJoin(order, ...)
    .innerJoin(product, ...)
    .leftJoin(product_category, eq(product.category_id, product_category.id))
    .where(...)
    .groupBy(product.category_id, product_category.name)
    .orderBy(desc(...));
}
```

Note: `leftJoin` for categories (products may not have a category), `innerJoin` for orders/products (required relationships).

## Testing Strategy
Query correctness is validated through manual testing with known order data. The aggregation logic follows standard SQL patterns that are well-understood.

## What You Learned
- SQL GROUP BY with multiple aggregations
- The difference between INNER JOIN and LEFT JOIN
- Using COALESCE to provide default values for NULL fields

# Lesson: Orders Packing Slip and Status Updates

## What We Built
Added printable packing slips and checkbox controls for tracking packed/shipped status on orders.

## Why This Approach

**Packing slips for fulfillment:** Physical packing slips help warehouse operations verify order contents. Print-optimized CSS ensures clean output.

**Checkbox-based status:** Simple checkboxes for "Packed" and "Shipped" match the physical workflow:
1. Print packing slip
2. Pack order, check "Packed"
3. Ship order, check "Shipped" (optionally add tracking number)

**Timestamps on status changes:** Recording when each status changed enables fulfillment time analytics.

## Key Concepts

- **Print CSS**: `@media print` rules hide non-essential UI during printing
- **Server actions for updates**: Checkbox changes trigger server actions
- **Optimistic UI**: Update UI immediately, revalidate in background

## Code Walkthrough

**Status update server action:**
```typescript
// src/server/admin-actions.ts
export async function updateOrderFulfillment(
  orderId: number,
  updates: { isPacked?: boolean; isShipped?: boolean; trackingNumber?: string }
) {
  const now = new Date();
  const updateData: any = {};

  if (updates.isPacked !== undefined) {
    updateData.is_packed = updates.isPacked;
    updateData.packed_at = updates.isPacked ? now : null;
  }

  if (updates.isShipped !== undefined) {
    updateData.is_shipped = updates.isShipped;
    updateData.shipped_at = updates.isShipped ? now : null;
  }

  if (updates.trackingNumber !== undefined) {
    updateData.tracking_number = updates.trackingNumber || null;
  }

  await db.update(order).set(updateData).where(eq(order.id, orderId));
  revalidatePath("/admin/orders");

  return { success: true };
}
```

**Print CSS for packing slip:**
```css
@media print {
  /* Hide navigation and controls */
  .no-print { display: none !important; }

  /* Each packing slip on its own page */
  .packing-slip { page-break-after: always; }

  /* Clean formatting */
  body { font-size: 12pt; }
}
```

**Packing slip component:**
```tsx
function PackingSlip({ order }) {
  return (
    <div className="packing-slip">
      <h1>Packing Slip</h1>
      <p>Order #{order.id}</p>
      <p>{order.customerName}</p>
      <address>{/* shipping address */}</address>

      <table>
        <thead><tr><th>Item</th><th>Qty</th></tr></thead>
        <tbody>
          {order.items.map(item => (
            <tr key={item.id}>
              <td>{item.product.title}</td>
              <td>{item.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={() => window.print()} className="no-print">
        Print
      </button>
    </div>
  );
}
```

## Testing Strategy
Status update logic is tested through manual verification. Print layout is tested by using browser print preview.

## What You Learned
- Print-specific CSS for document generation
- The pattern of timestamp + boolean for tracking when status changes occurred
- Server actions for simple CRUD operations with revalidation

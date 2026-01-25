# Lesson: Products Tab Enhanced List View

## What We Built
Enhanced the products list with inventory status badges ("In Stock" / "Sold Out"), click-to-edit navigation, and toast notifications for actions.

## Why This Approach

**Visual inventory status:** Color-coded badges (green for in stock, red for sold out) let admins quickly scan for items needing attention.

**Click-to-edit pattern:** Clicking a product row opens the edit form. This is faster than separate "Edit" buttons and follows common admin UI patterns.

**Toast notifications:** Using Sonner for feedback on save/delete actions gives immediate confirmation without modal dialogs.

## Key Concepts

- **Conditional styling**: Badge color based on inventory count
- **Row click handlers**: Making table rows interactive
- **Toast API**: Sonner's `toast.success()` and `toast.error()` patterns

## Code Walkthrough

**Inventory badge logic:**
```tsx
function InventoryBadge({ inventory }: { inventory: number }) {
  const inStock = inventory > 0;

  return (
    <Badge
      variant={inStock ? "default" : "destructive"}
      className={inStock
        ? "bg-green-100 text-green-800"
        : "bg-red-100 text-red-800"}
    >
      {inStock ? "In Stock" : "Sold Out"}
    </Badge>
  );
}
```

**Clickable product row:**
```tsx
function ProductRow({ product, onClick }) {
  return (
    <TableRow
      className="cursor-pointer hover:bg-gray-50"
      onClick={() => onClick(product.id)}
    >
      <TableCell>
        <img src={product.imgUrl[0]} className="h-12 w-12 object-cover" />
      </TableCell>
      <TableCell>{product.title}</TableCell>
      <TableCell>{product.sku}</TableCell>
      <TableCell>${product.price}</TableCell>
      <TableCell>
        <InventoryBadge inventory={product.inventory} />
      </TableCell>
    </TableRow>
  );
}
```

**Toast notifications:**
```tsx
import { toast } from "sonner";

async function handleSave(data) {
  const result = await updateProduct(data);

  if (result.success) {
    toast.success("Product saved successfully");
  } else {
    toast.error(result.error || "Failed to save product");
  }
}
```

## Testing Strategy
UI interactions are tested manually. Toast notifications are verified visually. The Sonner library handles its own internal state management.

## What You Learned
- Conditional styling patterns for status indicators
- Making table rows interactive for better UX
- Using toast notifications for non-blocking feedback

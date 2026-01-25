# Lesson: Discounts Tab CRUD Implementation

## What We Built
Full CRUD (Create, Read, Update, Delete) interface for discount codes with validation, active toggle, and usage tracking.

## Why This Approach

**Server actions for mutations:** All create/update/delete operations use server actions for:
- Type-safe function calls from client components
- Automatic revalidation with `revalidatePath`
- No need for separate API routes

**Inline toggle for active status:** Quick enable/disable without opening an edit form speeds up discount management.

**Form validation on both sides:** Client-side validation (Zod schema) for instant feedback, server-side validation to ensure data integrity.

## Key Concepts

- **Server actions with "use server"**: Functions that run on the server, callable from client components
- **Optimistic updates**: UI updates immediately, server confirms
- **Form state management**: Controlled inputs with validation feedback

## Code Walkthrough

**Server actions (tested in `discount-actions.test.ts`):**
```typescript
// src/server/discount-actions.ts
"use server";

export async function createDiscount(input: DiscountInput) {
  // Check for duplicate code
  const existing = await db.select({ id: discount.id })
    .from(discount)
    .where(eq(discount.code, input.code.toUpperCase()));

  if (existing.length > 0) {
    return { success: false, error: "Discount code already exists" };
  }

  await db.insert(discount).values({
    code: input.code.toUpperCase(),
    name: input.name,
    discount: String(input.discount),
    discount_type: input.discountType,
    // ...
  });

  revalidatePath("/admin/discounts");
  return { success: true };
}

export async function toggleDiscountActive(id: number) {
  const current = await db.select({ active: discount.active })
    .from(discount).where(eq(discount.id, id));

  await db.update(discount)
    .set({ active: !current[0].active })
    .where(eq(discount.id, id));

  revalidatePath("/admin/discounts");
  return { success: true };
}
```

**Discount form component:**
```tsx
function DiscountForm({ discount, onSubmit }) {
  const [code, setCode] = useState(discount?.code || "");
  const [discountValue, setDiscountValue] = useState(discount?.discount || 0);
  const [discountType, setDiscountType] = useState(discount?.discountType || "percent");

  return (
    <form onSubmit={handleSubmit}>
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="SAVE10"
      />

      <Input
        type="number"
        value={discountValue}
        onChange={(e) => setDiscountValue(Number(e.target.value))}
      />

      <Select value={discountType} onValueChange={setDiscountType}>
        <SelectItem value="percent">Percent Off</SelectItem>
        <SelectItem value="fixed">Fixed Amount</SelectItem>
      </Select>

      {/* ... more fields */}
    </form>
  );
}
```

## Testing Strategy
Server action logic is unit tested in `discount-actions.test.ts`, particularly the `calculateDiscountedTotal` function. CRUD operations are tested manually through the UI.

## What You Learned
- The server actions pattern for CRUD operations
- How `revalidatePath` refreshes server-rendered content
- Building admin forms with controlled inputs and validation

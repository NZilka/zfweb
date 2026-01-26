# Lesson: Checkout Discount Code Integration

## What We Built
Integrated discount codes into the checkout flow: code entry UI, server-side validation, discount calculation, and usage tracking.

## Why This Approach

**Client-side validation first:** The discount code input validates the code immediately when "Apply" is clicked, showing the discount before payment. This gives instant feedback.

**Server-side validation at payment:** The payment intent creation re-validates the code to prevent tampering. Even if someone modifies the client, the server enforces the rules.

**Usage increment on success:** The discount usage counter only increments when payment succeeds (via webhook), not when applied. This prevents failed checkouts from consuming usage limits.

## Key Concepts

- **Dual validation**: Client for UX, server for security
- **Webhook for post-payment actions**: Increment usage only after confirmed payment
- **Discount calculation (tested)**: Handle both percent and fixed discounts correctly

## Code Walkthrough

**Discount calculation (unit tested in `discount-actions.test.ts`):**
```typescript
export function calculateDiscountedTotal(
  subtotal: number,
  discountValue: number,
  discountType: "percent" | "fixed"
) {
  let discountAmount: number;

  if (discountType === "percent") {
    discountAmount = subtotal * (discountValue / 100);
  } else {
    discountAmount = discountValue;
  }

  // Don't allow discount to exceed subtotal
  discountAmount = Math.min(discountAmount, subtotal);

  return {
    discountAmount: Math.round(discountAmount * 100) / 100,
    finalTotal: Math.max(0, subtotal - discountAmount),
  };
}
```

**Validation server action:**
```typescript
export async function validateDiscountCode(code: string) {
  const d = await db.select().from(discount)
    .where(eq(discount.code, code.toUpperCase()));

  if (!d.length) return { valid: false, error: "Invalid code" };
  if (!d[0].active) return { valid: false, error: "Code inactive" };
  if (d[0].expires_at && d[0].expires_at < new Date()) {
    return { valid: false, error: "Code expired" };
  }
  if (d[0].max_uses && d[0].numberOfUses >= d[0].max_uses) {
    return { valid: false, error: "Usage limit reached" };
  }

  return { valid: true, discount: { /* ... */ } };
}
```

**Webhook usage increment:**
```typescript
// src/app/api/stripe/webhook/route.ts
case "payment_intent.succeeded": {
  // ... create order ...

  // Increment discount usage if code was used
  if (paymentIntent.metadata.discountId) {
    await incrementDiscountUsage(parseInt(paymentIntent.metadata.discountId));
  }
}
```

**DiscountCodeInput component:**
```tsx
export function DiscountCodeInput({ onDiscountApplied, appliedDiscount }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);

  const handleApply = async () => {
    const result = await validateDiscountCode(code);
    if (result.valid) {
      onDiscountApplied(result.discount);
      setCode("");
    } else {
      setError(result.error);
    }
  };

  if (appliedDiscount) {
    return (
      <div className="bg-green-50 p-3 rounded">
        <Check /> {appliedDiscount.code}
        <Badge>{appliedDiscount.discount}% off</Badge>
        <Button onClick={() => onDiscountApplied(null)}>Remove</Button>
      </div>
    );
  }

  return (
    <div>
      <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
      <Button onClick={handleApply}>Apply</Button>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}
```

## Testing Strategy
The `calculateDiscountedTotal` function is comprehensively unit tested in `discount-actions.test.ts` covering percent discounts, fixed discounts, edge cases (zero, exceeding subtotal), and rounding. Validation logic is tested manually through the checkout flow.

## What You Learned
- The pattern of client validation for UX + server validation for security
- Using Stripe metadata to pass discount info through payment flow
- Webhook-based post-payment processing for side effects
- Comprehensive unit testing for pure calculation functions

# Lesson: Test Mode — Checkout Integration

## What We Built

The checkout-side wiring for test mode — the feature from PR #53 becomes actually usable.

- `createOrderFromPayment` accepts an optional `{ isTest?: boolean }` and forwards it to the `order` insert.
- New API route `POST /api/checkout/test-place-order` — double-gated (env + KV toggle), either creates a test order via `createOrderFromPayment(syntheticPI, { isTest: true })` (success) or returns a simulated 402 failure (failure).
- Server checkout page reads `env.TEST_MODE_ALLOWED` and `settings.testMode` and passes `testModeActive` + `testModeOutcome` as props to the client form.
- Client `CheckoutForm.tsx` branches on `testModeActive`:
  - Red "TEST MODE ACTIVE" banner above the form.
  - Saved cards + "save card" checkbox hidden.
  - Stripe-configured guard bypassed (no Stripe needed).
  - Submit button becomes "Place Test Order (success|failure)".
  - Submit calls the test-place-order endpoint and navigates straight to `/shop/order/confirmation/{pi_test_...}` on success.

13 new tests. Real Stripe checkout path unchanged.

## Why This Approach

**Why a separate API route instead of branching inside `/api/checkout/create-intent`?** The real create-intent route is heavy — it creates a Stripe customer, generates a clientSecret, attaches metadata — all of which are pointless in test mode. Adding a test-mode branch would leave the bulk of the function inert in one of its paths. A dedicated route is clearer and easier to reason about for security auditing (both gates at the top; no chance of a test-mode branch leaking into the real Stripe code path).

**Why reuse `createOrderFromPayment` via a synthetic PaymentIntent?** That function is the single source of truth for order creation — it handles cart lookup, inventory decrement, cart clearing, total calculation. Duplicating any of that would create drift over time. The cost is a small cast: we build the minimum Stripe.PaymentIntent shape the function actually reads and cast through `unknown as Stripe.PaymentIntent`. Safer than writing a parallel order-creation function.

**Why skip `incrementDiscountUsage` on test orders?** Discount usage counters (`numberOfUses`, `max_uses`) drive real business logic — a code with `max_uses: 100` is invalid after 100 real redemptions. Test orders shouldn't count toward that cap or they'd exhaust real discount codes during QA. Validation still runs so test orders can exercise the discount pricing path; only the counter write is skipped.

**Why navigate directly to `/shop/order/confirmation/{pi_test_...}` instead of the Stripe redirect flow?** In real checkout, Stripe confirms the payment client-side then redirects with query params that our success page reads. In test mode there's no Stripe redirect — we already have the payment intent ID and the order is already created synchronously. Direct `router.push` skips the query-param dance entirely. The confirmation page already handles arbitrary `pi_*` IDs (it just looks up by payment_intent_id).

**Why 402 Payment Required for the failure outcome?** It's the HTTP status code that semantically means "the client's request is valid but a payment failed." More accurate than 500 or 400, and aligns with Stripe's own convention for declined cards.

## Key Concepts

- **Defense in depth:** four independent gates (env var, KV toggle, admin UI render gate, server action gate) plus the API route's two checks. Any single misconfiguration is caught by another layer.
- **Synthetic domain objects for code reuse:** building a minimal shape that satisfies what the consumer reads, then casting through `unknown`. Cheaper than duplicating logic.
- **Preserving discount validation, skipping discount mutations:** a pattern for "exercise this code path but don't mutate persistent state."
- **Test mocking via mutable mock object:** `vi.mock("~/env", () => ({ env: { TEST_MODE_ALLOWED: true } }))` returns a reference that tests can mutate via cast. Less clean than per-test `vi.resetModules()` but much faster to iterate on.

## Code Walkthrough

### The double gate at the top of the route

```ts
if (!env.TEST_MODE_ALLOWED) {
  return NextResponse.json({ message: "..." }, { status: 403 });
}
const settings = await getSiteSettings();
if (!settings.testMode.enabled) {
  return NextResponse.json({ message: "..." }, { status: 403 });
}
```

Both checks return 403 — semantically "forbidden". Client code treats both the same way (shows the error). No need to distinguish from the caller's perspective; the log tells the admin which gate rejected.

### The synthetic PaymentIntent

```ts
const syntheticPI = {
  id: `pi_test_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
  amount: Math.round(finalTotal * 100),
  metadata: { /* same shape as real PI metadata */ },
} as unknown as Stripe.PaymentIntent;
```

Only three fields: `id`, `amount`, `metadata`. That's all `createOrderFromPayment` reads. The UUID strip + slice produces `pi_test_` followed by 24 hex chars — same length-class as real Stripe IDs, distinct prefix for easy DB filtering.

### Client-side mode branch

```tsx
if (testModeActive) {
  const response = await fetch("/api/checkout/test-place-order", {...});
  const { paymentIntentId } = await response.json();
  router.push(`/shop/order/confirmation/${paymentIntentId}`);
  return;
}
// Real Stripe path below (unchanged)
```

Early return before the Stripe Elements render path. `return` avoids accidentally falling through to the real create-intent fetch below.

## Testing Strategy

**13 new tests.**

`create-order-is-test-flag.test.ts` — 4 tests verifying that `createOrderFromPayment` inserts `is_test: false` by default and `is_test: true` when `{ isTest: true }` is passed. Also asserts the synthetic `pi_test_` prefix flows through into the insert.

`test-place-order.test.ts` — 9 tests covering:
- 403 when `TEST_MODE_ALLOWED` env is false
- 403 when `settings.testMode.enabled` is false
- 400 on invalid body
- 402 + no DB write on `outcome=failure`
- 200 + `createOrderFromPayment` called with `{ isTest: true }` on `outcome=success`
- Synthetic `pi_test_` ID generation
- Customer info → metadata pass-through
- Valid discount code flows through to metadata (without incrementing usage)
- Invalid discount code returns 400

No end-to-end UI test — those require a real browser. Verification is manual per the PR description.

## What You Learned

- **Defense in depth scales** — four gates is not too many when the feature's cost of accidental activation is high.
- **Code reuse via synthetic objects** (minimum shape + cast) is simpler than parallel implementations and avoids drift.
- **"Validate but don't mutate"** is a pattern worth naming — it lets test flows exercise validation logic without polluting persistent state.
- **402 Payment Required** has a specific semantic meaning worth reaching for when the scenario fits.
- **TypeScript's `noUncheckedIndexedAccess`** returns `T | undefined` for `Record<K, T>[key]` — caught by typecheck even when runtime is fine. Use `!` non-null assertion only in tests where the value is guaranteed by the setup.

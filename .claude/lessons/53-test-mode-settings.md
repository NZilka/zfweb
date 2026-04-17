# Lesson: Test Mode — Data Model & Settings UI

## What We Built

The first half of the test mode feature: data model, settings toggle, and admin order-list filtering. No checkout behavior change yet — that comes in PR #3.

- New `is_test` boolean column on the `order` table (default false).
- New `testMode` section on `SiteSettings` (KV) with `enabled` + `outcome` ("success" | "failure").
- Zod validation + env-gated server action so the testMode settings cannot be saved unless `TEST_MODE_ALLOWED=true`.
- Admin UI: red Test Mode card rendered at the top of `/admin/settings`, only when the env gate is set.
- Admin orders: filtered to exclude test orders by default, "Show test orders" checkbox to include them, "TEST" badge on test-flagged rows.

## Why This Approach

**Why flag orders in the DB instead of a separate test_orders table?** Reuse — the entire order creation code path (`createOrderFromPayment`, inventory decrement, cart clearing, packing slip rendering, admin fulfillment actions) already handles `order` rows. Adding a parallel table would mean duplicating all of that. A single boolean column lets test orders live alongside real orders, and admin queries filter them out by default.

**Why gate testMode at both the env var AND the KV toggle?** Defense in depth. The env var prevents the entire feature from running in an environment it doesn't belong to (prod). The KV toggle is what an admin flips day-to-day. If either fails, nothing bad happens:
- Env absent, KV enabled → server action rejects, admin UI doesn't render the card, API route rejects (PR #3).
- Env true, KV disabled → feature dormant.
- Env true, KV enabled → feature active (staging intent).

**Why the `includeTest = false` default on admin queries?** Avoids the default admin view accidentally showing test orders. Fulfillment-critical state (counts, "Unshipped" tab) should reflect real customer orders. Test orders are opt-in only.

**Why red styling on the admin card and badge?** Intentional visual alarm — test mode being enabled in prod would be a serious incident. Red makes "this is test data" instantly clear at a glance.

## Key Concepts

- **Env-gated server actions:** checks can happen in Zod (shape) OR in the action body (policy). `TEST_MODE_ALLOWED` is a policy check, so it lives in `updateSettings` after Zod validates the data shape.
- **Drizzle backward-compat merge:** when a new field is added to `SiteSettings`, `getSiteSettings` must explicitly merge it in or old KV data will return without the field. Pattern: `testMode: settings.testMode ?? DEFAULT_SITE_SETTINGS.testMode`.
- **Test mock staleness:** inline `DEFAULT_SITE_SETTINGS` mocks in test files don't auto-update when the type changes. Grep for them and update all whenever adding fields — this is the zfweb memory's "SiteSettings in KV" rule.
- **Drizzle migration files vs db:push:** this project uses `pnpm db:push` (direct sync), not `pnpm db:migrate` (apply SQL). Generated migration files are informational and may bundle stale diffs from prior unmigrated pushes.

## Code Walkthrough

### The env gate in `updateSettings`

```ts
if (parsed.data.testMode && !env.TEST_MODE_ALLOWED) {
  return {
    success: false,
    error: "Test mode is not available in this environment",
  };
}
```

Placed AFTER Zod validation but BEFORE the DB write. Zod tells us the shape is valid; the env check tells us whether we're allowed to apply this shape. Order matters: if env check came first and Zod failed, the user would see a confusing "not available" error for a typo.

### The admin query filter

```ts
if (!includeTest) {
  conditions.push(eq(order.is_test, false));
}
```

Single line added to `getOrdersByFulfillmentStatus`. The function signature grows a second parameter, `includeTest: boolean = false`. Default is false so existing callers get the correct behavior without changes; only the page.tsx passes `true` when the admin opts in via URL param.

### The shared `baseConditions` in `getOrderCounts`

```ts
const baseConditions = includeTest
  ? [eq(order.status, "paid")]
  : [eq(order.status, "paid"), eq(order.is_test, false)];
```

Building conditions once and spreading into each of the 4 parallel count queries (`unshipped`, `in_process`, `shipped`, `all`) avoids repeating the filter four times. Downside: the test file had to learn that `eq(is_test, false)` fires once, not four times, because the result is reused.

### Admin UI visibility gate

```tsx
{testModeAllowed && (
  <Card className="border-red-500 bg-red-50">
    ...
  </Card>
)}
```

The component tree doesn't render at all when `testModeAllowed` is false. This is stronger than `disabled` — there's no DOM node to inspect or manipulate. Combined with the server-side env check in `updateSettings`, the feature is invisible AND inoperable in production.

## Testing Strategy

**13 new tests across 2 files.**

`test-mode-settings.test.ts` covers the env gate, outcome validation, preservation of other settings when testMode is updated, and preservation of testMode when another field is updated. Uses a mutable `env` mock so per-test flipping of `TEST_MODE_ALLOWED` is trivial.

`admin-queries-test-mode.test.ts` covers the SQL filter injection. Uses a spy on drizzle's `eq` function to capture which `(column, value)` pairs were filtered. Tests assert that `eq(order.is_test, false)` fires when `includeTest` is false/omitted and does NOT fire when `includeTest=true`. This approach avoids needing a real DB.

Also updated 5 existing test files' inline `DEFAULT_SITE_SETTINGS` mocks to include `testMode` — satisfies the type checker and prevents runtime `undefined.enabled` errors.

## What You Learned

- When two fields in `SiteSettings` have different authority (one admin-editable, one env-gated), layer the gates: env var + runtime toggle.
- Drizzle migration files are only applied by `db:migrate`; a project using `db:push` can have stale migration files and still work fine.
- Spying on `eq` to verify filter predicates is a clean pattern for testing drizzle queries without a real DB.
- Inline mocks of `DEFAULT_SITE_SETTINGS` are a known liability — consider a shared test helper, but for now the grep-then-patch workflow is explicit and audit-friendly.
- Defense-in-depth for sensitive features: render gate, server-action gate, API-route gate (PR #3), and the env var gate at the top. Any single failure is caught by another.

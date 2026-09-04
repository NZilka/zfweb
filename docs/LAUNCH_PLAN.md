# Launch Plan (September 2026)

Tracker for the work between the 2026-09-03 review and launch. This file is the source of truth for "what is next" across sessions. `docs/ARCHITECTURE_REVIEW.md` holds the findings and the reasoning; this file holds the execution state.

## How to use this file

- Session start: read **Status**, then the current phase. Pick the first unchecked item. Branch names are listed per phase.
- During work: tick items as they land. Keep the acceptance criteria honest; do not tick on "mostly done".
- Session end: update **Status** (branch, last completed, next step, blockers) and commit this file with the code.
- Each phase merges into `staging` through the ff-merge flow in `docs/RELEASE_WORKFLOW.md`, is verified on the staging deploy, and ships to `main` in a batched release PR.

## Status

- Current phase: 0 (code complete, awaiting staging verification)
- Branch: `fix/admin-authz` (three commits: docs, H5 lint/CI/build, authorization)
- Last completed: Phase 0 code, tests (471 passing), lint clean under the 227-warning cap, production build
- Next step: owner enables branch protection with the CI `verify` check (see Owner tasks), verifies the preview deploy, then ff-merge into `staging` per `docs/RELEASE_WORKFLOW.md`. Then start Phase 1 on `feature/checkout-sessions`.
- Blockers: none
- Owner tasks outstanding: see the bottom of this file

## Phase 0: Close the doors (`fix/admin-authz`)

Goal: no unauthenticated or non-admin path can mutate data or read customer PII. Lint and CI work.

- [x] `src/server/auth.ts`: `isAdminUser(userId)` memoized per request, `requireAdmin()` that throws, `checkAdmin()` that returns a boolean. Backed by Clerk `privateMetadata["can-upload"]` for now; Phase 2 moves it to `customer.role`.
- [x] Proxy: `/admin(.*)` requires a signed-in admin (sign-in redirect for anonymous, `/shop` redirect for non-admins). Reuse `isAdminUser` for the staging gate and the maintenance bypass. Tolerate a settings document without `maintenanceMode`.
- [x] Admin layout redirects non-admins to `/shop` (defense in depth).
- [x] `requireAdmin()` is the first line in: settings-actions (all), admin-actions (all), discount-actions (CRUD and list), product-actions (all), shipping-actions (mutations), db_connect (all), deleteAction, and the admin-only reads in queries.ts.
- [x] `order-actions.ts` becomes `server-only`; `incrementDiscountUsage` moves to a `server-only` module; delete `src/server/db/operations.ts`.
- [x] Webhook returns 200 without side effects when an order already exists for the payment intent. Also logs a payment-vs-cart amount mismatch until Phase 1 snapshots line items.
- [x] Cart: remove cart-time reservations; availability is `product.inventory`; `addToCart` rejects non-active products. Shop, product page, and modal read `product.inventory` directly, which removes the per-product query fan-out.
- [x] Account page uses the verified primary email only.
- [x] `next.config.js`: allow `*.ufs.sh` images, remove `ignoreBuildErrors`, set `turbopack.root`. Settings validation accepts both UploadThing hosts.
- [x] ESLint 9 flat config (`eslint.config.mjs`); `pnpm lint` passes; `pnpm check` runs lint and typecheck. Lint ratchet: `--max-warnings 227` in package.json. Lower it whenever a file is cleaned; never raise it. The `any` / unsafe family and stylistic rules are warnings until the count reaches 0, then they become errors.
- [x] CI workflow (`.github/workflows/ci.yml`): typecheck, lint, tests, build on PRs and on pushes to `staging` and `main`.
- [x] Tests: `requireAdmin`, authorization rejection per action module, cart availability, webhook idempotency, email helper, URL helper, proxy admin gate.
- [x] Lesson: `.claude/lessons/62-admin-authz-hardening.md`.
- [ ] Owner: GitHub branch protection on `staging` and `main` requiring the CI `verify` check (Settings, Branches, Add rule: require status checks to pass, select `verify`; for `main` also require a pull request and block force pushes).
- [ ] Verified on staging: a non-admin account cannot reach `/admin` or call an admin action; shop, cart, and checkout still work.

Acceptance: every export of every `"use server"` file is either public by design (cart, discount validation, shipping zones read, URL handle check) or starts with `requireAdmin()`. `pnpm check && pnpm test:run && pnpm build` pass in CI.

Deferred from Phase 0 to later phases: `getProducts` still returns hidden products to the shop (Phase 4, public status filter); server actions still throw instead of returning result objects (Phase 1); `file.url` to `ufsUrl` (Phase 4).

## Phase 1: Checkout Sessions (`feature/checkout-sessions`)

Goal: paid equals shipped; Stripe holds cards; discounts, shipping, and totals come from the session. Design: `docs/ARCHITECTURE_REVIEW.md`, "Checkout Sessions design".

- [ ] Driver: `drizzle-orm/neon-serverless` Pool so `db.transaction()` works.
- [ ] Schema: `order` gains `checkout_session_id` (unique), `amount_subtotal_cents`, `amount_shipping_cents`, `amount_tax_cents`, `amount_discount_cents`, `amount_total_cents`, `promotion_code`, `stripe_customer_id`, `expires_at`; `order_items` gains `unit_price_cents`; `product.price` becomes `price_cents` with a converting migration. Statuses: `pending`, `paid`, `expired`, `refunded`, `canceled`.
- [ ] `createCheckoutSession()` server action: server-side pricing, pending order plus stock hold in a transaction, embedded session with `shipping_options`, `allow_promotion_codes`, `shipping_address_collection` (US), gift `custom_fields`, `expires_at` 30 minutes out, `metadata.orderId`.
- [ ] Checkout page: `<EmbeddedCheckoutProvider>` and `<EmbeddedCheckout>`; the return page reads `session_id` and shows a pending state until the webhook lands.
- [ ] Webhook: `checkout.session.completed`, `async_payment_succeeded`, `async_payment_failed`, `expired`, `charge.refunded`. Idempotent by session id. Verify `amount_subtotal` against the pending order.
- [ ] Delete: `create-intent`, `payment-methods`, `test-place-order`, the old `CheckoutForm` address and payment UI, `DiscountCodeInput`, `discount-actions` with its table and admin page, `stripe-sync.ts`, KV Stripe prefixes, shipping zone and rate tables with their admin page, custom test mode (settings, UI, env gate).
- [ ] Email: Resend and React Email for order confirmation (from the webhook) and shipping notification (from fulfillment).
- [ ] Cart and checkout UI errors return result objects, not thrown errors.
- [ ] Tests: session builder (pricing, holds, options), webhook state machine, refunds, expiry release.
- [ ] Verified on staging with test cards, including a promotion code, an expired session, and a refund.

## Phase 2: Accounts and wholesale (`feature/wholesale`)

- [ ] Schema: `customer.role`, `customer.tier`, `customer.wholesale_status`; `wholesale_application` table; `product.wholesale_price_cents`, `product.wholesale_min_qty`.
- [ ] Clerk `user.created` webhook creates the `customer` row. `requireAdmin()` switches to `customer.role`. Bootstrap script sets the owner's row to `admin`.
- [ ] Storefront renders wholesale prices only for approved wholesalers (server-rendered). Session pricing uses the tier.
- [ ] Wholesale application form (signed-in only) and an admin queue with approve and reject.
- [ ] Account page: orders by verified email, wholesale status, link to Stripe-managed payment methods if wanted.
- [ ] Tests: tier pricing, application state machine, admin queue authorization.

## Phase 3: Performance and mobile (`fix/shop-perf`)

- [ ] N+1 fixes through Drizzle `relations()` (cart items, orders with items, admin orders list, category counts).
- [ ] Single `getCart()` action; expiry bump at most daily; initial cart passed from the layout.
- [ ] `getSiteSettings` wrapped in React `cache()`; `"use cache"` with `cacheTag("site-settings")`; drop `force-dynamic` where the tag covers it. Proxy reads the maintenance flag from a short-TTL in-process cache or Edge Config.
- [ ] Images: `sizes` on `fill` images, `priority` above the fold, lazy hover images. Carousel video gets a poster and `preload="metadata"`.
- [ ] Product card `w-full max-w-[375px]`, verified at 320px.

## Phase 4: Launch polish (feature branches as needed)

- [ ] Remaining features and UI from the owner's list.
- [ ] Public queries filter `status = 'active'`; product URLs by `url_handle`; `generateMetadata`, Product JSON-LD, `sitemap.ts`, `robots.ts`; one `h1` per page.
- [ ] Security headers (CSP, frame-ancestors, Referrer-Policy, Permissions-Policy).
- [ ] Analytics consent gate for PostHog.
- [ ] Sentry; structured logging without PII.
- [ ] Versioned Drizzle migrations run on deploy; remove the stale `src/server/db/migrations/` folder.
- [ ] Dead code removal (list in the review); UploadThing `file.url` to `ufsUrl`.
- [ ] Post-launch: evaluate Supabase consolidation (database, auth, storage) and Better Auth together; Cloudflare only if cost or bot abuse drives it.

## Owner tasks (dashboard actions Claude cannot do)

- [ ] Clerk: enable MFA (TOTP or passkey) on the admin account.
- [ ] Neon: move to a paid plan or disable autosuspend before launch.
- [ ] Stripe: promotion codes, shipping rates, webhook endpoints for Checkout events on staging and prod, receipts on, a restricted API key (`rk_`) replacing `sk_`.
- [ ] Resend: verify the sending domain.
- [x] Vercel: Pro plan.

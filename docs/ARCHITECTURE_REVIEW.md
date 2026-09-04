# Architecture, Security and Performance Review

Date: 2026-09-03. Branch reviewed: `staging` at `6abf9c0`. Reviewer: Claude (Fable 5.1).

This is a point-in-time review. Line numbers refer to the commit above and will drift.

## Scope and method

- Read every server module, API route, the proxy, the schema, the checkout flow, the admin server actions, and the main shop and admin components.
- Ran the project's own checks: `pnpm check` (pass), `pnpm test:run` (33 files, 423 tests, pass), `pnpm lint` (fails to start, see H5), `pnpm build` (pass), `pnpm audit --prod` (could not reach the npm registry from the review sandbox, so this was not run).
- Ran the dev server against the configured local environment and checked `/shop` at desktop and 320px widths.
- Inspected the production build's server-reference manifest to confirm which server actions are reachable.
- Stripe recommendations are cross-checked against Stripe's current integration guidance: Checkout Sessions for on-session payments, never pass `payment_method_types`, restricted API keys, signed webhooks.

## What the app is

Single-vendor storefront for Zilka Forgewerks (handmade jewelry and tools), pre-launch, owner-operated. Audience: shoppers (mostly guest checkout) and one admin. Second purpose: proof of concept for a future multi-maker marketplace (crft). Stack: Next.js 16 App Router, Neon Postgres via Drizzle (neon-http driver), Clerk, Stripe Payment Element on PaymentIntents, Upstash Redis (site settings plus a Stripe state cache), UploadThing, PostHog, Vercel with a `staging` branch deploy.

## Executive summary

For a solo project the codebase is well organized, documented, and tested. The staging workflow, the env tripwires, and the lesson files are better than most small shops have. The problems below come from two root causes, and both must be fixed before launch:

1. **Authorization is enforced in the UI, not at the endpoint.** Every export of a `"use server"` file is an HTTP endpoint. Many have no auth check. The ones that do check only "signed in", not "admin", and anyone can sign up through the shop's Clerk button. The production build confirms all 51 actions are registered, including ones no client imports.
2. **Orders are built from live cart state at webhook time, not from what was paid for.** The amount charged and the items shipped are never reconciled, and the stored total ignores discounts.

After those, the highest-value changes are: move checkout to Stripe Checkout Sessions (deletes roughly 40% of the payment code and closes several findings at once), fix the query fan-out on the shop page, add CI, and repair lint.

## Findings

Severity: Critical = exploitable or money-losing at launch. High = will bite within weeks. Medium = should be scheduled. Low = hygiene.

### Critical

**C1. Admin mutations require only "signed in", and sign-up is public.**
Every visitor can create a Clerk account from the shop nav (`SignInButton mode="modal"`). These actions then accept them:
- `updateSettings` at [settings-actions.ts:168](../src/server/settings-actions.ts:168): maintenance mode, logo, carousel, About copy, test mode.
- `addProduct` at [db_connect.tsx:50](../src/app/admin/_components/db_connect.tsx:50) has no auth check at all. `updateProduct` at line 96 and the category actions check `userId` only.
- `deleteProductsAction` at [product-actions.ts:75](../src/server/product-actions.ts:75), `updateProductSortOrder`, and all shipping zone and rate actions from [shipping-actions.ts:160](../src/server/shipping-actions.ts:160) onward.
- `updateOrderFulfillment` at [admin-actions.ts:138](../src/server/admin-actions.ts:138) and `markOrdersDownloaded` at line 199 have no auth check at all.
Only the UploadThing routes and the staging gate check the real admin flag (`privateMetadata["can-upload"]`). Admin pages such as [admin/page.tsx:56](../src/app/admin/page.tsx:56) fetch data server-side and then hide it behind `<SignedIn>`, and the proxy at [proxy.ts:46](../src/proxy.ts:46) never protects `/admin`.
All of these except `markOrdersDownloaded` are imported by client components, so their action IDs ship in the browser bundle (verified in `.next/static`). They are fully public endpoints.

**C2. Discount codes: full CRUD is unauthenticated.**
`createDiscount` at [discount-actions.ts:71](../src/server/discount-actions.ts:71), `updateDiscount`, `deleteDiscount` at line 156, `toggleDiscountActive`, and `incrementDiscountUsage` at line 273 have no auth check. All but `incrementDiscountUsage` ship their action IDs to the browser. Anyone can create a 99% code and use it (100% is blocked only by the $0.50 Stripe minimum).

**C3. Customer PII is readable without authentication.**
`generatePirateShipCsv(orderIds)` at [admin-actions.ts:34](../src/server/admin-actions.ts:34) returns names, addresses, and emails for any order IDs as CSV, with no auth. Its ID ships in the browser bundle.
`getOrderById(orderId)` at [order-actions.ts:126](../src/server/order-actions.ts:126) returns the same data by sequential ID. This is the IDOR the team closed by disabling `/shop/order/[id]`, reopened through the action layer. Its ID is not in a client bundle, so today it is reachable only by someone who obtains the build-specific action ID, but it is registered and unauthenticated.

**C4. Pay-for-less: the amount charged is decoupled from the order contents.**
`create-intent` fixes the PaymentIntent amount from the cart at that moment ([create-intent/route.ts:117](../src/app/api/checkout/create-intent/route.ts:117)), but the webhook builds the order from the cart as it exists when `payment_intent.succeeded` arrives ([order-actions.ts:58](../src/server/order-actions.ts:58)). A shopper can start checkout with a $5 cart, add $500 of items in a second tab, then confirm the $5 payment. `paymentAmount` is computed at line 70 and never compared. The stored `total` at line 82 is the pre-discount cart total, so discounted orders show the wrong amount everywhere and the discount is never persisted.

**C5. Unauthenticated order creation is a registered endpoint.**
`createOrderFromPayment` at [order-actions.ts:18](../src/server/order-actions.ts:18) is exported from a `"use server"` file. It accepts a caller-supplied PaymentIntent-shaped object and creates a `status: "paid"` order for the caller's own cart, decrementing inventory, with no payment. The build manifest registers it (9 actions from this module). As with `getOrderById`, its ID is not shipped to the browser today, so this is a latent rather than open door, but the module should not be an action module at all. It is only called from the webhook and the test route, both server-side.

**C6. Inventory denial of service through cart reservations.**
Availability is inventory minus the quantity in every non-expired cart ([cart-actions.ts:28](../src/server/cart-actions.ts:28)). Sessions last 30 days (line 12) and are extended on every read (line 80). Any visitor can clear their cookie, get a new session, and add the maximum quantity of every product, repeatedly. Every product then shows "Sold out" to everyone for 30 days. There is no rate limit, cap, or bot check.

### High

**H1. Webhook is not idempotent and cannot recover from partial failure.**
Stripe retries `payment_intent.succeeded` on any non-2xx for up to three days. `createOrderFromPayment` inserts the order, loops item inserts and inventory updates, then clears the cart, as separate HTTP queries with no transaction. The neon-http driver throws "No transactions support" (confirmed in the installed `drizzle-orm/neon-http/session.js`). A retry after the cart was cleared throws "No items in cart" and returns 500 forever. A failure mid-loop leaves an order with missing items and stock not decremented.

**H2. Discount usage counting is racy.**
Validation checks `numberOfUses < max_uses` at intent time; the increment happens at webhook time. Any number of concurrent checkouts pass validation.

**H3. Clerk primary email is not used.**
[account/page.tsx:27](../src/app/shop/account/page.tsx:27) reads `user.emailAddresses[0]`, which is not guaranteed to be the primary or a verified address. `linkGuestOrdersToUser` then attaches every guest order with that email to the account, and the order list is filtered by it.

**H4. No rate limiting on checkout, cart, or discount endpoints.**
`create-intent` creates a Stripe Customer and PaymentIntent per call. `validateDiscountCode` can be brute-forced. `addToCart` enables C6. Upstash is already provisioned for rate limiting per PROJECT.md but is not used for it.

**H5. Lint is dead, CI does not exist, and the build ignores type errors.**
`pnpm lint` fails to start because ESLint 9 needs `eslint.config.js` and the repo has `.eslintrc.cjs`. Next 16 no longer runs ESLint at build. [next.config.js:22](../next.config.js:22) sets `typescript.ignoreBuildErrors: true`. CLAUDE.md describes `pnpm check` as "Lint + typecheck" but it is only `tsc`. The two GitHub workflows are Claude review bots; nothing runs tests or typecheck, although `docs/RELEASE_WORKFLOW.md` says the release PR must pass "required GitHub status checks (CI, typecheck)".

**H6. UploadThing URL format drift will break images.**
The installed SDK (uploadthing 7.7.4) marks `file.url` as deprecated ("removed in v9, use `ufsUrl`"). The code uses `file.url` throughout ([core.ts:61](../src/app/api/uploadthing/core.ts:61) and the admin uploaders). [next.config.js:19](../next.config.js:19) allows only `utfs.io`, and carousel validation hardcodes that host at [settings-actions.ts:77](../src/server/settings-actions.ts:77). The restaging script already expects `<appId>.ufs.sh` URLs. Any `ufs.sh` URL reaching `next/image` throws during render and the page fails.

**H7. Server-action error messages are masked in production.**
Cart and checkout actions signal failure with `throw new Error("Only 3 available")` and the UI shows `err.message` ([AddToCartButton.tsx:45](../src/app/shop/_components/AddToCartButton.tsx:45)). Production builds replace thrown server-action messages with a generic message and digest, so shoppers see an unhelpful error instead of the stock message. The settings and discount actions already use the better pattern of returning `{ success, error }`.

### Medium

**M1. Shipping and tax are never charged.** Admin has full zones and rates, but checkout hardcodes "Shipping: Free" ([checkout/page.tsx:112](../src/app/shop/checkout/page.tsx:112)) and computes nothing. No tax at all. The cart drawer promises "calculated at checkout".

**M2. Hidden products are public.** `getProducts` at [queries.ts:12](../src/server/queries.ts:12) and `getPublicProductById` do not filter `status`, so `hidden` products render in the grid, in search, and by URL. `addToCart` does not check status either, so an admin-set `sold_out` product can still be bought while `inventory > 0`.

**M3. No transactional email.** The confirmation page says "A confirmation email has been sent" ([confirmation page:54](../src/app/shop/order/confirmation/[payment_intent]/page.tsx:54)) but nothing sends one. Only Stripe's `receipt_email` is set, which Stripe honors only when enabled in the Dashboard and not in test mode. Tracking numbers are captured and never sent.

**M4. Refunds, disputes, and cancellations are not modeled.** The webhook handles only PaymentIntent events ([webhook/route.ts:65](../src/app/api/stripe/webhook/route.ts:65)). No `charge.refunded` or `charge.dispute.created`, no refunded status, inventory is never restored. The Stripe plan document listed these.

**M5. No security headers.** No `headers()` in `next.config.js`: no Content-Security-Policy, frame-ancestors, Referrer-Policy, or Permissions-Policy. Vercel adds HSTS only.

**M6. The proxy does network I/O on every page request.** `getMaintenanceSettings` at [kv-middleware.ts:71](../src/server/kv-middleware.ts:71) creates a new Upstash client and makes a REST call for every non-API, non-admin request. Dev logs showed `proxy.ts: 1298ms` on some requests. If the stored settings document ever lacks `maintenanceMode`, the `.enabled` access throws outside the try/catch and every page returns 500.

**M7. Guest order pages are permanent capability URLs.** `/shop/order/confirmation/{pi_…}` shows name, address, and email to anyone with the link, forever. Acceptable for a confirmation page, but signed-in users should be checked for ownership and guest links should expire.

**M8. Analytics without consent.** PostHog initializes for every production visitor ([posthog.tsx:24](../src/lib/posthog.tsx:24)) while checkout ships to many countries. EU and UK visitors need consent for analytics cookies.

**M9. Money as floats.** Prices flow through `parseFloat(price) * qty` and `toFixed(2)` in cart totals, discounts, and order creation. Percent discounts on multi-item carts can differ by a cent between the client preview, the intent, and the stored order. Store and compute in integer cents.

**M10. Schema and migration issues.**
- `shipping_zone_country.uniqueCountry` at [schema.ts:327](../src/server/db/schema.ts:327) is a plain `index`, not `uniqueIndex`, so a country can sit in two zones.
- `address.zip` at [schema.ts:144](../src/server/db/schema.ts:144) is `integer`, which drops leading zeros. The table is unused today.
- `order.products` duplicates `order_items`; `customer.email` is not unique; `shopping_session.total` is a cache recomputed with N+1 queries.
- Two migration folders exist (`drizzle/` and `src/server/db/migrations/`), and prod schema is applied by hand with `db:push`, with no history or review.

**M11. Stripe client setup.** Three separate Stripe singletons ([stripe.ts:17](../src/server/stripe.ts:17), `stripe-sync.ts`, `stripe-customer.ts`) pin `2025-12-15.clover`; the current API version is `2026-06-24.dahlia`. Use one client, the SDK default version, and a restricted key (`rk_`) scoped to PaymentIntents, Customers, PaymentMethods, and Checkout instead of `sk_`.

**M12. Tests do not cover authorization or money paths.** 423 passing tests, but none assert that an unauthenticated or non-admin caller is rejected, and none exercise the webhook end to end (amount reconciliation, idempotency).

### Low and hygiene

- Dead modules never imported: `src/server/db/operations.ts`, `AdminPageClient.tsx`, `UploadBox.tsx`, `ProductInventory.tsx`, `ImgPathContext.tsx`, `ui/calendar.tsx`, `ui/popover.tsx`, `ui/dropdown-menu.tsx`, `ui/separator.tsx`. 24 exported server functions have no callers, including `syncPaymentStateToKV`, `linkStripeCustomerToUser`, `getOrderStateCache`, `toggleMaintenanceMode`, and the PostHog query stubs that always return 0. `date-fns` and `react-day-picker` can be removed with the calendar.
- [db/index.ts:10](../src/server/db/index.ts:10) loads `dotenv` inside the app bundle at runtime. Keep dotenv in scripts only.
- Four identical UploadThing middlewares in `core.ts`; extract one `adminUploadMiddleware`.
- 35 `console.log` calls, several with user IDs or emails. Use structured logging and scrub PII.
- `README.md` is the create-t3-app boilerplate. `stripe.tar.gz` (9 bytes) is committed.
- Accessibility: every product card title is an `h1`; checkout labels are not associated with inputs; `confirm()` dialogs; the carousel has no pause control and ignores `prefers-reduced-motion`.
- `zod` v4 with v3 idioms (`z.string().email()`), `@types/node` 20 on a Node 24 runtime, `@types/eslint` 8 with ESLint 9.
- Next.js warns about a stray `/Users/nathanz/package-lock.json`; set `turbopack.root` or remove it.

## Performance

**P1. The shop home fans out to about three queries per product.** `ProductGrid` calls `getAvailableInventory` per product ([shop/page.tsx:23](../src/app/shop/page.tsx:23)). Each call does a product lookup, loads every non-expired session row, then the cart items ([cart-actions.ts:28-52](../src/server/cart-actions.ts:28)). With the 8 products on staging that is roughly 25 round trips to Neon plus 2 Upstash reads before first byte. At 50 products it is about 150. Dev measurement: `render: 5.8s` cold and about 1s warm. Production will be faster, but the shape is the same. Fix: one aggregate query grouped by product, or drop reservations (C6) and read `inventory` directly.

**P2. N+1 queries elsewhere.** `getCartItems` ([cart-actions.ts:129](../src/server/cart-actions.ts:129)), `recalculateCartTotal` (line 332), `createOrderFromPayment`, `getOrderById`, `getOrdersByFulfillmentStatus` ([admin-queries.ts:109](../src/server/admin-queries.ts:109)), and `getProductCountByCategory` ([queries.ts:116](../src/server/queries.ts:116)) which loads every row to count them. Define Drizzle `relations()` and use `with` or joins.

**P3. Cart chatter.** `CartProvider` fetches on mount through two server actions ([CartContext.tsx:69](../src/app/_context/CartContext.tsx:69)), and each calls `getOrCreateSession`, which does a SELECT plus an UPDATE to bump expiry on every call. Every cart mutation refetches everything. Dev logs show three to four `POST /shop` action calls per page view. Fix: one `getCart()` action, bump expiry at most daily, and pass the initial cart from the layout so first paint is not a loading state.

**P4. Site settings are read three to four times per request.** The proxy, `TopNav`, `getCarouselData`, and the page each call `getSiteSettings` ([kv.ts:322](../src/server/kv.ts:322)) as separate Upstash round trips. Wrap in React `cache()` for per-request dedupe, and use `"use cache"` with `cacheTag("site-settings")` and `revalidateTag` in `updateSettings`. Most shop pages then no longer need `force-dynamic`.

**P5. Images.** `fill` images have no `sizes` (grid, gallery, carousel), so `next/image` emits a full-viewport srcset. At 320px the browser loaded a 320w image for a 375px box (upscaled), and desktop loads oversized variants. No `priority` on the first carousel or product images. Hover images for every card download eagerly.

**P6. Carousel video** ([Carousel.tsx:168](../src/app/shop/_components/Carousel.tsx:168)) serves up to 32MB of MP4 straight from UploadThing, autoplaying on the home page, with no poster, preload control, or transcoding. On mobile data this is the LCP. Use a video host with HLS and a poster (Mux, Cloudflare Stream) or at least enforce a small encode with `preload="metadata"` and a poster.

**P7. Admin products and settings** load every product with every image URL. Fine at 8 products; paginate before it matters.

**P8. `posthog-js`** loads on every page. Consider lazy init after first interaction.

## Mobile check

- At 320px the product card (`w-[375px]` at [shop/page.tsx:47](../src/app/shop/page.tsx:47)) overflows. Measured: left -27.5px, right 347.5px. Content is clipped rather than scrollable because `globals.css` sets `overflow-x: clip`. This violates the project's own 320px checklist. Use `w-full max-w-[375px]`.
- The cart page and drawer disable the "+" button by `item.product.inventory` ([cart/page.tsx:170](../src/app/shop/cart/page.tsx:170)), not available inventory, so pressing it can throw a server error that is swallowed silently. With H7 the shopper gets no feedback.

## Architecture: what I would change

**A1. Replace the custom PaymentIntent checkout with Stripe Checkout Sessions.**
Stripe's guidance is Checkout Sessions for on-session payments, with the Payment Element backed by a Checkout Session (`ui_mode: "custom"`) if you want to keep the current look. This deletes the `create-intent` route, the saved-payment-method route and UI, `stripe-sync.ts`, the KV payment-state cache, the custom discount table (Stripe Coupons and Promotion Codes cover usage limits, expiry, first-purchase-only, minimum amount, and free shipping), and the shipping tables if you use `shipping_options` and `shipping_address_collection`. It adds Link, Apple Pay and Google Pay, Stripe Tax, adaptive pricing, receipts, and address validation for free. Line items are frozen in the session, which fixes C4. The `checkout.session.completed` event carries the amount and line items, which fixes total and discount persistence. It is also the path that scales to a Connect marketplace for crft (Standard connected accounts with `transfer_data`). Keep the cart, the order table (created from `checkout.session.completed`), and admin fulfillment. Effort is roughly the size of the existing checkout and mostly deletion.

If you keep PaymentIntents: implement the snapshot in A3, keep `automatic_payment_methods` (already correct; never pass `payment_method_types`), and use Setup Intents for saved cards.

**A2. Authorization as a layer, not a habit.**
- Put the admin role in Clerk `publicMetadata` (for example `{ role: "admin" }`) and add it to the session token through Clerk's session customization, so it is available as `sessionClaims.metadata.role` without a Backend API call on every request.
- Add `src/server/auth.ts` with a `requireAdmin()` helper that reads the claim and throws.
- Call it first in every admin server action, in the admin layout, and in the proxy for `/admin` routes.
- Move admin actions out of `src/app/admin/_components/db_connect.tsx` into `src/server/admin/`. Mark internal modules `server-only`. Rule: a file is either `"use server"` (public endpoints, every export validated and authorized) or `server-only` (internal), never both roles. `order-actions.ts` should be `server-only`.

**A3. Orders as the source of truth, with transactions.**
Create a `pending` order and `order_items` snapshot (unit price, quantity, discount, shipping, tax, `amount_cents`) when checkout starts. Flip to `paid` in the webhook after verifying `amount_received` against the snapshot. Add `refunded` and `canceled`. Switch the DB driver to `drizzle-orm/neon-serverless` (Pool) so `db.transaction()` works; Vercel Fluid Compute reuses connections. Drop `shopping_session.total` and `order.products`.

**A4. Inventory model.**
Remove cart-time reservation. Check availability at add (soft), at checkout start (hard, with a 15-minute hold only if you want one), and decrement inside the paid transaction with `WHERE inventory >= qty`. This turns C6 and P1 into one SELECT.

**A5. Settings and caching.**
Keep Upstash for rate limiting and possibly the maintenance flag. Read settings once per request (`cache()`), cache across requests with `"use cache"` and tags, and consider moving the settings document into a Postgres `site_settings` jsonb row so it is transactional and lives in the same backup and branching story as the rest of the data. Vercel Edge Config is the purpose-built option for the proxy-level flags.

**A6. Delivery pipeline.**
CI (typecheck, lint, tests, build) required on `staging` and `main`. Versioned Drizzle migrations run on deploy. Remove `ignoreBuildErrors`. Sentry for error tracking (listed in PROJECT.md, not installed). Resend or Postmark for email. A Playwright smoke test of guest checkout with Stripe test cards against the staging URL.

**A7. SEO for launch.**
Product URLs by `url_handle` (stored, unused). `generateMetadata` with title, description, and OG image per product. Product JSON-LD. `sitemap.ts` and `robots.ts`. One `h1` per page. Without these the store is invisible to search and link previews.

## Decisions (owner answers, 2026-09-03)

1. **Timeline:** roughly 2 to 3 weeks (target late September 2026) to finish features, UI, and open design questions, then launch. Volume will be low at first, so cart-time reservations are dropped in favor of a short hold during checkout.
2. **Guest checkout is the product.** Cards should be saved by Stripe, not by us. Customers can still create accounts. Two new features are planned: customers apply to become wholesalers, and products carry a retail and a wholesale price.
3. **Domestic (US) shipping only at launch.** Flat rates via Stripe `shipping_options`; the zones and rates tables are retired.
4. **Checkout Sessions migration: yes.** Details below.
5. **Platform:** stay on Vercel plus Neon through launch. Evaluate a Supabase consolidation (database, auth, storage) after launch; Cloudflare only if hosting cost or bot abuse becomes the driver. Reasoning in the "Platform and auth" section below.
6. **No other Clerk accounts exist today.** Clerk stays through launch. Roles and wholesale tier live in our database, not in Clerk metadata, so a later auth move stays cheap.

## Checkout Sessions design

Keep the cart, the `order` and `order_items` tables, and admin fulfillment. Replace everything between "Proceed to checkout" and "order paid" with one server action and one webhook.

- `createCheckoutSession()` (server action, signed-in or guest):
  - Prices every line server-side from the DB by the customer's tier (retail or wholesale). Never from the client.
  - Inserts a `pending` order with items, unit prices, and `amount_cents`, holding stock with `UPDATE product SET inventory = inventory - qty WHERE id = $1 AND inventory >= qty` inside a transaction (requires the `neon-serverless` driver).
  - Creates the session with `ui_mode: "embedded"`, `line_items[].price_data` (ad hoc prices, `product_data.metadata.productId`), `allow_promotion_codes: true`, `shipping_address_collection: { allowed_countries: ["US"] }`, `shipping_options` with one or two `shipping_rate_data` entries computed from the subtotal, `customer` for signed-in users or `customer_creation: "always"` for guests, `expires_at` 30 minutes out, `metadata: { orderId }`, and a `custom_fields` dropdown for the gift flag. Never `payment_method_types`.
  - Stores `checkout_session_id` (unique) on the order and returns the `client_secret` to `<EmbeddedCheckout>`.
- Webhook: `checkout.session.completed` and `checkout.session.async_payment_succeeded` mark the order paid, copying `amount_total`, `amount_shipping`, `amount_tax`, `total_details.amount_discount`, the promotion code, and the shipping address from the session, after checking `amount_subtotal` equals the order's `amount_cents`. `checkout.session.expired` and `async_payment_failed` release the stock hold. Idempotent by `checkout_session_id`.
- Deleted: `create-intent` and `payment-methods` routes, the address and payment forms in `CheckoutForm.tsx`, `DiscountCodeInput.tsx`, `discount-actions.ts` and the `discount` table and admin page (Stripe Promotion Codes replace them; a free-shipping code is not a Stripe concept, so model free shipping as a subtotal threshold), `stripe-sync.ts`, the KV Stripe prefixes, the shipping zone and rate tables and admin page, and the custom test mode (Stripe test keys plus test cards cover staging).
- Saved cards: Link saves details for guests under their email with Stripe; for account holders, Checkout offers "save for next time" against the Stripe Customer. Nothing card-related is stored here.
- Later, if the design needs more control than embedded Checkout allows, switch to `ui_mode: "custom"` with the Payment and Address Elements. The server side and webhook do not change.

## Wholesale model

- `customer` gains `role` (`customer` or `admin`), `tier` (`retail` or `wholesale`), and `wholesale_status` (`none`, `pending`, `approved`, `rejected`).
- New `wholesale_application` table: `customer_id`, business name, website, resale certificate number (store the number, not a document; the UploadThing bucket is public), message, status, submitted and reviewed timestamps, reviewer notes.
- `product` gains `wholesale_price_cents` (nullable) and optional `wholesale_min_qty`. Existing `price` moves to `price_cents`.
- Wholesale pricing is applied only when the session is created for a signed-in customer whose `tier` is `wholesale`. The storefront renders wholesale prices only for those users.
- Admin gets an applications queue with approve and reject. Wholesale requires an account, which is the reason accounts exist.
- `requireAdmin()` reads `customer.role` by `clerk_user_id` (one indexed query, memoized per request). A Clerk `user.created` webhook creates the `customer` row eagerly, which also fixes the fragile email-based order linking.

## Platform and auth

**Vercel plus Neon through launch.** The platform is not what is wrong with the app; the code is, and a hosting migration would consume most of the 2 to 3 weeks. Two things to check now: the Vercel Hobby plan does not allow commercial use, so the store needs Pro; and Neon's free tier suspends the database after a few minutes idle, which adds roughly half a second to the first request after a quiet period, so move to a paid Neon plan or disable autosuspend before launch.

**Cloudflare.** Next.js runs there through the OpenNext adapter, which trails Next releases. Before considering it, verify support for Next 16, `proxy.ts`, cache components, and `next/image` (which needs Cloudflare Images or a custom loader), and Clerk's middleware under the Workers runtime. The upside is cost (about $15 a month less) and a strong free WAF and rate limiting. The downside is a week of adapter work and being first to hit each Next release's edge cases.

**Supabase.** Worth evaluating after launch as a consolidation of database, auth, and storage into one vendor, which would drop Neon, Clerk, UploadThing, and Upstash. Drizzle works unchanged on Supabase Postgres, and the pooled connection supports transactions. The cost is rewriting auth and uploads, roughly a week, and losing Clerk's prebuilt UI. Do it as one planned migration, not during the launch sprint.

**Auth.** Clerk is fine through launch and free at this scale. Two immediate actions: enable MFA (TOTP or passkey) on the admin account, since it is the single point of failure for the store, and keep roles in the database as above. If a move is wanted later, Better Auth (users in your own Postgres via a Drizzle adapter, with organization and admin plugins) fits the marketplace direction; Supabase Auth only makes sense if the database moves too. Decide auth and database together.

## Revised plan

| Phase | Days | Scope |
| --- | --- | --- |
| 0. Close the doors | 1 to 2 | `requireAdmin()` on every admin action and in the proxy and admin layout; `order-actions.ts` to `server-only`; remove cart reservations; `emailAddresses[0]` to primary verified email; UploadThing `ufs.sh` remote pattern; flat ESLint config; CI workflow; remove `ignoreBuildErrors`; admin MFA. |
| 1. Checkout Sessions | 3 to 5 | Design above. Switch driver to `neon-serverless`. Integer cents. Idempotent webhook. Delete discounts, shipping tables, KV Stripe cache, test mode. Resend for order confirmation and shipping emails. Refund handling via `charge.refunded`. |
| 2. Wholesale and accounts | 2 to 3 | Model above. Clerk `user.created` webhook. Applications queue in admin. Tiered pricing in the storefront and session creation. |
| 3. Performance and mobile | 1 to 2 | Aggregate inventory query, N+1 fixes, single `getCart()` action, per-request settings cache and cache tags, image `sizes` and `priority`, card width at 320px, carousel video poster and preload. |
| 4. Launch polish | ongoing | Remaining features and UI; SEO (slugs, metadata, JSON-LD, sitemap); security headers; analytics consent; Sentry; versioned migrations; dead code removal. |

## Verification log

- `pnpm check`: pass.
- `pnpm test:run`: 33 files, 423 tests, pass in 4.8s.
- `pnpm lint`: fails with "ESLint couldn't find an eslint.config.(js|mjs|cjs) file".
- `pnpm build`: pass. Server-reference manifest registers 51 actions, including 9 from `order-actions.ts`.
- `pnpm audit --prod`: not run, npm registry unreachable from the review environment. Run it locally.
- Dev server plus browser: `/shop` renders; 8 products and 1 video slide on staging; 320px card overflow measured; dev timings from Next logs (`proxy.ts: 1298ms`, `render: 5.8s` cold, about 1s warm).
- Git: no `.env` file was ever committed; `staging` is 22 commits ahead of `main`; no `vercel.json`.
- Installed: next 16.1.1, react 19.2.3, @clerk/nextjs 6.36.7, stripe 20.1.2, drizzle-orm 0.45.1, uploadthing 7.7.4, Node 24.15.
- Added `.claude/launch.json` so the desktop app can start `pnpm dev` for previews.

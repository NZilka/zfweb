# Architectural Patterns

This document describes patterns used consistently across the zfweb codebase.

## Server/Client Component Split

**Pattern:** Server components fetch data; client components handle interactivity.

- Server components use direct database queries (`await db.query...`)
- Client components marked with `"use client"` for forms, modals, file inputs
- Examples:
  - Server: `src/app/shop/page.tsx:13` - fetches products directly
  - Server: `src/app/admin/_components/ProductEdit.tsx:5` - fetches single product
  - Client: `src/app/admin/_components/ProductForm.tsx:1` - form with state
  - Client: `src/app/admin/_components/FileSelector.tsx:1` - file input handling

## Server Actions

**Pattern:** Database mutations use the `"use server"` directive.

- Defined at file top or inline within server components
- Called directly from client components without API routes
- Examples:
  - `src/app/admin/_components/db_connect.tsx:1` - `addProduct()` action
  - `src/app/admin/_components/ProductEdit.tsx:44` - `deleteAction()` inline
  - `src/server/queries.ts:1` - query and mutation functions

## Force-Dynamic Rendering

**Pattern:** Pages requiring fresh data use `export const dynamic = "force-dynamic"`.

- Prevents Next.js from caching database responses
- Used on pages displaying inventory or product lists
- Examples:
  - `src/app/shop/page.tsx:6`
  - `src/app/admin/_components/ProductInventory.tsx:5`

## Context-Based Form State

**Pattern:** React Context manages form state across related components.

- Separate contexts for different concerns (product data, files, image previews)
- Providers nested in page component, consumed by children
- Context location: `src/app/_context/`
- Provider nesting: `src/app/admin/page.tsx:16-25`

| Context | Purpose | File |
|---------|---------|------|
| ProductContext | Form field values | `src/app/_context/ProductContext.tsx` |
| FileContext | File objects before upload | `src/app/_context/FileContext.tsx` |
| ImgUploadContext | Local preview paths | `src/app/_context/ImgUploadContext.tsx` |

## Parallel Routes for Modals

**Pattern:** Next.js parallel routes enable modal overlays without losing page context.

- Layout accepts `modal` slot: `src/app/admin/layout.tsx:14-26`
- Default returns null when no modal: `src/app/admin/@modal/default.tsx`
- Intercepting routes use `(.)` prefix for same-level interception
- Modal uses `createPortal` to render into `#modal-root`: `src/app/admin/@modal/(.)product/[id]/modal.tsx:1`

**File structure:**
```
/admin
  /@modal                    # Parallel route slot
    /default.tsx             # Null when inactive
    /(.)product/[id]/        # Intercepts /admin/product/[id]
      /page.tsx
      /modal.tsx
  /product/[id]/             # Direct access route
    /page.tsx
```

## Database Schema Conventions

**Pattern:** All tables use `zfweb_` prefix and standard timestamp fields.

- Table prefix configured in `drizzle.config.ts:11`
- Timestamps: `createdAt` defaults to `now()`, `updatedAt` updates automatically
- Schema defined in: `src/server/db/schema.ts`

**Standard table structure:**
```typescript
id: serial("id").primaryKey(),
// ... domain fields ...
createdAt: timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date()),
```

## File Upload Pattern

**Pattern:** UploadThing handles file uploads with Clerk auth integration.

**Flow:**
1. Files selected via `FileSelector` → stored in `FileContext`
2. Form submit calls `$ut.startUpload(files)` from `useUploadThing` hook
3. UploadThing middleware validates Clerk auth + `can-upload` metadata
4. Upload returns `{url, key}` array
5. URLs/keys stored in product record as arrays

**Key files:**
- Router config: `src/app/api/uploadthing/core.ts:16-71`
- React helpers: `src/utils/uploadthing.ts`
- Deletion: `src/server/queries.ts:29-58` - deletes files via `utapi.deleteFiles()`

## Authentication Flow

**Pattern:** Clerk middleware protects all routes; components use auth state.

- Global middleware: `src/middleware.ts:1-12`
- Server auth check: `await auth()` from `@clerk/nextjs/server`
- Client components: `<SignedIn>`, `<SignedOut>`, `<UserButton>`
- Protected upload: checks `can-upload` in user metadata (`core.ts:41`)

## Path Aliasing

**Pattern:** Import paths use `~/` prefix for src directory.

- Configured in `tsconfig.json` as `~/*` → `./src/*`
- Example: `import { db } from "~/server/db"`

## Image Optimization

**Pattern:** All images use `next/image` with configured remote patterns.

- Remote pattern for UploadThing: `utfs.io` in `next.config.js:31-38`
- Always specify `width` and `height` props
- Used consistently in product displays and admin views

## Stripe Customer Management

**Pattern:** Create Stripe Customer BEFORE PaymentIntent for consistent state.

- Customers created before payment to enable saved cards and better tracking
- Separate flows for authenticated users vs guests
- KV cache used for fast customer ID lookups

**Key files:**
- Customer creation: `src/server/stripe-customer.ts`
- Stripe API wrappers: `src/server/stripe.ts`
- KV caching: `src/server/kv.ts`

**Flow for authenticated users:**
1. Check KV cache for Stripe customer ID
2. Fall back to database lookup
3. Create new Stripe customer if needed
4. Cache customer ID in KV for future requests

**Flow for guests:**
1. Check KV cache using session token
2. Create new Stripe customer with guest metadata
3. Cache using session token

**Guest-to-user conversion:**
When a guest creates an account, their Stripe customer is linked:
- `linkStripeCustomerToUser()` updates metadata and KV cache
- Guest orders remain associated with the same customer

## KV State Sync Pattern

**Pattern:** Single sync function updates payment state to KV cache.

- Central sync function prevents duplicate logic
- Called from webhooks and success page for consistency
- Prevents race conditions with eager sync on success page

**Key file:** `src/server/stripe-sync.ts`

**Sync functions:**
| Function | Purpose |
|----------|---------|
| `syncPaymentStateToKV` | Core sync using PaymentIntent data |
| `syncPaymentStateByPaymentIntent` | Sync by payment intent ID |
| `syncOrderStateToKV` | Cache order ID for payment intent |
| `syncPaymentStateForUser` | Sync for authenticated user |
| `syncPaymentStateForSession` | Sync for guest session |

**Webhook integration:**
- Webhook handler calls `syncPaymentStateToKV` after processing
- Success page also syncs to prevent webhook delay issues
- KV entries expire after 24 hours (configurable)

## Saved Payment Methods

**Pattern:** Fetch and display saved cards for logged-in users at checkout.

- Only authenticated users can save payment methods
- Cards saved with `setup_future_usage: 'on_session'`
- Saved methods displayed with radio button selection

**Key files:**
- API endpoint: `src/app/api/checkout/payment-methods/route.ts`
- Stripe functions: `src/server/stripe.ts` (`getSavedPaymentMethods`, `createPaymentIntentWithSavedMethod`)
- Checkout form: `src/app/shop/checkout/CheckoutForm.tsx`

**Flow:**
1. CheckoutForm fetches saved methods on mount for signed-in users
2. User selects saved card or "Use new card"
3. If saved card selected, PaymentIntent created with method attached
4. If new card + "Save" checked, `setup_future_usage` set on intent

## Cart Merge Pattern

**Pattern:** Handle cart conflicts when guests log in with existing cart.

When a guest has items in cart and logs in to an account that also has cart items:
1. Detect conflict by comparing guest session cart with user's saved cart
2. Show modal presenting both carts with item details
3. User chooses: Keep guest cart, Keep saved cart, or Merge both
4. Update session and cart accordingly

**Key files:**
- Modal component: `src/app/shop/_components/CartMergeModal.tsx`
- Cart actions: `src/server/cart-actions.ts` (`getCartConflict`, `mergeGuestCart`, `keepGuestCart`, `keepSavedCart`)
- Session management: `src/server/session.ts`

## Checkout Flow

**Pattern:** Two-phase checkout with customer info then payment.

**Phase 1 - Customer Info:**
1. User enters email, shipping address
2. For signed-in users, email pre-filled
3. Saved payment methods shown if available
4. Form validated with Zod schema
5. PaymentIntent created on submit

**Phase 2 - Payment:**
1. Stripe Elements displays PaymentElement
2. Customer info shown as summary (readonly)
3. Payment confirmed via Stripe
4. Redirect to success page

**API endpoints:**
- `POST /api/checkout/create-intent` - Create PaymentIntent
- `GET /api/checkout/payment-methods` - Fetch saved cards
- `POST /api/stripe/webhook` - Handle Stripe events

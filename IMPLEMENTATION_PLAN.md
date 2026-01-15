# Implementation Plan: E-commerce Features

This document outlines the implementation plan for three major features:
1. Category Management
2. Shopping Cart
3. Checkout with Stripe

Each feature is broken into small-to-medium PRs for incremental delivery.

---

## Phase 1: Category Management

### PR 1.1: Category CRUD Server Actions
**Scope:** Backend infrastructure for category management

- [ ] Add server actions in `db_connect.tsx`:
  - `createCategory(name, description?)`
  - `updateCategory(id, name, description?)`
  - `deleteCategory(id)` - sets `category_id` to null for affected products
- [ ] Add Zod validation schemas for category operations
- [ ] Add `getCategoryById` query to `queries.ts`

**Files Modified:**
- `src/app/admin/_components/db_connect.tsx`
- `src/server/queries.ts`

---

### PR 1.2: Category Management UI in Admin
**Scope:** Admin interface for managing categories

- [ ] Create `CategoryManager.tsx` component with:
  - List of existing categories with edit/delete buttons
  - Inline form to add new category
  - Edit mode for existing categories
  - Delete confirmation with product count warning
- [ ] Integrate into admin page (either as tab/section or modal)
- [ ] Update product form category dropdown to refresh when categories change

**Files Modified:**
- `src/app/admin/_components/CategoryManager.tsx` (new)
- `src/app/admin/_components/AdminPageClient.tsx`
- `src/app/admin/_components/ProductForm.tsx`

---

## Phase 2: Shopping Cart

### PR 2.1: Cart Infrastructure & Context
**Scope:** Foundation for cart functionality

- [ ] Create `CartContext.tsx` with:
  - Cart state (items, totals, item count)
  - Guest session management (generate/persist session ID in cookie)
  - Functions: `addToCart`, `removeFromCart`, `updateQuantity`, `clearCart`
- [ ] Add server actions for cart operations:
  - `getOrCreateSession(sessionId?)` - returns session with cart items
  - `addItemToCart(sessionId, productId, quantity)`
  - `updateCartItem(cartItemId, quantity)`
  - `removeCartItem(cartItemId)`
  - `getCartItems(sessionId)`
- [ ] Add cart queries to `queries.ts`

**Files Modified:**
- `src/app/_context/CartContext.tsx` (new)
- `src/app/admin/_components/db_connect.tsx` (or new `src/server/cart-actions.ts`)
- `src/server/queries.ts`

---

### PR 2.2: Add to Cart Functionality
**Scope:** Wire up "Add to Cart" buttons

- [ ] Update shop product card with working "Add to Cart" button
- [ ] Update product detail page/modal with quantity selector + "Add to Cart"
- [ ] Add toast/notification feedback on add to cart
- [ ] Add cart item count badge to header/nav

**Files Modified:**
- `src/app/shop/page.tsx`
- `src/app/shop/product/[id]/page.tsx`
- `src/app/shop/_components/topnav.tsx`
- `src/components/ui/toast.tsx` (new, if needed)

---

### PR 2.3: Cart Drawer UI
**Scope:** Slide-out cart drawer component

- [ ] Create `CartDrawer.tsx` component with:
  - Slide-out animation from right
  - List of cart items with images, names, prices
  - Quantity adjustment (+/- buttons)
  - Remove item button
  - Subtotal display
  - Free shipping progress bar (optional)
  - "Continue Shopping" and "Checkout" CTAs
- [ ] Add drawer trigger to shop topnav (cart icon)
- [ ] Integrate CartContext for real-time updates

**Files Modified:**
- `src/components/ui/CartDrawer.tsx` (new)
- `src/app/shop/_components/topnav.tsx`
- `src/app/shop/layout.tsx`

---

### PR 2.4: Full Cart Page (Optional Review)
**Scope:** Dedicated cart page for detailed review

- [ ] Create `/shop/cart` page with:
  - Full cart item list with larger images
  - Quantity editing
  - Item removal
  - Order summary sidebar
  - "Proceed to Checkout" button
- [ ] Link from cart drawer "View Full Cart"

**Files Modified:**
- `src/app/shop/cart/page.tsx` (new)
- `src/components/ui/CartDrawer.tsx`

---

## Phase 3: Checkout with Stripe

### PR 3.1: Stripe Setup & Configuration
**Scope:** Stripe integration foundation

- [ ] Install Stripe packages (`stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js`)
- [ ] Add Stripe environment variables to `env.js` schema
- [ ] Create Stripe client utilities (`src/lib/stripe.ts`)
- [ ] Create Stripe server utilities (`src/server/stripe.ts`)

**Files Modified:**
- `package.json`
- `src/env.js`
- `src/lib/stripe.ts` (new)
- `src/server/stripe.ts` (new)

---

### PR 3.2: Checkout Page UI
**Scope:** Customer-facing checkout experience

- [ ] Create `/shop/checkout` page with:
  - Order summary (readonly cart items)
  - Guest checkout form (email, shipping address)
  - Optional account creation checkbox
  - Stripe Elements for payment
- [ ] Add checkout form validation with Zod
- [ ] Create `CheckoutForm.tsx` client component

**Files Modified:**
- `src/app/shop/checkout/page.tsx` (new)
- `src/app/shop/checkout/CheckoutForm.tsx` (new)

---

### PR 3.3: Payment Processing
**Scope:** Stripe payment flow

- [ ] Create server action `createPaymentIntent(sessionId, customerInfo)`
- [ ] Create API route for Stripe webhooks (`/api/stripe/webhook`)
- [ ] Handle payment confirmation
- [ ] Create order record on successful payment
- [ ] Clear cart after successful order
- [ ] Update product inventory on order completion

**Files Modified:**
- `src/server/stripe.ts`
- `src/app/api/stripe/webhook/route.ts` (new)
- `src/app/admin/_components/db_connect.tsx` (order creation actions)

---

### PR 3.4: Order Confirmation
**Scope:** Post-purchase experience

- [ ] Create `/shop/order/[id]` confirmation page
- [ ] Display order details, shipping info, payment confirmation
- [ ] Send confirmation email (optional - can be Stripe receipt)
- [ ] Redirect to confirmation after successful checkout

**Files Modified:**
- `src/app/shop/order/[id]/page.tsx` (new)
- `src/app/shop/checkout/CheckoutForm.tsx`

---

## Implementation Order

```
Phase 1: Category Management
├── PR 1.1: Category CRUD Server Actions
└── PR 1.2: Category Management UI

Phase 2: Shopping Cart
├── PR 2.1: Cart Infrastructure & Context
├── PR 2.2: Add to Cart Functionality
├── PR 2.3: Cart Drawer UI
└── PR 2.4: Full Cart Page

Phase 3: Checkout
├── PR 3.1: Stripe Setup & Configuration
├── PR 3.2: Checkout Page UI
├── PR 3.3: Payment Processing
└── PR 3.4: Order Confirmation
```

---

## Technical Decisions

### Guest Cart Persistence
- Generate UUID session ID on first cart interaction
- Store session ID in HTTP-only cookie (30 days expiry)
- Cart data stored in `shopping_session` + `cart_item` tables
- On user sign-in (future): merge guest cart with user cart

### Cart UI Pattern
- **Primary:** Slide-out drawer (modern, keeps shopping context)
- **Secondary:** Full `/shop/cart` page for detailed review
- Based on [industry research](https://vervaunt.com/ecommerce-cart-drawers-examples-technologies-ux-best-practices), drawer carts reduce abandonment and increase AOV

### Stripe Integration
- Use Stripe Checkout or Payment Intents API
- Webhook-based order fulfillment (reliable)
- Support for future payment methods via Stripe

---

## Notes

- All PRs should include appropriate TypeScript types
- Server actions should validate inputs with Zod
- UI components should follow existing patterns (Tailwind + CVA)
- Each PR should be independently deployable when possible

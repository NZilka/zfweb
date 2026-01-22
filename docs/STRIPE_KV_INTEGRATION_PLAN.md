# Stripe Customer & KV Integration Plan

> Implementation plan for integrating Stripe Customer management and Upstash KV caching into zfweb, based on patterns from `stripe-recommendations`.

## Overview

This plan adapts the subscription-focused patterns from `stripe-recommendations` to zfweb's e-commerce model (one-time purchases). Key goals:

1. **Stripe Customers** - Create/link Stripe Customers for registered users (saved payment methods, order history)
2. **KV State Caching** - Use Upstash Redis for fast payment/order state reads
3. **Guest Checkout** - Maintain priority guest checkout while offering account creation
4. **Improved Webhooks** - Comprehensive event handling with single sync function pattern
5. **Race Condition Prevention** - Eager sync on success page

## Architecture Decisions

### Guest vs Registered Users

| Scenario | Stripe Customer | KV Mapping | Behavior |
|----------|-----------------|------------|----------|
| Guest checkout | Created with email only | `stripe:session:{sessionToken}` → customerId | No saved payment methods |
| Registered user (first purchase) | Created with userId metadata | `stripe:user:{clerkUserId}` → customerId | Payment methods saved |
| Registered user (returning) | Retrieved from KV | `stripe:user:{clerkUserId}` → customerId | Uses saved methods |

### KV Key Schema

```
stripe:user:{clerkUserId}           → stripeCustomerId (permanent)
stripe:session:{sessionToken}       → stripeCustomerId (temporary, for guest orders)
stripe:customer:{stripeCustomerId}  → PaymentStateCache (order/payment state)
order:payment:{paymentIntentId}     → OrderStateCache (order details)
```

### Data Types

```typescript
// Cached payment state for a Stripe Customer
type PaymentStateCache = {
  lastPaymentIntentId: string | null;
  lastPaymentStatus: 'succeeded' | 'processing' | 'failed' | null;
  lastOrderId: number | null;
  paymentMethod: {
    brand: string | null;
    last4: string | null;
  } | null;
  updatedAt: number; // Unix timestamp
};

// Cached order state
type OrderStateCache = {
  orderId: number;
  status: string;
  total: string;
  itemCount: number;
  createdAt: number;
};
```

---

## Implementation Phases

### Phase 1: Infrastructure Setup
**Branch checkpoint after completion**

#### Step 1.1: Add Testing Framework
- [ ] Install vitest and testing dependencies
- [ ] Configure vitest for Next.js
- [ ] Add test scripts to package.json
- **Test**: Verify vitest runs with a simple test

#### Step 1.2: Add Upstash KV Dependency
- [ ] Install `@upstash/redis` package
- [ ] Add environment variables to `src/env.js`:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- [ ] Create `src/server/kv.ts` with KV client singleton
- **Test**: Unit test KV connection and basic operations

#### Step 1.3: Update Database Schema
- [ ] Add `stripe_customer_id` to `customer` table
- [ ] Add `clerk_user_id` to `customer` table (link Clerk auth to customer)
- [ ] Run migration
- **Test**: Verify schema changes applied

---

### Phase 2: Stripe Customer Management
**Branch checkpoint after completion**

#### Step 2.1: Create Stripe Customer Utilities
- [ ] Create `src/server/stripe-customer.ts`:
  - `getOrCreateStripeCustomer(options)` - handles guest vs registered
  - `linkUserToStripeCustomer(clerkUserId, stripeCustomerId)`
  - `getStripeCustomerForUser(clerkUserId)`
- [ ] Store mappings in KV on customer creation
- **Test**: Unit tests for customer creation (mock Stripe API)

#### Step 2.2: Update Checkout Flow - Create Customer Before PaymentIntent
- [ ] Modify `/api/checkout/create-intent/route.ts`:
  - Check if user is authenticated (Clerk)
  - If authenticated: get/create Stripe Customer with userId
  - If guest: create Stripe Customer with email only
  - Include `customer` param in PaymentIntent creation
- [ ] Store customer mapping in KV
- **Test**: Integration test checkout creates customer

---

### Phase 3: KV State Sync Pattern
**Branch checkpoint after completion**

#### Step 3.1: Implement syncPaymentStateToKV Function
- [ ] Create `src/server/stripe-sync.ts`:
  - `syncPaymentStateToKV(stripeCustomerId)` - single sync function
  - Fetches latest PaymentIntent for customer
  - Stores payment state in KV
- **Test**: Unit test sync function

#### Step 3.2: Update Success Page with Eager Sync
- [ ] Create/update `/shop/checkout/success/page.tsx`:
  - On load, call server action to sync state
  - Prevents race condition where user returns before webhook
- [ ] Create `syncAfterPaymentSuccess` server action
- **Test**: Test success page triggers sync

#### Step 3.3: Update Webhook Handler
- [ ] Expand event types handled:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `payment_intent.canceled`
  - `charge.refunded`
  - `charge.dispute.created`
- [ ] Call `syncPaymentStateToKV` for all events
- [ ] Add event filtering pattern from stripe-recommendations
- **Test**: Unit test webhook event processing

---

### Phase 4: Customer Account Features
**Branch checkpoint after completion**

#### Step 4.1: Create Customer Account Page
- [ ] Create `/shop/account/page.tsx` (protected by Clerk)
- [ ] Display order history from database
- [ ] Show saved payment method info (from KV cache)
- **Test**: Account page displays correct data

#### Step 4.2: Link Existing Carts on Login
- [ ] When user logs in, check for existing guest cart session
- [ ] Merge guest cart with user's cart if applicable
- [ ] Link shopping_session to customer record
- **Test**: Cart persists across login

#### Step 4.3: Optional Account Creation After Guest Checkout
- [ ] On order confirmation page, offer account creation
- [ ] If user creates account, link Stripe Customer to new user
- [ ] Transfer order history to new account
- **Test**: Guest can create account after checkout

---

### Phase 5: Enhanced Checkout Experience
**Branch checkpoint after completion**

#### Step 5.1: Show Saved Payment Methods for Logged-in Users
- [ ] Fetch saved payment methods from Stripe
- [ ] Display in checkout form with option to use saved or enter new
- [ ] Update PaymentIntent to use saved method if selected
- **Test**: Saved methods display and work

#### Step 5.2: Save Payment Method Option
- [ ] Add "Save payment method" checkbox for logged-in users
- [ ] Configure PaymentIntent with `setup_future_usage: 'on_session'`
- **Test**: Payment method saved when checkbox selected

---

### Phase 6: Testing & Documentation
**Final branch checkpoint**

#### Step 6.1: Integration Tests
- [ ] End-to-end test: Guest checkout flow
- [ ] End-to-end test: Registered user checkout flow
- [ ] End-to-end test: Returning customer with saved payment
- [ ] Webhook simulation tests

#### Step 6.2: Update Documentation
- [ ] Update CLAUDE.md with new patterns
- [ ] Update PROJECT.md if it exists
- [ ] Document new environment variables
- [ ] Add Stripe Dashboard configuration notes (disable Cash App Pay)

---

## Environment Variables Required

```env
# Existing
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...

# New - Upstash Redis
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

---

## File Changes Summary

### New Files
- `src/server/kv.ts` - Upstash KV client
- `src/server/stripe-customer.ts` - Stripe Customer management
- `src/server/stripe-sync.ts` - KV sync functions
- `src/app/shop/account/page.tsx` - Customer account page
- `src/app/shop/checkout/success/page.tsx` - Success page with eager sync
- `vitest.config.ts` - Test configuration
- `src/__tests__/` - Test files

### Modified Files
- `src/env.js` - Add Upstash env vars
- `src/server/db/schema.ts` - Add stripe_customer_id, clerk_user_id to customer
- `src/app/api/checkout/create-intent/route.ts` - Create Stripe Customer first
- `src/app/api/stripe/webhook/route.ts` - Expand event handling, use sync function
- `src/server/stripe.ts` - Add customer-related functions
- `package.json` - Add vitest, @upstash/redis

---

## Progress Tracking

| Phase | Step | Status | Notes |
|-------|------|--------|-------|
| 1 | 1.1 Testing Framework | ⬜ Pending | |
| 1 | 1.2 Upstash KV | ⬜ Pending | |
| 1 | 1.3 Schema Update | ⬜ Pending | |
| 2 | 2.1 Stripe Customer Utils | ⬜ Pending | |
| 2 | 2.2 Checkout Update | ⬜ Pending | |
| 3 | 3.1 Sync Function | ⬜ Pending | |
| 3 | 3.2 Success Page | ⬜ Pending | |
| 3 | 3.3 Webhook Update | ⬜ Pending | |
| 4 | 4.1 Account Page | ⬜ Pending | |
| 4 | 4.2 Cart Merge | ⬜ Pending | |
| 4 | 4.3 Post-Checkout Account | ⬜ Pending | |
| 5 | 5.1 Saved Payment Display | ⬜ Pending | |
| 5 | 5.2 Save Payment Option | ⬜ Pending | |
| 6 | 6.1 Integration Tests | ⬜ Pending | |
| 6 | 6.2 Documentation | ⬜ Pending | |

---

## Questions to Resolve

1. ✅ Should we use Clerk's user ID directly or create our own customer table link? → Use Clerk's user ID with mapping in KV
2. ✅ Guest checkout priority? → Yes, guest checkout remains primary flow
3. ✅ Should guests be able to view order status without account? → No, guests receive email confirmation only, no order lookup
4. ✅ Cart merge strategy when guest logs into existing account with items? → Ask user which cart to keep (modal prompt)

---

## Stripe Dashboard Configuration (Manual)

After implementation, configure in Stripe Dashboard:
- [ ] **Disable Cash App Pay** - High fraud rate per stripe-recommendations
- [ ] **Enable Customer Portal** (optional) - Let customers manage payment methods
- [ ] **Configure Webhook Endpoint** - Ensure all events listed above are sent

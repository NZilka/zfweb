# Lesson: Order Fulfillment Database Schema

## What We Built
Extended the order table with fields to track the fulfillment workflow: download status, packing status, shipping status, and tracking numbers.

## Why This Approach

**Booleans over status enum:** We used individual boolean fields (`is_downloaded`, `is_packed`, `is_shipped`) instead of a single status enum because:
- Independent checkpoints allow partial states (downloaded but not yet packed)
- Easier SQL queries per sub-tab (WHERE is_downloaded = false)
- Timestamps capture exactly when each step occurred
- More flexible for future workflow changes

**Timestamps with each status:** Each boolean has a corresponding timestamp (`downloaded_at`, `packed_at`, `shipped_at`) to track when actions occurred for analytics and auditing.

## Key Concepts

- **Drizzle schema definition**: Adding columns with types, defaults, and constraints
- **Database migrations**: Using `pnpm db:generate` and `pnpm db:push` to apply changes
- **Nullable timestamps**: Using `.default(null)` for optional timestamp fields

## Code Walkthrough

```typescript
// src/server/db/schema.ts
// Fulfillment tracking fields
is_downloaded: boolean("is_downloaded").notNull().default(false),
downloaded_at: timestamp("downloaded_at", { withTimezone: true }),
is_packed: boolean("is_packed").notNull().default(false),
packed_at: timestamp("packed_at", { withTimezone: true }),
is_shipped: boolean("is_shipped").notNull().default(false),
shipped_at: timestamp("shipped_at", { withTimezone: true }),
tracking_number: varchar("tracking_number", { length: 256 }),
```

- `notNull().default(false)` - Booleans default to false so existing orders work
- `withTimezone: true` - Stores UTC timestamps for consistency
- Tracking number is nullable since it's only added when shipping

## Testing Strategy
Schema changes are validated by running `pnpm db:generate` to ensure the migration is generated correctly, and `pnpm check` to verify TypeScript types update properly.

## What You Learned
- How to extend Drizzle ORM schemas incrementally
- The trade-off between enum-based status and boolean-based checkpoints
- Why timestamps accompanying status changes are valuable for operations

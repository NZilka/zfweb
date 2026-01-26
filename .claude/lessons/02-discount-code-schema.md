# Lesson: Discount Code Database Schema

## What We Built
Extended the discount table with fields for code-based discounts: unique code, discount type (percent/fixed), max uses, and expiration date.

## Why This Approach

**Code field:** A unique, uppercased code (e.g., "SAVE10") that customers enter at checkout. Uppercase normalization ensures "save10" and "SAVE10" match.

**Discount type:** Using "percent" or "fixed" allows flexibility:
- Percent: "20% off" scales with order size
- Fixed: "$10 off" gives predictable discount

**Usage limits:** `max_uses` (optional) and `numberOfUses` (counter) prevent discount abuse and enable limited promotions.

## Key Concepts

- **Unique constraints**: The `code` field uses `.unique()` to prevent duplicate codes
- **Enum-like strings**: Using `varchar` with specific values ("percent"/"fixed") instead of database enums for easier migrations
- **Optional expiration**: `expires_at` is nullable for codes without time limits

## Code Walkthrough

```typescript
// src/server/db/schema.ts
code: varchar("code", { length: 64 }).notNull().unique(),
discount_type: varchar("discount_type", { length: 16 }).notNull().default("percent"),
numberOfUses: integer("number_of_uses").notNull().default(0),
max_uses: integer("max_uses"), // null = unlimited
expires_at: timestamp("expires_at", { withTimezone: true }),
```

- `unique()` - Enforces code uniqueness at database level
- `numberOfUses` default 0 - New codes start with zero uses
- `max_uses` nullable - No limit when null

## Testing Strategy
Schema validation through `pnpm db:push` and type checking. The discount validation logic (checking expiration, usage limits) is unit tested in `discount-actions.test.ts`.

## What You Learned
- How to design schema for promotional/discount systems
- Using nullable fields for "unlimited" semantics
- Trade-offs between database enums and string-based type fields

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

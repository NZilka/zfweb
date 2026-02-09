# Lesson: Products, Categories, Search

## What We Built

Five features in one PR:
1. **About page images** — Changed from cropped (`object-cover`) to full (`object-contain`) display, expanded grid to 3 columns on desktop
2. **Nav instant close** — Admin and shop nav drawers vanish immediately when a nav link is clicked (no slide-out animation)
3. **Category pages** — Shop filters products by `?category=X` query param with category heading and "View all products" link
4. **Product drag-and-drop reorder** — `sort_order` column on product table, dnd-kit integration in both list and grid admin views
5. **Search** — Full-width search overlay in shop nav, server-side `ilike` filtering on title and description

## Why This Approach

- **Category pages via query params** instead of dynamic routes keeps the shop as a single page component, avoiding route duplication. The carousel is hidden on filtered views.
- **sort_order column** (integer, default 0) with `[asc(sort_order), asc(id)]` ordering means existing products display in creation order by default, while drag-and-drop assigns explicit positions.
- **Instant nav close** uses a boolean flag (`isInstantClose`/`isInstant`) that removes the CSS transition class. The flag resets when the drawer opens again so the slide-in animation still plays.
- **Search overlay** is a client component that navigates to `/shop?q=term` — the server page reads the query param and passes it to `getProducts()` which uses `ilike` for case-insensitive matching.

## Key Concepts

- **dnd-kit pattern**: `DndContext` + `SortableContext` wraps the view; each item gets `useSortable` with `id`, `ref`, `style`, drag `listeners`. Use `verticalListSortingStrategy` for tables, `rectSortingStrategy` for grids.
- **Optimistic reorder**: Local state updates immediately on `handleDragEnd`, server action fires in background. Products prop is used as source of truth only when length changes.
- **Conditional drag**: Drag handles hidden and `disabled: true` on `useSortable` when filters are active — can't reorder a subset.
- **getProducts refactor**: Signature evolved from `()` → `(opts?: { categoryId?: number })` → `(opts?: { categoryId?: number; search?: string })`. Uses Drizzle's `and()` to combine optional conditions.

## Code Walkthrough

### Schema change
```ts
sort_order: integer("sort_order").notNull().default(0),
```
Added between `category_id` and `on_sale` in the product table. Default 0 means all existing products start equal.

### Instant close pattern
```tsx
// Context adds isInstantClose + instantClose()
const instantClose = () => { setIsInstantClose(true); setIsOpen(false); };
// CSS conditionally removes transition
isInstantClose ? "" : "transition-transform duration-300 ease-in-out"
```

### Search query building
```ts
where: (model, { eq, and, ilike, or }) => {
  const conditions: SQL[] = [];
  if (opts?.categoryId) conditions.push(eq(model.category_id, opts.categoryId));
  if (opts?.search) {
    const term = `%${opts.search}%`;
    conditions.push(or(ilike(model.title, term), ilike(model.description, term))!);
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}
```

## Testing Strategy

- **SearchOverlay**: Render tests for open/closed state, form submission navigation, Escape key close, empty query rejection
- **AdminNavContext**: Direct context value tests with `act()` wrapping for state updates — verifies `instantClose()` sets both flags, `toggleOpen()` resets instant flag
- **MobileMenuDrawer**: Verifies nav links call `onClose` (which internally uses instant close)
- **updateProductSortOrder**: Mocks db.update to verify it's called once per product ID

## What You Learned

- JSX comments `{/* ... */}` can't go between `{expression && (` and the JSX element — they must be inside the element or outside the conditional
- JSX comments `{/* ... */}` can't go inside JSX attribute blocks (between tag attributes) — they're only valid as children
- `act()` is required when calling context methods directly in tests (not through fireEvent)
- Drizzle's `ilike` requires importing from `drizzle-orm` separately

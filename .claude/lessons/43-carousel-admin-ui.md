# Lesson: Carousel Admin UI

## What We Built

Admin settings UI for managing a shop homepage carousel. Supports custom image/video uploads with reordering, or auto-generation from products when disabled. Includes UploadThing file cleanup when carousel items are removed.

## Why This Approach

- **KV storage** — Extends existing SiteSettings pattern. No DB migration needed.
- **Separate UploadThing route** — `carouselMediaUploader` has higher limits (8MB images, 32MB videos) since carousel media is meant to be visually prominent.
- **File cleanup** — When carousel items are removed, `utapi.deleteFiles()` cleans up orphaned UploadThing files. Done fire-and-forget so save isn't blocked.
- **No drag-and-drop** — Uses up/down buttons for reordering to avoid adding a new dependency (e.g., dnd-kit). Simple and works on all devices.

## Key Concepts

- **CarouselItem type**: `{ type, url, key, alt?, order }` — order field enables sorting without array index dependency.
- **CarouselSettings**: `{ enabled, items, autoScrollInterval }` — when `enabled: false`, the shop page auto-generates carousel from products (PR 3).
- **File cleanup pattern**: Compare old item keys vs new item keys, delete the difference via `utapi.deleteFiles()`.
- **Grid responsiveness**: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4` — scales from mobile to desktop naturally.

## Code Walkthrough

- `src/server/kv.ts` — Added `CarouselItem`, `CarouselSettings` types, `carousel` to `SiteSettings`, backward-compat merge.
- `src/server/settings-actions.ts` — Added `carouselItemSchema`, `carouselSchema`, carousel merge logic, file cleanup via `utapi.deleteFiles`.
- `src/app/api/uploadthing/core.ts` — Added `carouselMediaUploader` supporting images (8MB/10) and videos (32MB/5).
- `src/app/admin/settings/_components/SettingsClient.tsx` — New "Shop Carousel" card with enable toggle, upload zone, item grid with thumbnails/reorder/remove, interval input.

## Testing Strategy

Tested via `src/__tests__/carousel-settings.test.ts`:
- Valid carousel items (images and videos) accepted
- Invalid item type rejected
- Max item count (30) enforced
- Auto-scroll interval bounds (1000–10000ms) validated
- Backward compat when settings lack carousel field
- Carousel preserved when updating other settings
- File cleanup: `utapi.deleteFiles` called with removed item keys
- No cleanup when items unchanged

## What You Learned

- When adding new fields to SiteSettings, update mocks in ALL test files that define `DEFAULT_SITE_SETTINGS` — not just the test for the new feature. The `settings-actions.test.ts` and `logo-settings.test.ts` mocks need updating too.
- When importing `utapi` in a server action, tests that import that action also need to mock `~/server/uploadthing`.
- Touch targets for action buttons (remove, reorder) should be always-visible on mobile (`opacity-100`) and hover-reveal on desktop (`sm:opacity-0 sm:group-hover:opacity-100`) — mobile users can't hover.
- UploadThing's `onClientUploadComplete` returns files with `name`, `url`, `key` — detect video vs image from file extension since content type isn't directly available.

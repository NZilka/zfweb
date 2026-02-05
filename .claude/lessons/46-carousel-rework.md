# Lesson: Carousel Rework — Row-Based Grid Model

## What We Built

Complete rework of the shop carousel from a flat item list to a row-based grid model. Removed auto-generation from products. Added a grid-based admin modal for configuring 4 rows (3 images or 1 video each), with product image copying and video position control.

## Why This Approach

The flat `CarouselItem[]` model was confusing — items were grouped into slides of 3 at render time, making it hard to reason about what each "slide" would look like. The row-based model (`CarouselRow`) makes each slide explicit: either 3 images or 1 full-width video. This is more intuitive for the admin and eliminates edge cases with leftover items.

Auto-generation was removed because the admin should have full control over what appears in the carousel. Product images can still be selected via the cell picker, but they're copied to independent UploadThing storage so carousel content isn't affected by product changes.

## Key Concepts

- **Discriminated union rows**: `CarouselRow = { type: "images"; cells: ... } | { type: "video"; ... }` enables type-safe handling
- **Row completeness**: An images row is "complete" only when all 3 cells are filled; video rows are always complete
- **Product image copying**: `copyProductImageToCarousel()` uses `utapi.uploadFilesFromUrl()` to create an independent copy
- **File cleanup diffing**: `collectRowKeys()` extracts all UploadThing keys from rows for old-vs-new comparison

## Code Walkthrough

### Data Model (`kv.ts`)
- `CarouselImageCell`: `{ url, key, alt }` — a single image in a row
- `CarouselRow`: discriminated union of `images` (3 cells) and `video` (url + position)
- `CarouselSettings`: `{ rows: (CarouselRow | null)[4], autoScrollInterval }`

### Server Logic (`carousel.ts`)
- Removed `buildAutoCarousel()` entirely — no more product dependency
- `isCompleteRow()` + `rowToSlide()` convert complete rows to `CarouselSlide` discriminated union
- `CarouselSlide` is also a discriminated union: `{ type: "images" }` or `{ type: "video" }`

### Admin Modal (`CarouselModal.tsx`)
- Two-dialog pattern: main grid editor + cell picker sub-dialog
- Uses `open && !pickerTarget` for main dialog to prevent both from showing simultaneously
- Video position slider with live preview via `object-position: center Y%`
- Drag-and-drop row reordering with `@dnd-kit/sortable` — each row has a grip handle

### Shop Component (`Carousel.tsx`)
- Handles both slide types: images (3-column) and video (full-width)
- Image size reduced from 469px to 375px
- Transition duration doubled from 500ms to 1000ms

## Testing Strategy

- **carousel.test.ts**: Row-based tests covering null rows, incomplete rows, single/multiple complete rows, mixed image/video, and slide data structure
- **carousel-settings.test.ts**: Schema validation for row structure, URL/key security, interval bounds, backward compatibility, file cleanup
- All existing test mocks updated from `{ enabled, items }` to `{ rows }` shape

## What You Learned

- `vi.mock()` factories are hoisted — cannot reference variables defined above them (caused `ReferenceError: Cannot access before initialization`)
- Discriminated unions with `z.discriminatedUnion()` work well for the row type pattern but need `.nullable()` chained after the union, not inside it
- The `collectRowKeys()` helper pattern (extract all keys from nested structure) is reusable for any nested cleanup diffing

# Lesson: Image Positioning (PR #50)

## What We Built

Added image positioning/cropping for both carousel images and product images using `react-easy-crop`. Users can drag to pan and scroll/slider to zoom, with the crop data stored alongside images for CSS-based rendering on the shop.

## Why This Approach

- **react-easy-crop** provides a polished, accessible pan+zoom UI out of the box
- **Percentage-based crop data** (not pixels) is resolution-independent — works at any display size
- **CSS rendering** (not canvas/server-side crop) means no image re-processing, no new upload, and instant preview
- **Optional fields everywhere** means zero migration needed — old data works unchanged

## Key Concepts

- **CropData type**: `{ croppedArea: { x, y, width, height }, zoom }` where croppedArea values are percentages (0-100) of the original image
- **cropToStyle()**: Converts CropData to CSS positioning (absolute position + width/height scaling) for an overflow-hidden container
- **Backward compatibility**: All crop fields are optional — missing crop renders as `object-cover` centered (the previous behavior)
- **Parallel arrays**: Product `imgCrop` is a jsonb column parallel to `imgUrl`/`imgKey` — same index = same image

## Code Walkthrough

### Shared Component: `ImageCropEditor.tsx`
- Wraps `react-easy-crop`'s `<Cropper>` with zoom slider and reset button
- Exports `CropData` type and `cropToStyle()` helper used everywhere

### Carousel Flow
1. `CarouselImageCell` in `kv.ts` gets optional `crop?` field
2. `CarouselSlideItem` in `carousel.ts` gets optional `crop?` field, passed through in `rowToSlide()`
3. `carouselImageCellSchema` in `settings-actions.ts` gets optional `cropDataSchema`
4. `CarouselModal.tsx` adds third dialog for crop editing, filled cells are clickable
5. `Carousel.tsx` (shop) uses `cropToStyle()` for positioned images

### Product Flow
1. `imgCrop` jsonb column added to product schema (parallel to imgUrl/imgKey)
2. `EditImageContext` gets `crop` on `ImageItem`, `updateImageCrop()`, and returns `keepCrops`/`newCrops` from `getImageChanges()`
3. `db_connect.tsx` accepts and stores crop data in both `addProduct` and `updateProduct`
4. `ImageGalleryEditor.tsx` makes thumbnails clickable to open crop dialog
5. Shop `page.tsx` and `ImageGallery.tsx` use `cropToStyle()` for rendering

## Testing Strategy

- **cropToStyle**: Tests for undefined, null, full-frame, partial crop, and missing croppedArea
- **Zod validation**: Tests crop field accepted/optional/rejected-when-invalid
- **Carousel passthrough**: Integration test verifying crop data flows from KV → carousel slides
- **Backward compat**: Tests that old data without crop field validates and renders correctly

## What You Learned

- `fill={false}` on Next.js `<Image>` triggers a React warning — use conditional rendering instead of `fill={!!condition}`
- react-easy-crop's `onCropComplete` provides two areas: pixel-based and percentage-based — use percentage for storage
- CSS-based crop rendering (absolute positioning with scaled width/height) is simpler than canvas cropping and works server-side
- Optional jsonb columns with default `[]` avoid database migrations for existing data

# Lesson: Carousel Shop Component

## What We Built

A shop homepage carousel that either displays custom uploaded media or auto-generates slides from active products. Server-side computation prepares carousel data, and a client component handles the sliding animation and video playback.

## Why This Approach

- **Server-side computation** — `getCarouselData()` runs on the server, so product data never ships to the client. The shop page is already `force-dynamic`, so the carousel is always fresh.
- **Slides of 3** — Matches the visual rhythm of the product grid and keeps items large enough to be impactful on both mobile and desktop.
- **Only complete groups** — Incomplete groups (1-2 leftover items) are dropped to maintain visual consistency.
- **Static vs scrolling** — Single slide (3-5 products) is static since there's nothing to scroll to. Multiple slides (6+) auto-scroll.

## Key Concepts

- **CarouselData**: `{ slides, autoScroll, autoScrollInterval }` — pre-computed on the server, serialized to the client component via props.
- **CarouselSlide**: Contains exactly 3 `CarouselSlideItem` entries (type, url, alt).
- **buildCustomCarousel()**: Sorts by `order`, groups into 3s, determines auto-scroll based on slide count.
- **buildAutoCarousel()**: Filters products to `status === "active"` with images, groups into 3s, uses first image per product.
- **CSS translateX sliding**: `transform: translateX(-${currentSlide * 100}%)` with `transition-transform duration-500` for smooth animation.
- **Video pause pattern**: `isVideoPlaying` state gates the `setInterval` — when a video fires `onPlay`, auto-scroll pauses; when `onEnded` fires, it resumes.

## Code Walkthrough

- `src/server/carousel.ts` — Server-only module with `getCarouselData()`, `buildCustomCarousel()`, and `buildAutoCarousel()`. Exports types for client use.
- `src/app/shop/_components/Carousel.tsx` — Client component using `useState` for current slide and video state, `useEffect` for auto-scroll interval, `useCallback` for `goToNext`. Navigation dots for manual control.
- `src/app/shop/page.tsx` — Made `HomePage` async, calls `getCarouselData()`, conditionally renders `<Carousel>` above `<Products>`.

## Testing Strategy

Tested via `src/__tests__/carousel.test.ts`:
- Custom carousel: uses custom items, groups into slides of 3, drops incomplete groups, returns null for < 3 items, preserves video types
- Auto-generation: null for < 3 products, static for 3-5, scrolling for 6+, excludes non-active products, excludes products without images, uses first image, all items typed as "image"
- Required `vi.mock("server-only", () => ({}))` to handle the `import "server-only"` directive in test environment

## What You Learned

- The `server-only` package throws at import time in non-server environments. Tests must mock it: `vi.mock("server-only", () => ({}))`.
- `useCallback` is needed for `goToNext` since it's used as a dependency in `useEffect` — without it, the interval would reset on every render.
- CSS `translateX` based carousels need `overflow-hidden` on the container and `flex-shrink-0` + `w-full` on each slide to prevent items from collapsing.
- Item widths use `calc(33.33% - gap)` to account for flex gap: `w-[calc(33.33%-0.33rem)]` for `gap-2` on mobile, `sm:w-[calc(33.33%-0.67rem)]` for `gap-4` on larger screens.

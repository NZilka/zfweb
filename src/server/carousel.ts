/**
 * Server-side carousel data computation
 * Builds carousel data from custom items or auto-generates from products
 * Used by the shop page to pass pre-computed data to the client carousel component
 */
import "server-only";

import { getSiteSettings, type CarouselItem } from "./kv";
import { getProducts } from "./queries";

// A single item within a carousel slide (image or video)
export type CarouselSlideItem = {
  type: "image" | "video";
  url: string;
  alt: string;
};

// A slide containing up to 3 items displayed side-by-side
export type CarouselSlide = {
  items: CarouselSlideItem[];
};

// Complete carousel data passed to the client component
export type CarouselData = {
  slides: CarouselSlide[];
  autoScroll: boolean; // Whether carousel should auto-advance
  autoScrollInterval: number; // Milliseconds between slides
};

/**
 * Main entry point — builds carousel data for the shop page
 * Returns null if there's not enough content for a carousel
 */
export async function getCarouselData(): Promise<CarouselData | null> {
  const settings = await getSiteSettings();

  // Use custom carousel if enabled and has items
  if (settings.carousel.enabled && settings.carousel.items.length > 0) {
    return buildCustomCarousel(
      settings.carousel.items,
      settings.carousel.autoScrollInterval
    );
  }

  // Otherwise auto-generate from products
  return buildAutoCarousel(settings.carousel.autoScrollInterval);
}

/**
 * Build carousel from custom uploaded items
 * Groups items into slides of 3, sorted by order field
 */
function buildCustomCarousel(
  items: CarouselItem[],
  interval: number
): CarouselData | null {
  // Sort by order field
  const sorted = [...items].sort((a, b) => a.order - b.order);

  // Group into slides of 3 — only complete groups
  const slides: CarouselSlide[] = [];
  for (let i = 0; i + 2 < sorted.length; i += 3) {
    slides.push({
      items: sorted.slice(i, i + 3).map((item) => ({
        type: item.type,
        url: item.url,
        alt: item.alt ?? "",
      })),
    });
  }

  if (slides.length === 0) return null;

  return {
    slides,
    // Single slide = static, multiple = auto-scroll
    autoScroll: slides.length > 1,
    autoScrollInterval: interval,
  };
}

/**
 * Auto-generate carousel from active products with images
 * Groups products into slides of 3 for display
 * Returns null if fewer than 3 qualifying products exist
 */
async function buildAutoCarousel(
  interval: number
): Promise<CarouselData | null> {
  const products = await getProducts();

  // Filter to active products that have at least one image
  const eligible = products.filter(
    (p) => p.status === "active" && p.imgUrl.length > 0
  );

  // Need at least 3 products for a meaningful carousel
  if (eligible.length < 3) return null;

  // Group into slides of 3 — only complete groups
  const slides: CarouselSlide[] = [];
  for (let i = 0; i + 2 < eligible.length; i += 3) {
    slides.push({
      items: eligible.slice(i, i + 3).map((product) => ({
        type: "image" as const,
        url: product.imgUrl[0]!,
        alt: product.title,
      })),
    });
  }

  if (slides.length === 0) return null;

  return {
    slides,
    // 1 slide (3-5 products) = static, 2+ slides (6+) = scrolling
    autoScroll: slides.length > 1,
    autoScrollInterval: interval,
  };
}

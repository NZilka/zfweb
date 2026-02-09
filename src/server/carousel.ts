/**
 * Server-side carousel data computation
 * Builds carousel slides from complete rows configured in admin settings
 * No auto-generation — carousel only shows manually configured content
 */
import "server-only";

import { getSiteSettings, type CarouselRow } from "./kv";

// A single item within an image slide
export type CarouselSlideItem = {
  url: string;
  alt: string;
  // Optional crop data for image positioning — missing = default object-cover
  crop?: {
    croppedArea: { x: number; y: number; width: number; height: number };
    zoom: number;
  };
};

// A slide is either 3 images side-by-side or 1 full-width video
export type CarouselSlide =
  | { type: "images"; items: CarouselSlideItem[] }
  | { type: "video"; url: string; videoPositionY: number };

// Complete carousel data passed to the client component
export type CarouselData = {
  slides: CarouselSlide[];
  autoScroll: boolean; // Whether carousel should auto-advance
  autoScrollInterval: number; // Milliseconds between slides
};

/**
 * Check if a row is "complete" and ready to display
 * Images row: all 3 cells must be non-null
 * Video row: always complete (has required url/key)
 */
function isCompleteRow(row: CarouselRow | null): row is CarouselRow {
  if (!row) return false;
  if (row.type === "video") return true;
  // Images row requires all 3 cells filled
  return row.cells.every((cell) => cell !== null);
}

/**
 * Convert a complete CarouselRow into a CarouselSlide for the client
 */
function rowToSlide(row: CarouselRow): CarouselSlide {
  if (row.type === "video") {
    return {
      type: "video",
      url: row.url,
      videoPositionY: row.videoPositionY,
    };
  }
  // Images row — cells are guaranteed non-null by isCompleteRow check
  // Pass through crop data (undefined if not set) for CSS positioning on shop
  return {
    type: "images",
    items: row.cells.map((cell) => ({
      url: cell!.url,
      alt: cell!.alt,
      crop: cell!.crop,
    })),
  };
}

/**
 * Main entry point — builds carousel data from configured rows
 * Returns null if no complete rows exist (carousel won't render)
 */
export async function getCarouselData(): Promise<CarouselData | null> {
  const settings = await getSiteSettings();
  const completeRows = settings.carousel.rows.filter(isCompleteRow);

  // No complete rows = no carousel
  if (completeRows.length === 0) return null;

  const slides = completeRows.map(rowToSlide);
  return {
    slides,
    // Single row = static display, 2+ rows = auto-scroll
    autoScroll: completeRows.length > 1,
    autoScrollInterval: settings.carousel.autoScrollInterval,
  };
}

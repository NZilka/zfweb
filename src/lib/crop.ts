/**
 * Shared crop utilities — usable from both server and client components
 * Extracted from ImageCropEditor so server components (e.g. shop/page.tsx)
 * can call cropToStyle() without hitting the "use client" boundary
 */

// Stored crop data — croppedArea percentages of original image visible in crop box
export interface CropData {
  croppedArea: { x: number; y: number; width: number; height: number };
  zoom: number;
}

/**
 * Convert stored CropData to inline CSS for rendering the crop
 * Positions and scales the image so only the cropped area is visible
 * within an overflow-hidden container
 */
export function cropToStyle(
  crop?: CropData | null,
): React.CSSProperties {
  if (!crop?.croppedArea) {
    // No crop data — fall back to centered cover
    return { objectFit: "cover" as const, objectPosition: "center" };
  }
  const { croppedArea } = crop;
  // Scale image so the visible area matches the container
  // croppedArea values are percentages (0-100) of the original image
  // maxWidth: "none" overrides Tailwind Preflight's `max-width: 100%` on img
  // elements, which otherwise caps the width and breaks crop positioning
  return {
    position: "absolute" as const,
    maxWidth: "none",
    width: `${100 / (croppedArea.width / 100)}%`,
    height: `${100 / (croppedArea.height / 100)}%`,
    left: `-${croppedArea.x / (croppedArea.width / 100)}%`,
    top: `-${croppedArea.y / (croppedArea.height / 100)}%`,
  };
}

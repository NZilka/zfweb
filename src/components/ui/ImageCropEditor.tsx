/**
 * ImageCropEditor — Shared drag-to-position + zoom crop editor
 * Uses react-easy-crop for intuitive pan/zoom UI
 * Stores crop data as percentages for resolution-independent rendering
 */
"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Button } from "~/components/ui/button";

// Stored crop data — croppedArea percentages of original image visible in crop box
export interface CropData {
  croppedArea: { x: number; y: number; width: number; height: number };
  zoom: number;
}

interface ImageCropEditorProps {
  imageUrl: string;
  initialCrop?: CropData;
  aspect?: number; // e.g. 1 for square, 3 for 3:1
  onChange: (data: CropData) => void;
}

// Default crop position (centered, no zoom)
const DEFAULT_CROP = { x: 0, y: 0 };
const DEFAULT_ZOOM = 1;

export function ImageCropEditor({
  imageUrl,
  initialCrop,
  aspect = 1,
  onChange,
}: ImageCropEditorProps) {
  // Pan position state (react-easy-crop's internal x/y pixel offset)
  const [crop, setCrop] = useState(DEFAULT_CROP);
  // Zoom level — 1 = fit, higher = zoomed in
  const [zoom, setZoom] = useState(initialCrop?.zoom ?? DEFAULT_ZOOM);
  // Store the croppedArea percentages from react-easy-crop's callback
  const [croppedArea, setCroppedArea] = useState<Area | null>(
    initialCrop?.croppedArea ?? null,
  );

  // Called by react-easy-crop when crop or zoom changes (debounced)
  // croppedAreaPercentages is the percentage-based area for CSS rendering
  const handleCropComplete = useCallback(
    (_croppedAreaPixels: Area, croppedAreaPercentages: Area) => {
      setCroppedArea(croppedAreaPercentages);
      onChange({ croppedArea: croppedAreaPercentages, zoom });
    },
    [onChange, zoom],
  );

  // Reset to default centered, no-zoom state
  const handleReset = () => {
    setCrop(DEFAULT_CROP);
    setZoom(DEFAULT_ZOOM);
  };

  return (
    <div className="space-y-4">
      {/* Crop area — react-easy-crop fills this container */}
      <div className="relative h-[300px] w-full overflow-hidden rounded-lg bg-black sm:h-[400px]">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
        />
      </div>

      {/* Zoom slider */}
      <div className="flex items-center gap-3">
        <label className="whitespace-nowrap text-sm font-medium">Zoom</label>
        <input
          type="range"
          min={1}
          max={5}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1"
        />
        <span className="w-10 text-right text-sm text-gray-500">
          {zoom.toFixed(1)}x
        </span>
      </div>

      {/* Reset button */}
      <Button type="button" variant="outline" size="sm" onClick={handleReset}>
        Reset Position
      </Button>
    </div>
  );
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

"use client";

import { useState } from "react";
import Image from "next/image";
import { cropToStyle, type CropData } from "~/components/ui/ImageCropEditor";

// Crop entry type — matches database schema
type CropEntry = CropData | null;

interface ImageGalleryProps {
  images: string[];
  productTitle: string;
  // Optional crop data parallel to images array for image positioning
  imgCrop?: CropEntry[];
}

// Interactive image gallery component for product detail pages
// Clicking a thumbnail updates the main image display
// Supports crop data for positioned images
export function ImageGallery({ images, productTitle, imgCrop }: ImageGalleryProps) {
  // Track which image is currently selected (default to first image)
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Handle empty images array
  if (images.length === 0) {
    return (
      <div className="flex h-[500px] w-[500px] items-center justify-center rounded-lg bg-gray-200 text-gray-400">
        No Image
      </div>
    );
  }

  // Get crop data for the current image (if available)
  const currentCrop = imgCrop?.[selectedIndex];

  return (
    <div>
      {/* Main image display — use crop positioning if available */}
      {/* Can't use fill with cropToStyle — fill forces width:100% which conflicts */}
      <div className="relative aspect-square w-full max-w-[500px] overflow-hidden rounded-lg">
        {currentCrop ? (
          <Image
            src={images[selectedIndex]!}
            alt={productTitle}
            width={1000}
            height={1000}
            style={cropToStyle(currentCrop)}
          />
        ) : (
          <Image
            src={images[selectedIndex]!}
            alt={productTitle}
            fill
            className="object-cover"
          />
        )}
      </div>

      {/* Thumbnail gallery - only show if multiple images */}
      {images.length > 1 && (
        <div className="mt-4 flex gap-2">
          {images.map((url, index) => {
            const thumbCrop = imgCrop?.[index];
            return (
              <button
                key={index}
                type="button"
                onClick={() => setSelectedIndex(index)}
                // Highlight selected thumbnail with ring
                className={`relative h-20 w-20 overflow-hidden rounded border transition-all ${
                  index === selectedIndex
                    ? "ring-2 ring-blue-500 ring-offset-2"
                    : "hover:ring-2 hover:ring-gray-300 hover:ring-offset-1"
                }`}
              >
                {thumbCrop ? (
                  <Image
                    src={url}
                    alt={`${productTitle} ${index + 1}`}
                    width={160}
                    height={160}
                    style={cropToStyle(thumbCrop)}
                  />
                ) : (
                  <Image
                    src={url}
                    alt={`${productTitle} ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";

interface ImageGalleryProps {
  images: string[];
  productTitle: string;
}

// Interactive image gallery component for product detail pages
// Clicking a thumbnail updates the main image display
export function ImageGallery({ images, productTitle }: ImageGalleryProps) {
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

  return (
    <div>
      {/* Main image display */}
      <Image
        src={images[selectedIndex]!}
        alt={productTitle}
        width={500}
        height={500}
        className="rounded-lg object-contain"
      />

      {/* Thumbnail gallery - only show if multiple images */}
      {images.length > 1 && (
        <div className="mt-4 flex gap-2">
          {images.map((url, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setSelectedIndex(index)}
              // Highlight selected thumbnail with ring
              className={`rounded border transition-all ${
                index === selectedIndex
                  ? "ring-2 ring-blue-500 ring-offset-2"
                  : "hover:ring-2 hover:ring-gray-300 hover:ring-offset-1"
              }`}
            >
              <Image
                src={url}
                alt={`${productTitle} ${index + 1}`}
                width={80}
                height={80}
                className="rounded object-contain"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

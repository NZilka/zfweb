/**
 * ImageGalleryEditor - Image gallery section for product edit form
 * Displays image thumbnails with count indicator, supports upload/reorder/delete
 */
"use client";

import { useRef } from "react";
import Image from "next/image";
import { Plus, X, GripVertical } from "lucide-react";
import { useEditImage } from "~/app/_context/EditImageContext";

const MAX_IMAGES = 5;

/**
 * Displays image gallery with thumbnails and upload functionality
 * Uses the EditImageContext for state management
 */
export function ImageGalleryEditor() {
  const { images, addImage, removeImage, reorderImages, canAddMore } = useEditImage();
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && canAddMore) {
      const previewUrl = URL.createObjectURL(file);
      addImage(file, previewUrl);
    }
    // Reset input to allow selecting same file again
    event.target.value = "";
  };

  // Get display URL based on image type
  const getDisplayUrl = (image: typeof images[0]) => {
    if (image.type === "existing") {
      return image.url;
    }
    return image.previewUrl;
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      reorderImages(fromIndex, toIndex);
    }
  };

  return (
    <div className="space-y-3">
      {/* Image count indicator */}
      <div className="text-sm text-gray-500">
        {images.length}/{MAX_IMAGES}
      </div>

      {/* Image thumbnails grid */}
      <div className="flex flex-wrap gap-2">
        {/* Existing images */}
        {images.map((image, index) => (
          <div
            key={index}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            className="group relative h-20 w-20 cursor-grab rounded-md border border-gray-200 bg-gray-50 active:cursor-grabbing"
          >
            {/* Image thumbnail */}
            {getDisplayUrl(image) && (
              <Image
                src={getDisplayUrl(image)!}
                alt={`Product image ${index + 1}`}
                fill
                className="rounded-md object-cover"
              />
            )}

            {/* Drag handle indicator */}
            <div className="absolute left-1 top-1 rounded bg-white/80 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical className="h-3 w-3 text-gray-500" />
            </div>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => removeImage(index)}
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              aria-label={`Remove image ${index + 1}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* Add image button */}
        {canAddMore && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 transition-colors"
          >
            <Plus className="h-6 w-6 text-gray-400" />
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Help text */}
      <p className="text-xs text-gray-400">
        Drag images to reorder. Click + to add (max {MAX_IMAGES}).
      </p>
    </div>
  );
}

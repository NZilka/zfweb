"use client";

import React, { useRef } from "react";
import { ImgBox, ShowImg } from "./ImgOptions";
import { useEditImage } from "~/app/_context/EditImageContext";
import { useDragDrop } from "./useDragDrop";

interface ImageSlotProps {
  index: number;  // Slot index in the display (0-4)
}

/**
 * ImageSlot component - displays either an image or an empty "+" add slot.
 * Supports drag-and-drop reordering for slots with images.
 *
 * Behavior:
 * - Empty slot: Click to trigger file picker
 * - Filled slot: Drag to reorder, click to replace image, X button to remove
 *
 * The component uses the useDragDrop hook for custom drag behavior with
 * early hit detection (5% overlap threshold vs HTML5 drag API's 50%).
 */
const ImageSlot = ({ index }: ImageSlotProps) => {
  const { images, addImage, removeImage, reorderImages, canAddMore } = useEditImage();
  const inputRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);  // Used by drag/drop for position calculations

  // Get the image at this index (if any) - may be undefined for empty slots
  const image = images[index];
  const hasImage = !!image;

  // Use custom drag/drop hook for precise hit detection (5% overlap threshold)
  const { isDragging, isDropTarget, dragHandlers } = useDragDrop({
    index,
    hasImage,
    slotRef,
    onReorder: reorderImages,
  });

  // Get display URL based on image type:
  // - "existing": Use UploadThing CDN URL stored in database
  // - "new": Use blob URL created when user selected file (for preview before upload)
  const displayUrl = image?.type === "existing"
    ? image.url
    : image?.type === "new"
      ? image.previewUrl
      : undefined;

  // Handle file selection for empty slot or replacing existing image
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && canAddMore) {
      // Create blob URL for immediate preview (revoked when image is removed or component unmounts)
      const previewUrl = URL.createObjectURL(file);
      addImage(file, previewUrl);
    }
    // Reset input value to allow selecting the same file again if needed
    event.target.value = "";
  };

  // Handle remove button click - prevents event from bubbling to parent click handler
  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    removeImage(index);
  };

  // Handle click on empty slot to trigger hidden file input
  const handleEmptyClick = () => {
    inputRef.current?.click();
  };

  return (
    // Container div with conditional styling for drag states:
    // - isDragging: Green ring + slight scale up + reduced opacity (source slot)
    // - isDropTarget: Blue ring + slight scale up (potential drop location)
    <div
      ref={slotRef}
      className={`relative transition-all ${
        isDragging ? "scale-105 ring-2 ring-green-500 opacity-75 z-50" : ""
      } ${
        isDropTarget ? "scale-105 ring-2 ring-blue-500" : ""
      }`}
      {...dragHandlers}  // Includes onMouseDown and data-slot-index for drag detection
    >
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        id={`image-slot-${index}`}
      />

      {/* Conditional rendering: show image with controls, or empty add slot */}
      {hasImage ? (
        // Filled slot: shows image thumbnail with remove button overlay
        // Click on image opens file picker to replace it (unless mid-drag)
        <>
          <div
            className="cursor-grab active:cursor-grabbing select-none"
            onClick={() => !isDragging && inputRef.current?.click()}
          >
            <ShowImg imgUrl={displayUrl ?? ""} altTxt={`Image ${index + 1}`} />
          </div>
          {/* Remove button - positioned outside slot bounds for easy clicking */}
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 z-10"
            aria-label={`Remove image ${index + 1}`}
          >
            ×
          </button>
        </>
      ) : (
        // Empty slot: displays "+" icon, click to add new image
        // Not draggable (hasImage=false prevents drag initiation in useDragDrop)
        <div className="cursor-pointer" onClick={handleEmptyClick}>
          <ImgBox mediaType="+" num="" />
        </div>
      )}
    </div>
  );
};

export default ImageSlot;

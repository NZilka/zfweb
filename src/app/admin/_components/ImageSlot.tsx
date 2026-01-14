"use client";

import React, { useRef } from "react";
import { ImgBox, ShowImg } from "./ImgOptions";
import { useEditImage } from "~/app/_context/EditImageContext";
import { useDragDrop } from "./useDragDrop";

interface ImageSlotProps {
  index: number;  // Slot index in the display
}

// ImageSlot component - displays either an image or an empty add slot
// Supports drag-and-drop reordering for slots with images
const ImageSlot = ({ index }: ImageSlotProps) => {
  const { images, addImage, removeImage, reorderImages, canAddMore } = useEditImage();
  const inputRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);

  // Get the image at this index (if any)
  const image = images[index];
  const hasImage = !!image;

  // Use custom drag/drop hook for precise hit detection
  const { isDragging, isDropTarget, dragHandlers } = useDragDrop({
    index,
    hasImage,
    slotRef,
    onReorder: reorderImages,
  });

  // Get display URL based on image type
  const displayUrl = image?.type === "existing"
    ? image.url
    : image?.type === "new"
      ? image.previewUrl
      : undefined;

  // Handle file selection for empty slot
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && canAddMore) {
      // Create blob URL for preview
      const previewUrl = URL.createObjectURL(file);
      addImage(file, previewUrl);
    }
    // Reset input to allow selecting same file again
    event.target.value = "";
  };

  // Handle remove button click
  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    removeImage(index);
  };

  // Handle click on empty slot to trigger file input
  const handleEmptyClick = () => {
    inputRef.current?.click();
  };

  return (
    <div
      ref={slotRef}
      className={`relative transition-all ${
        isDragging ? "scale-105 ring-2 ring-green-500 opacity-75 z-50" : ""
      } ${
        isDropTarget ? "scale-105 ring-2 ring-blue-500" : ""
      }`}
      {...dragHandlers}
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

      {hasImage ? (
        // Show image with remove button, draggable
        <>
          <div
            className="cursor-grab active:cursor-grabbing select-none"
            onClick={() => !isDragging && inputRef.current?.click()}
          >
            <ShowImg imgUrl={displayUrl ?? ""} altTxt={`Image ${index + 1}`} />
          </div>
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
        // Show empty slot for adding (not draggable)
        <div className="cursor-pointer" onClick={handleEmptyClick}>
          <ImgBox mediaType="+" num="" />
        </div>
      )}
    </div>
  );
};

export default ImageSlot;

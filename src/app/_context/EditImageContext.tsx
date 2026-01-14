"use client";

import React, { createContext, useState, useContext, ReactNode } from "react";

const MAX_IMAGES = 5;

// Represents an image in the list (either existing from DB or newly added)
export interface ImageItem {
  type: "existing" | "new";
  url?: string;   // URL for existing images (from UploadThing CDN)
  key?: string;   // UploadThing key for existing images (for deletion tracking)
  file?: File;    // File object for new uploads
  previewUrl?: string; // Blob URL for preview (new uploads only)
}

// Describes the final order of images after user reordering.
// Each entry points to either an existing image (by index into keepUrls/keepKeys)
// or a new upload (by index into newFiles array). This preserves interleaved order
// when users drag new images among existing ones.
export interface OrderedImageRef {
  type: "existing" | "new";
  index: number;  // Index into keepUrls/keepKeys (existing) or newFiles (new)
}

interface EditImageContextType {
  // Current images array (no gaps, max 5)
  images: ImageItem[];
  // Keys of existing images that were removed (for UploadThing deletion)
  removedKeys: string[];
  // Add a new image file to the end
  addImage: (file: File, previewUrl: string) => void;
  // Remove image at index (shifts remaining left)
  removeImage: (index: number) => void;
  // Reorder images by moving from one index to another
  reorderImages: (fromIndex: number, toIndex: number) => void;
  // Get data for form submission - includes orderedImages to preserve interleaved order
  getImageChanges: () => {
    keepUrls: string[];
    keepKeys: string[];
    removeKeys: string[];
    newFiles: File[];
    orderedImages: OrderedImageRef[];  // Describes final order after reordering
  };
  // Reset to initial state
  reset: () => void;
  // Initialize from existing product (edit mode)
  initializeFromProduct: (urls: string[], keys: string[]) => void;
  // Check if can add more images
  canAddMore: boolean;
  // Get slot count to display (images + 1 empty, up to MAX)
  displaySlotCount: number;
}

const EditImageContext = createContext<EditImageContextType | undefined>(undefined);

export const EditImageProvider = ({ children }: { children: ReactNode }) => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [removedKeys, setRemovedKeys] = useState<string[]>([]);

  // Add new image file to the end of the list
  const addImage = (file: File, previewUrl: string) => {
    if (images.length >= MAX_IMAGES) return;

    setImages(prev => [
      ...prev,
      { type: "new", file, previewUrl }
    ]);
  };

  // Remove image at index, shift remaining left
  const removeImage = (index: number) => {
    if (index < 0 || index >= images.length) return;

    setImages(prev => {
      const removed = prev[index];

      // If removing an existing image, track its key for deletion
      if (removed && removed.type === "existing" && removed.key) {
        setRemovedKeys(keys => [...keys, removed.key!]);
      }

      // If removing a new image with preview URL, revoke it
      if (removed && removed.type === "new" && removed.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }

      // Remove and return new array (shifts left automatically)
      return prev.filter((_, i) => i !== index);
    });
  };

  // Reorder images by moving one to a new position
  const reorderImages = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= images.length) return;
    if (toIndex < 0 || toIndex >= images.length) return;

    setImages(prev => {
      const newImages = [...prev];
      // Remove from old position
      const [moved] = newImages.splice(fromIndex, 1);
      // Insert at new position
      newImages.splice(toIndex, 0, moved!);
      return newImages;
    });
  };

  // Extract changes for form submission.
  // Returns separate arrays for existing (keep) and new images, plus an orderedImages
  // array that describes the final interleaved order after user reordering.
  // Example: User reorders [E1, N1, E2] -> orderedImages: [{existing,0}, {new,0}, {existing,1}]
  const getImageChanges = () => {
    const keepUrls: string[] = [];
    const keepKeys: string[] = [];
    const newFiles: File[] = [];
    const orderedImages: OrderedImageRef[] = [];

    // Track indices as we build the arrays so orderedImages can reference them
    let existingIndex = 0;
    let newIndex = 0;

    images.forEach((img) => {
      if (img.type === "existing") {
        if (img.url) keepUrls.push(img.url);
        if (img.key) keepKeys.push(img.key);
        // Record this position references existing image at existingIndex
        orderedImages.push({ type: "existing", index: existingIndex });
        existingIndex++;
      } else if (img.type === "new" && img.file) {
        newFiles.push(img.file);
        // Record this position references new upload at newIndex
        orderedImages.push({ type: "new", index: newIndex });
        newIndex++;
      }
    });

    return { keepUrls, keepKeys, removeKeys: removedKeys, newFiles, orderedImages };
  };

  // Reset to empty state
  const reset = () => {
    // Revoke any blob URLs before clearing
    images.forEach(img => {
      if (img.type === "new" && img.previewUrl) {
        URL.revokeObjectURL(img.previewUrl);
      }
    });
    setImages([]);
    setRemovedKeys([]);
  };

  // Initialize from existing product data (edit mode)
  const initializeFromProduct = (urls: string[], keys: string[]) => {
    // Clear any existing state first
    reset();

    // Create image items from existing data (up to MAX)
    const existingImages: ImageItem[] = [];
    const count = Math.min(urls.length, MAX_IMAGES);

    for (let i = 0; i < count; i++) {
      existingImages.push({
        type: "existing",
        url: urls[i],
        key: keys[i],
      });
    }

    setImages(existingImages);
    setRemovedKeys([]);
  };

  // Can add more if under the limit
  const canAddMore = images.length < MAX_IMAGES;

  // Display slots: current images + 1 empty slot for adding (up to MAX)
  const displaySlotCount = Math.min(images.length + 1, MAX_IMAGES);

  return (
    <EditImageContext.Provider
      value={{
        images,
        removedKeys,
        addImage,
        removeImage,
        reorderImages,
        getImageChanges,
        reset,
        initializeFromProduct,
        canAddMore,
        displaySlotCount,
      }}
    >
      {children}
    </EditImageContext.Provider>
  );
};

export const useEditImage = () => {
  const context = useContext(EditImageContext);
  if (!context) {
    throw new Error("useEditImage must be used within an EditImageProvider");
  }
  return context;
};

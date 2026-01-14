"use client";

import React, { createContext, useState, useContext, ReactNode } from "react";

// Represents the state of a single image slot during editing
export interface ImageSlot {
  type: "existing" | "new" | "removed" | "empty";
  url?: string;   // URL for existing images (from UploadThing CDN)
  key?: string;   // UploadThing key for deletion tracking
  file?: File;    // File object for new uploads
}

// Fixed 3-slot structure matching the product form
export type ImageSlots = [ImageSlot, ImageSlot, ImageSlot];

interface EditImageContextType {
  slots: ImageSlots;
  // Update a specific slot (0-2)
  setSlot: (index: number, slot: ImageSlot) => void;
  // Mark a slot as removed (for existing images being deleted)
  removeSlot: (index: number) => void;
  // Clear a slot back to empty
  clearSlot: (index: number) => void;
  // Get changes for submission - separates kept, removed, and new images
  getImageChanges: () => {
    keepUrls: string[];
    keepKeys: string[];
    removeKeys: string[];
    newFiles: File[];
  };
  // Reset all slots (for form clear or cancel)
  resetSlots: () => void;
  // Initialize slots from existing product images
  initializeFromProduct: (urls: string[], keys: string[]) => void;
}

// Default empty slots
const createEmptySlots = (): ImageSlots => [
  { type: "empty" },
  { type: "empty" },
  { type: "empty" },
];

const EditImageContext = createContext<EditImageContextType | undefined>(undefined);

export const EditImageProvider = ({ children }: { children: ReactNode }) => {
  const [slots, setSlots] = useState<ImageSlots>(createEmptySlots());

  // Update a single slot by index
  const setSlot = (index: number, slot: ImageSlot) => {
    if (index < 0 || index > 2) return;
    setSlots((prev) => {
      const newSlots = [...prev] as ImageSlots;
      newSlots[index] = slot;
      return newSlots;
    });
  };

  // Mark existing image as removed (will be deleted from UploadThing on save)
  const removeSlot = (index: number) => {
    if (index < 0 || index > 2) return;
    setSlots((prev) => {
      const newSlots = [...prev] as ImageSlots;
      const current = prev[index];
      // If it was an existing image, mark as removed to track key for deletion
      if (current && current.type === "existing" && current.key) {
        newSlots[index] = { type: "removed", key: current.key };
      } else {
        // For new uploads or empty, just clear the slot
        newSlots[index] = { type: "empty" };
      }
      return newSlots;
    });
  };

  // Clear slot back to empty (used when user clicks X on new upload)
  const clearSlot = (index: number) => {
    if (index < 0 || index > 2) return;
    setSlots((prev) => {
      const newSlots = [...prev] as ImageSlots;
      newSlots[index] = { type: "empty" };
      return newSlots;
    });
  };

  // Extract changes for form submission
  const getImageChanges = () => {
    const keepUrls: string[] = [];
    const keepKeys: string[] = [];
    const removeKeys: string[] = [];
    const newFiles: File[] = [];

    slots.forEach((slot) => {
      switch (slot.type) {
        case "existing":
          // Keep existing images
          if (slot.url) keepUrls.push(slot.url);
          if (slot.key) keepKeys.push(slot.key);
          break;
        case "removed":
          // Mark for deletion from UploadThing
          if (slot.key) removeKeys.push(slot.key);
          break;
        case "new":
          // New files to upload
          if (slot.file) newFiles.push(slot.file);
          break;
        // "empty" slots are ignored
      }
    });

    return { keepUrls, keepKeys, removeKeys, newFiles };
  };

  // Reset all slots to empty
  const resetSlots = () => {
    setSlots(createEmptySlots());
  };

  // Initialize slots from existing product data (for edit mode)
  const initializeFromProduct = (urls: string[], keys: string[]) => {
    const newSlots: ImageSlots = createEmptySlots();
    // Populate slots with existing images (up to 3)
    for (let i = 0; i < Math.min(urls.length, 3); i++) {
      newSlots[i] = {
        type: "existing",
        url: urls[i],
        key: keys[i],
      };
    }
    setSlots(newSlots);
  };

  return (
    <EditImageContext.Provider
      value={{
        slots,
        setSlot,
        removeSlot,
        clearSlot,
        getImageChanges,
        resetSlots,
        initializeFromProduct,
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

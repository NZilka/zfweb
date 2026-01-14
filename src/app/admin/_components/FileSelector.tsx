"use client";

import React from "react";
import { ImgBox, ShowImg } from "./ImgOptions";
import { useFile } from "~/app/_context/FileContext";
import { useEditImage, type ImageSlot } from "~/app/_context/EditImageContext";

// FileSelector handles image selection for both create and edit modes
// In edit mode, it can display existing images and track changes
interface FileSelectorProps {
  num: string;                    // Slot number (1, 2, or 3)
  existingUrl?: string;           // URL of existing image (edit mode)
  existingKey?: string;           // UploadThing key (edit mode, for deletion tracking)
  onRemove?: () => void;          // Callback when image is removed
  mode?: "create" | "edit";       // Form mode determines behavior
}

const FileSelector = ({
  num,
  existingUrl,
  existingKey,
  onRemove,
  mode = "create",
}: FileSelectorProps) => {
  const [fileName, setFileName] = React.useState<string>("");
  const { files, setFiles } = useFile();
  const fileNum = `file${num}`;
  const slotIndex = parseInt(num) - 1; // Convert 1-indexed to 0-indexed

  // Try to use EditImageContext if available (edit mode)
  let editImageContext: ReturnType<typeof useEditImage> | null = null;
  try {
    editImageContext = useEditImage();
  } catch {
    // Context not available in create mode - that's fine
  }

  // Handle new file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log("file selected:", file.name);
      setFiles({ ...files, [fileNum]: file });
      setFileName(file.name);

      // In edit mode, update the slot state to track new upload
      if (mode === "edit" && editImageContext) {
        editImageContext.setSlot(slotIndex, {
          type: "new",
          file: file,
        });
      }
    }
    // Reset input value to allow re-selecting same file
    event.target.value = "";
  };

  // Handle remove button click - removes image from slot
  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Clear the file from FileContext
    setFiles({ ...files, [fileNum]: undefined });
    setFileName("");

    // In edit mode, update slot state appropriately
    if (mode === "edit" && editImageContext) {
      editImageContext.removeSlot(slotIndex);
    }

    // Call parent callback if provided
    onRemove?.();
  };

  // Determine what to display based on state
  const currentFile = files[fileNum];
  const slot = editImageContext?.slots[slotIndex];

  // Check if we have an image to show (either new file or existing)
  const hasExistingImage = mode === "edit" && slot?.type === "existing" && slot.url;
  const hasNewFile = currentFile instanceof File;
  const hasImage = hasExistingImage || hasNewFile;

  // Get the URL to display
  const displayUrl = hasNewFile
    ? URL.createObjectURL(currentFile)
    : hasExistingImage
      ? slot.url
      : undefined;

  const displayAlt = hasNewFile ? fileName : hasExistingImage ? `Image ${num}` : "";

  return (
    <div className="relative">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        id={`file-selector-${num}`}
      />
      <label htmlFor={`file-selector-${num}`} className="cursor-pointer">
        <div>
          {displayUrl ? (
            <ShowImg imgUrl={displayUrl} altTxt={displayAlt} />
          ) : (
            <ImgBox mediaType="Image" num={num} />
          )}
        </div>
      </label>

      {/* Remove button - shown when there's an image */}
      {hasImage && (
        <button
          type="button"
          onClick={handleRemove}
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
          aria-label={`Remove image ${num}`}
        >
          ×
        </button>
      )}
    </div>
  );
};

export default FileSelector;

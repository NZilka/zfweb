/**
 * CarouselModal — Grid-based editor for carousel rows
 * Allows configuring 4 rows of either 3 images or 1 full-width video
 * Rows are draggable to reorder. Includes a sub-dialog for picking product images.
 */
"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Plus, X, Video, Loader2, Upload, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { useUploadThing } from "~/utils/uploadthing";
import { copyProductImageToCarousel } from "~/server/settings-actions";
import type { CarouselRow, CarouselImageCell } from "~/server/kv";
import {
  ImageCropEditor,
  cropToStyle,
  type CropData,
} from "~/components/ui/ImageCropEditor";

interface CarouselModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRows: (CarouselRow | null)[];
  initialInterval: number;
  productImages: { url: string; alt: string }[];
  onSave: (rows: (CarouselRow | null)[], interval: number) => void;
}

// Props for a single sortable row component
interface SortableRowProps {
  id: string;
  rowIdx: number;
  row: CarouselRow | null;
  isVideoUploading: number | null;
  onCellClick: (rowIdx: number, cellIdx: number) => void;
  onRemoveCell: (rowIdx: number, cellIdx: number) => void;
  onClearRow: (rowIdx: number) => void;
  onVideoUpload: (rowIdx: number) => void;
  onVideoPositionChange: (rowIdx: number, value: number) => void;
  // Open crop editor for a filled image cell
  onCropClick: (rowIdx: number, cellIdx: number) => void;
}

// Sortable row component — wraps row content with drag handle
function SortableRow({
  id,
  rowIdx,
  row,
  isVideoUploading,
  onCellClick,
  onRemoveCell,
  onClearRow,
  onVideoUpload,
  onVideoPositionChange,
  onCropClick,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-2">
      {/* Row header with drag handle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab touch-none text-gray-400 hover:text-gray-600 active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder row ${rowIdx + 1}`}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <Label className="text-sm font-medium">Row {rowIdx + 1}</Label>
      </div>

      {/* Video row — shows preview with position slider */}
      {row?.type === "video" ? (
        <div className="space-y-2 pl-7">
          <div className="relative overflow-hidden rounded-lg border">
            {/* Video preview with cover positioning */}
            <video
              src={row.url}
              muted
              playsInline
              className="h-[120px] w-full object-cover sm:h-[160px]"
              style={{
                objectPosition: `center ${row.videoPositionY}%`,
              }}
            />
            {/* Remove video button */}
            <button
              type="button"
              onClick={() => onClearRow(rowIdx)}
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
              aria-label="Remove video"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Vertical position slider for video */}
          <div className="flex items-center gap-3">
            <Label className="whitespace-nowrap text-xs">Y Position</Label>
            <input
              type="range"
              min={0}
              max={100}
              value={row.videoPositionY}
              onChange={(e) =>
                onVideoPositionChange(rowIdx, Number(e.target.value))
              }
              className="flex-1"
            />
            <span className="w-8 text-right text-xs text-gray-500">
              {row.videoPositionY}%
            </span>
          </div>
        </div>
      ) : (
        /* Images row — 3 cells + video button */
        <div className="flex items-center gap-2 pl-7 sm:gap-3">
          {/* 3 image cells */}
          {[0, 1, 2].map((cellIdx) => {
            const cell = row?.type === "images" ? row.cells[cellIdx] : null;
            return (
              <div
                key={cellIdx}
                className="relative h-[80px] w-[80px] flex-shrink-0 sm:h-[100px] sm:w-[100px]"
              >
                {cell ? (
                  <>
                    {/* Filled cell — clickable thumbnail for crop positioning */}
                    <button
                      type="button"
                      onClick={() => onCropClick(rowIdx, cellIdx)}
                      className="relative h-full w-full overflow-hidden rounded-lg border"
                      aria-label={`Position image in row ${rowIdx + 1}, cell ${cellIdx + 1}`}
                    >
                      {/* Show crop preview if crop data exists, otherwise default cover */}
                      <Image
                        src={cell.url}
                        width={100}
                        height={100}
                        alt={cell.alt}
                        className={
                          cell.crop
                            ? "pointer-events-none"
                            : "h-full w-full object-cover"
                        }
                        style={cell.crop ? cropToStyle(cell.crop) : undefined}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveCell(rowIdx, cellIdx)}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  /* Empty cell — clickable to open picker */
                  <button
                    type="button"
                    onClick={() => onCellClick(rowIdx, cellIdx)}
                    className="flex h-full w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500"
                    aria-label={`Add image to row ${rowIdx + 1}, cell ${cellIdx + 1}`}
                  >
                    <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Video upload button for this row */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onVideoUpload(rowIdx)}
            disabled={isVideoUploading === rowIdx}
            className="ml-auto flex-shrink-0"
          >
            {isVideoUploading === rowIdx ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Video className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Video</span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export function CarouselModal({
  open,
  onOpenChange,
  initialRows,
  initialInterval,
  productImages,
  onSave,
}: CarouselModalProps) {
  // Local state for editing — only committed on save
  const [rows, setRows] = useState<(CarouselRow | null)[]>([...initialRows]);
  const [interval, setInterval] = useState(initialInterval);
  // Track which cell is being picked (rowIndex + cellIndex)
  const [pickerTarget, setPickerTarget] = useState<{
    row: number;
    cell: number;
  } | null>(null);
  // Track which filled cell is being cropped (rowIndex + cellIndex)
  const [cropTarget, setCropTarget] = useState<{
    row: number;
    cell: number;
  } | null>(null);
  // Loading states for async operations
  const [isCopying, setIsCopying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isVideoUploading, setIsVideoUploading] = useState<number | null>(null);
  // Ref for hidden file inputs
  const imageFileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  // Track which row is getting a video upload
  const videoUploadRowRef = useRef<number>(0);

  // Stable IDs for sortable rows (0-3 positions)
  const rowIds = ["row-0", "row-1", "row-2", "row-3"];

  // Drag sensors for pointer and keyboard accessibility
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end — reorder the rows array
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = rowIds.indexOf(active.id as string);
      const newIndex = rowIds.indexOf(over.id as string);
      // Reorder the actual row data to match the new visual order
      setRows((prev) => arrayMove(prev, oldIndex, newIndex));
    }
  };

  // Reset local state when modal opens with fresh data
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setRows([...initialRows]);
      setInterval(initialInterval);
      setPickerTarget(null);
      setCropTarget(null);
    }
    onOpenChange(isOpen);
  };

  // UploadThing hook for carousel image uploads
  const { startUpload: startImageUpload } = useUploadThing(
    "carouselMediaUploader",
    {
      onClientUploadComplete: (res) => {
        if (res?.[0] && pickerTarget) {
          // Fill the targeted cell with the uploaded image
          const newCell: CarouselImageCell = {
            url: res[0].url,
            key: res[0].key,
            alt: "",
          };
          setCellInRow(pickerTarget.row, pickerTarget.cell, newCell);
          setPickerTarget(null);
          toast.success("Image uploaded");
        }
        setIsUploading(false);
      },
      onUploadError: (error) => {
        toast.error(`Upload failed: ${error.message}`);
        setIsUploading(false);
      },
    }
  );

  // UploadThing hook for video uploads
  const { startUpload: startVideoUpload } = useUploadThing(
    "carouselMediaUploader",
    {
      onClientUploadComplete: (res) => {
        if (res?.[0]) {
          const rowIdx = videoUploadRowRef.current;
          // Replace entire row with a video row
          const newRows = [...rows];
          newRows[rowIdx] = {
            type: "video",
            url: res[0].url,
            key: res[0].key,
            videoPositionY: 50, // Default center
          };
          setRows(newRows);
          toast.success("Video uploaded");
        }
        setIsVideoUploading(null);
      },
      onUploadError: (error) => {
        toast.error(`Video upload failed: ${error.message}`);
        setIsVideoUploading(null);
      },
    }
  );

  // Set a single cell within an images row, creating the row if needed
  const setCellInRow = (
    rowIdx: number,
    cellIdx: number,
    cell: CarouselImageCell | null
  ) => {
    const newRows = [...rows];
    const existing = newRows[rowIdx];
    // If row doesn't exist or is a video, create a fresh images row
    if (!existing || existing.type === "video") {
      const cells: (CarouselImageCell | null)[] = [null, null, null];
      cells[cellIdx] = cell;
      newRows[rowIdx] = { type: "images", cells };
    } else {
      // Update existing images row
      const newCells = [...existing.cells];
      newCells[cellIdx] = cell;
      newRows[rowIdx] = { type: "images", cells: newCells };
    }
    setRows(newRows);
  };

  // Remove an image cell from a row
  const removeCell = (rowIdx: number, cellIdx: number) => {
    const row = rows[rowIdx];
    if (!row || row.type !== "images") return;
    const newCells = [...row.cells];
    newCells[cellIdx] = null;
    // If all cells are now empty, clear the entire row
    const allEmpty = newCells.every((c) => c === null);
    const newRows = [...rows];
    newRows[rowIdx] = allEmpty ? null : { type: "images", cells: newCells };
    setRows(newRows);
  };

  // Clear an entire row (used for removing video rows)
  const clearRow = (rowIdx: number) => {
    const newRows = [...rows];
    newRows[rowIdx] = null;
    setRows(newRows);
  };

  // Handle video position slider change
  const updateVideoPositionY = (rowIdx: number, value: number) => {
    const row = rows[rowIdx];
    if (!row || row.type !== "video") return;
    const newRows = [...rows];
    newRows[rowIdx] = { ...row, videoPositionY: value };
    setRows(newRows);
  };

  // Update crop data for a specific image cell
  const updateCellCrop = (rowIdx: number, cellIdx: number, crop: CropData) => {
    const row = rows[rowIdx];
    if (!row || row.type !== "images") return;
    const cell = row.cells[cellIdx];
    if (!cell) return;
    const newCells = [...row.cells];
    newCells[cellIdx] = { ...cell, crop };
    const newRows = [...rows];
    newRows[rowIdx] = { type: "images", cells: newCells };
    setRows(newRows);
  };

  // Handle picking a product image — copies it to carousel storage
  const handlePickProductImage = async (img: {
    url: string;
    alt: string;
  }) => {
    if (!pickerTarget) return;
    setIsCopying(true);
    const result = await copyProductImageToCarousel(img.url);
    if (result.success) {
      setCellInRow(pickerTarget.row, pickerTarget.cell, {
        url: result.url,
        key: result.key,
        alt: img.alt,
      });
      setPickerTarget(null);
      toast.success("Image added to carousel");
    } else {
      toast.error(result.error);
    }
    setIsCopying(false);
  };

  // Handle custom image upload from the cell picker
  const handleImageFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be less than 8MB");
      return;
    }
    setIsUploading(true);
    await startImageUpload([file]);
    e.target.value = "";
  };

  // Handle video file selection for a row
  const handleVideoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 32 * 1024 * 1024) {
      toast.error("Video must be less than 32MB");
      return;
    }
    setIsVideoUploading(videoUploadRowRef.current);
    await startVideoUpload([file]);
    e.target.value = "";
  };

  // Trigger video file picker for a specific row
  const triggerVideoUpload = (rowIdx: number) => {
    videoUploadRowRef.current = rowIdx;
    videoFileRef.current?.click();
  };

  return (
    <>
      {/* Hidden file inputs for uploads */}
      <input
        ref={imageFileRef}
        type="file"
        accept="image/*"
        onChange={handleImageFileChange}
        className="hidden"
      />
      <input
        ref={videoFileRef}
        type="file"
        accept="video/*"
        onChange={handleVideoFileChange}
        className="hidden"
      />

      {/* Main carousel editor modal — hidden when picker or crop sub-dialog is open */}
      <Dialog open={open && !pickerTarget && !cropTarget} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Carousel</DialogTitle>
            <DialogDescription>
              Set up to 4 rows. Each row can be 3 images or 1 video. Drag to
              reorder.
            </DialogDescription>
          </DialogHeader>

          {/* Row grid — 4 sortable rows */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={rowIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-6">
                {rows.map((row, rowIdx) => (
                  <SortableRow
                    key={rowIds[rowIdx]}
                    id={rowIds[rowIdx]!}
                    rowIdx={rowIdx}
                    row={row}
                    isVideoUploading={isVideoUploading}
                    onCellClick={(r, c) => setPickerTarget({ row: r, cell: c })}
                    onRemoveCell={removeCell}
                    onClearRow={clearRow}
                    onVideoUpload={triggerVideoUpload}
                    onVideoPositionChange={updateVideoPositionY}
                    onCropClick={(r, c) => setCropTarget({ row: r, cell: c })}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Auto-scroll interval slider */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center gap-3">
              <Label className="whitespace-nowrap text-sm">
                Auto-scroll interval
              </Label>
              <input
                type="range"
                min={1000}
                max={10000}
                step={500}
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-10 text-right text-sm text-gray-500">
                {(interval / 1000).toFixed(1)}s
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => onSave(rows, interval)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cell picker sub-dialog — shown when clicking an empty cell */}
      <Dialog
        open={!!pickerTarget}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPickerTarget(null);
        }}
      >
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choose Image</DialogTitle>
            <DialogDescription>
              Select a product image or upload a new one.
            </DialogDescription>
          </DialogHeader>

          {/* Product images grid */}
          {productImages.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">Product Images</Label>
              <div className="grid max-h-[40vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                {productImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePickProductImage(img)}
                    disabled={isCopying}
                    className="overflow-hidden rounded-lg border hover:border-blue-500 hover:ring-2 hover:ring-blue-200 disabled:opacity-50"
                  >
                    <Image
                      src={img.url}
                      width={100}
                      height={100}
                      alt={img.alt}
                      className="h-[80px] w-full object-cover sm:h-[100px]"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading indicator for copy operation */}
          {isCopying && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-gray-500">Copying image...</span>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400">or</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {/* Upload new image button */}
          <Button
            variant="outline"
            onClick={() => imageFileRef.current?.click()}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload New Image
              </>
            )}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Crop positioning sub-dialog — shown when clicking a filled image cell */}
      <Dialog
        open={!!cropTarget}
        onOpenChange={(isOpen) => {
          if (!isOpen) setCropTarget(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Position Image</DialogTitle>
            <DialogDescription>
              Drag to pan, scroll or use slider to zoom. This sets how the image
              appears in the carousel.
            </DialogDescription>
          </DialogHeader>

          {/* Render crop editor for the targeted cell */}
          {cropTarget && (() => {
            const row = rows[cropTarget.row];
            const cell =
              row?.type === "images" ? row.cells[cropTarget.cell] : null;
            if (!cell) return null;
            return (
              <ImageCropEditor
                imageUrl={cell.url}
                initialCrop={cell.crop}
                aspect={1}
                onChange={(data) =>
                  updateCellCrop(cropTarget.row, cropTarget.cell, data)
                }
              />
            );
          })()}

          <DialogFooter>
            <Button onClick={() => setCropTarget(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

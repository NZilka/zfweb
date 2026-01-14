"use client";

import { useState, useEffect, useCallback, RefObject } from "react";

// Global state to track drag operation across all slots
let globalDragState: {
  isDragging: boolean;
  fromIndex: number | null;
  draggedRect: DOMRect | null;
  bestTargetIndex: number | null;  // Only one target highlighted at a time
  ghostElement: HTMLDivElement | null;  // Ghost image element
} = {
  isDragging: false,
  fromIndex: null,
  draggedRect: null,
  bestTargetIndex: null,
  ghostElement: null,
};

// Subscribers to notify when drag state changes
const subscribers = new Set<() => void>();

const notifySubscribers = () => {
  subscribers.forEach((cb) => cb());
};

// Calculate overlap percentage between two rectangles
const calculateOverlap = (rect1: DOMRect, rect2: DOMRect): number => {
  const xOverlap = Math.max(0, Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left));
  const yOverlap = Math.max(0, Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top));
  const overlapArea = xOverlap * yOverlap;
  const rect2Area = rect2.width * rect2.height;
  return rect2Area > 0 ? overlapArea / rect2Area : 0;
};

// Find the best drop target (highest overlap >= 5%)
const findBestTarget = (fromIndex: number): number | null => {
  if (!globalDragState.draggedRect) return null;

  let bestTarget: { index: number; overlap: number } | null = null;

  document.querySelectorAll("[data-slot-index]").forEach((el) => {
    const targetIndex = parseInt(el.getAttribute("data-slot-index") ?? "", 10);
    if (isNaN(targetIndex) || targetIndex === fromIndex) return;

    // Only consider slots that have images (check for img element)
    if (!el.querySelector("img")) return;

    const targetRect = el.getBoundingClientRect();
    const overlap = calculateOverlap(globalDragState.draggedRect!, targetRect);

    if (overlap >= 0.05 && (!bestTarget || overlap > bestTarget.overlap)) {
      bestTarget = { index: targetIndex, overlap };
    }
  });

  return bestTarget?.index ?? null;
};

interface UseDragDropOptions {
  index: number;
  hasImage: boolean;
  slotRef: RefObject<HTMLDivElement | null>;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

// Custom hook for drag/drop with early hit detection (5% overlap)
export function useDragDrop({ index, hasImage, slotRef, onReorder }: UseDragDropOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);

  // Subscribe to global drag state changes
  useEffect(() => {
    const updateState = () => {
      // This slot is being dragged
      setIsDragging(globalDragState.isDragging && globalDragState.fromIndex === index);

      // Only this slot is the drop target if it's the best one
      setIsDropTarget(
        globalDragState.isDragging &&
        globalDragState.bestTargetIndex === index
      );
    };

    subscribers.add(updateState);
    return () => {
      subscribers.delete(updateState);
    };
  }, [index]);

  // Handle mouse down to start drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!hasImage) return;
      // Don't start drag if clicking on remove button
      if ((e.target as HTMLElement).closest("button")) return;

      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
      const startRect = slotRef.current?.getBoundingClientRect();
      if (!startRect) return;

      // Create ghost element (clone of the dragged image)
      const ghost = document.createElement("div");
      ghost.style.position = "fixed";
      ghost.style.pointerEvents = "none";
      ghost.style.zIndex = "9999";
      ghost.style.opacity = "0.7";
      ghost.style.width = `${startRect.width}px`;
      ghost.style.height = `${startRect.height}px`;
      ghost.style.left = `${startRect.left}px`;
      ghost.style.top = `${startRect.top}px`;
      ghost.style.transition = "none";
      ghost.style.display = "none";  // Hidden until movement

      // Clone the image inside
      const imgEl = slotRef.current?.querySelector("img");
      if (imgEl) {
        const imgClone = imgEl.cloneNode(true) as HTMLImageElement;
        imgClone.style.width = "100%";
        imgClone.style.height = "100%";
        imgClone.style.objectFit = "contain";
        ghost.appendChild(imgClone);
      }

      document.body.appendChild(ghost);

      // Start drag operation
      globalDragState = {
        isDragging: true,
        fromIndex: index,
        draggedRect: startRect,
        bestTargetIndex: null,
        ghostElement: ghost,
      };
      notifySubscribers();

      // Track mouse movement
      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        // Show ghost and update position on any movement
        ghost.style.display = "block";
        ghost.style.left = `${startRect.left + deltaX}px`;
        ghost.style.top = `${startRect.top + deltaY}px`;

        // Update the global dragged rect for overlap calculation
        globalDragState.draggedRect = new DOMRect(
          startRect.left + deltaX,
          startRect.top + deltaY,
          startRect.width,
          startRect.height
        );

        // Find and update the single best target
        globalDragState.bestTargetIndex = findBestTarget(index);

        notifySubscribers();
      };

      // Handle mouse up to end drag
      const handleMouseUp = () => {
        // Perform reorder if valid target found
        if (globalDragState.bestTargetIndex !== null && globalDragState.fromIndex !== null) {
          onReorder(globalDragState.fromIndex, globalDragState.bestTargetIndex);
        }

        // Remove ghost element
        if (globalDragState.ghostElement) {
          globalDragState.ghostElement.remove();
        }

        // Reset drag state
        globalDragState = {
          isDragging: false,
          fromIndex: null,
          draggedRect: null,
          bestTargetIndex: null,
          ghostElement: null,
        };
        notifySubscribers();

        // Remove listeners
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [hasImage, index, slotRef, onReorder]
  );

  // Return handlers and state
  return {
    isDragging,
    isDropTarget,
    dragHandlers: {
      onMouseDown: handleMouseDown,
      "data-slot-index": index,
    },
  };
}

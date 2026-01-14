"use client";

import { useState, useEffect, useCallback, useRef, RefObject } from "react";

// Global state to track drag operation across all slots.
// Using module-level state (instead of React state) because:
// 1. Multiple ImageSlot components need to share drag state
// 2. Changes need to be synchronous for precise mouse tracking
// 3. React re-renders would be too slow for 60fps drag updates
let globalDragState: {
  isDragging: boolean;
  fromIndex: number | null;
  draggedRect: DOMRect | null;
  bestTargetIndex: number | null;  // Only one target highlighted at a time
  ghostElement: HTMLDivElement | null;  // Ghost image element
  // Track cleanup functions for the active drag operation
  cleanupFn: (() => void) | null;
} = {
  isDragging: false,
  fromIndex: null,
  draggedRect: null,
  bestTargetIndex: null,
  ghostElement: null,
  cleanupFn: null,
};

// Subscribers to notify when drag state changes.
// Each ImageSlot subscribes to get re-rendered when drag state changes.
// This pattern avoids prop drilling and provides efficient updates.
const subscribers = new Set<() => void>();

const notifySubscribers = () => {
  subscribers.forEach((cb) => cb());
};

// Cleanup function to end drag operation and remove DOM elements.
// Called on mouseup or when component unmounts mid-drag.
const cleanupDrag = () => {
  // Remove ghost element from DOM
  if (globalDragState.ghostElement) {
    globalDragState.ghostElement.remove();
  }

  // Reset all state
  globalDragState = {
    isDragging: false,
    fromIndex: null,
    draggedRect: null,
    bestTargetIndex: null,
    ghostElement: null,
    cleanupFn: null,
  };

  notifySubscribers();
};

/**
 * Calculate overlap percentage between two rectangles.
 * Returns the percentage of rect2 that is covered by rect1.
 * Used to detect when the dragged image overlaps a potential drop target.
 */
const calculateOverlap = (rect1: DOMRect, rect2: DOMRect): number => {
  // Calculate the overlapping region (intersection of the two rectangles)
  const xOverlap = Math.max(0, Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left));
  const yOverlap = Math.max(0, Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top));
  const overlapArea = xOverlap * yOverlap;
  const rect2Area = rect2.width * rect2.height;
  // Return percentage of rect2 that is covered (0 to 1)
  return rect2Area > 0 ? overlapArea / rect2Area : 0;
};

/**
 * Find the best drop target slot among all available slots.
 * Uses a 5% overlap threshold (much lower than HTML5 drag API's ~50%)
 * so users can see the target highlight early as they drag.
 *
 * Only one target can be highlighted at a time (the one with highest overlap).
 * This prevents multiple slots from highlighting when the dragged image
 * overlaps several slots simultaneously.
 */
const findBestTarget = (fromIndex: number): number | null => {
  if (!globalDragState.draggedRect) return null;

  // Track the best candidate found so far
  let bestIndex: number | null = null;
  let bestOverlap = 0;

  // Query all slots by their data attribute (set in dragHandlers)
  document.querySelectorAll("[data-slot-index]").forEach((el) => {
    const targetIndex = parseInt(el.getAttribute("data-slot-index") ?? "", 10);
    // Skip invalid indices and the source slot (can't drop on yourself)
    if (isNaN(targetIndex) || targetIndex === fromIndex) return;

    // Only consider slots that have images (can't swap with empty slots)
    if (!el.querySelector("img")) return;

    const targetRect = el.getBoundingClientRect();
    const overlap = calculateOverlap(globalDragState.draggedRect!, targetRect);

    // 5% threshold provides early feedback while preventing accidental highlighting
    // Track the slot with the highest overlap as the drop target
    if (overlap >= 0.05 && overlap > bestOverlap) {
      bestIndex = targetIndex;
      bestOverlap = overlap;
    }
  });

  return bestIndex;
};

interface UseDragDropOptions {
  index: number;
  hasImage: boolean;
  slotRef: RefObject<HTMLDivElement | null>;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

// Custom hook for drag/drop with early hit detection (5% overlap).
// Uses mouse events instead of HTML5 drag API for precise control over
// when drop targets highlight (5% overlap threshold vs 50% default).
export function useDragDrop({ index, hasImage, slotRef, onReorder }: UseDragDropOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);

  // Track if this specific slot initiated the current drag (for cleanup on unmount)
  const isSourceOfDrag = useRef(false);

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

    // Cleanup on unmount: remove subscription and clean up drag if this component
    // started the drag (prevents ghost element and listeners from being orphaned)
    return () => {
      subscribers.delete(updateState);
      if (isSourceOfDrag.current && globalDragState.isDragging) {
        // Component is unmounting mid-drag - clean up
        if (globalDragState.cleanupFn) {
          globalDragState.cleanupFn();
        }
        cleanupDrag();
        isSourceOfDrag.current = false;
      }
    };
  }, [index]);

  // Handle mouse down to start drag.
  // Creates a ghost element that follows the cursor and sets up mouse listeners.
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

      // Mark this slot as the source of the drag (for cleanup on unmount)
      isSourceOfDrag.current = true;

      // Create ghost element - a semi-transparent clone of the image that
      // follows the cursor during drag to provide visual feedback
      const ghost = document.createElement("div");
      ghost.style.position = "fixed";
      ghost.style.pointerEvents = "none";  // Allow mouse events to pass through
      ghost.style.zIndex = "9999";
      ghost.style.opacity = "0.7";
      ghost.style.width = `${startRect.width}px`;
      ghost.style.height = `${startRect.height}px`;
      ghost.style.left = `${startRect.left}px`;
      ghost.style.top = `${startRect.top}px`;
      ghost.style.transition = "none";  // No animation - follow cursor exactly
      ghost.style.display = "none";  // Hidden until first movement

      // Clone the image inside the slot for the ghost
      const imgEl = slotRef.current?.querySelector("img");
      if (imgEl) {
        const imgClone = imgEl.cloneNode(true) as HTMLImageElement;
        imgClone.style.width = "100%";
        imgClone.style.height = "100%";
        imgClone.style.objectFit = "contain";
        ghost.appendChild(imgClone);
      }

      document.body.appendChild(ghost);

      // Initialize global drag state (cleanupFn added after handlers are defined)
      globalDragState = {
        isDragging: true,
        fromIndex: index,
        draggedRect: startRect,
        bestTargetIndex: null,
        ghostElement: ghost,
        cleanupFn: null,  // Set after handlers are defined
      };
      notifySubscribers();

      // Track mouse movement - updates ghost position and finds drop targets
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

        // Find and update the single best target (slot with highest overlap >= 5%)
        globalDragState.bestTargetIndex = findBestTarget(index);

        notifySubscribers();
      };

      // Handle mouse up to end drag - performs reorder if over a valid target
      const handleMouseUp = () => {
        // Perform reorder if valid target found
        if (globalDragState.bestTargetIndex !== null && globalDragState.fromIndex !== null) {
          onReorder(globalDragState.fromIndex, globalDragState.bestTargetIndex);
        }

        // Clear source flag and cleanup function before calling cleanupDrag
        isSourceOfDrag.current = false;

        // Remove listeners (must be done before cleanupDrag resets state)
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        // Clean up ghost element and reset global state
        cleanupDrag();
      };

      // Store cleanup function for event listeners (used if component unmounts mid-drag)
      globalDragState.cleanupFn = () => {
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

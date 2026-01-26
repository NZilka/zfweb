/**
 * ViewToggle - Toggle between list and grid view modes
 * Displays list and grid icons as toggle buttons
 */
"use client";

import { List, LayoutGrid } from "lucide-react";
import { Button } from "~/components/ui/button";
import type { ViewMode } from "./ProductsClient";

interface ViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    <div className="flex rounded-md border border-gray-300">
      {/* List view button */}
      <Button
        variant="ghost"
        size="sm"
        // Active state styling when list mode is selected
        className={`rounded-r-none ${
          viewMode === "list"
            ? "bg-gray-100 text-gray-900"
            : "text-gray-500 hover:text-gray-900"
        }`}
        onClick={() => onViewModeChange("list")}
        aria-label="List view"
        aria-pressed={viewMode === "list"}
      >
        <List className="h-4 w-4" />
      </Button>
      {/* Grid view button */}
      <Button
        variant="ghost"
        size="sm"
        // Active state styling when grid mode is selected
        className={`rounded-l-none border-l ${
          viewMode === "grid"
            ? "bg-gray-100 text-gray-900"
            : "text-gray-500 hover:text-gray-900"
        }`}
        onClick={() => onViewModeChange("grid")}
        aria-label="Grid view"
        aria-pressed={viewMode === "grid"}
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  );
}

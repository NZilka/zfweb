/**
 * ProductFilters - Filter controls for products list
 * Includes search input, status dropdown, and category dropdown
 */
"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import type { StatusFilter } from "./ProductsClient";
import type { CategoryType } from "~/app/admin/_components/ProductForm";

interface ProductFiltersProps {
  // Search query for title/SKU/description filtering
  searchQuery: string;
  onSearchChange: (value: string) => void;
  // Status filter dropdown
  statusFilter: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  // Category filter dropdown
  categoryFilter: number | "all";
  onCategoryChange: (value: number | "all") => void;
  // Available categories for dropdown
  categories: CategoryType[];
}

export function ProductFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  categoryFilter,
  onCategoryChange,
  categories,
}: ProductFiltersProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Search input with icon */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-white text-gray-900"
        />
      </div>

      {/* Filter dropdowns row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status filter dropdown */}
        <Select
          value={statusFilter}
          onValueChange={(value) => onStatusChange(value as StatusFilter)}
        >
          <SelectTrigger className="w-[140px] bg-white text-gray-900">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="sold_out">Sold Out</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
          </SelectContent>
        </Select>

        {/* Category filter dropdown */}
        <Select
          value={categoryFilter === "all" ? "all" : String(categoryFilter)}
          onValueChange={(value) =>
            onCategoryChange(value === "all" ? "all" : parseInt(value, 10))
          }
        >
          <SelectTrigger className="w-[160px] bg-white text-gray-900">
            <SelectValue placeholder="Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Extra filters button - placeholder for future advanced filtering */}
        <Button variant="outline" className="gap-2 bg-white text-gray-900">
          <SlidersHorizontal className="h-4 w-4" />
          Extra filters
        </Button>
      </div>
    </div>
  );
}

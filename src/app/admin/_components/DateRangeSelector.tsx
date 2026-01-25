/**
 * DateRangeSelector - Dropdown for selecting analytics date range
 * Triggers data refetch via URL params when selection changes
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { DateRangePreset } from "~/server/analytics-queries";

// Human-readable labels for date range presets
const DATE_RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
];

interface DateRangeSelectorProps {
  currentRange: DateRangePreset;
}

export function DateRangeSelector({ currentRange }: DateRangeSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Update URL with new date range to trigger server refetch
  const handleRangeChange = (value: DateRangePreset) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", value);
    router.push(`/admin?${params.toString()}`);
  };

  return (
    <Select value={currentRange} onValueChange={handleRangeChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select range" />
      </SelectTrigger>
      <SelectContent>
        {DATE_RANGE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

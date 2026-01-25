/**
 * DashboardClient - Client wrapper for dashboard interactivity
 * Handles date range selection with URL-based state
 */
"use client";

import { Suspense } from "react";
import { DateRangeSelector } from "./DateRangeSelector";
import type { DateRangePreset } from "~/server/analytics-queries";

interface DashboardClientProps {
  currentRange: DateRangePreset;
  children: React.ReactNode;
}

export function DashboardClient({ currentRange, children }: DashboardClientProps) {
  return (
    <div className="space-y-6">
      {/* Header with title and date range selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {/* Suspense needed for useSearchParams in DateRangeSelector */}
        <Suspense fallback={<div className="h-10 w-[180px] animate-pulse rounded bg-gray-200" />}>
          <DateRangeSelector currentRange={currentRange} />
        </Suspense>
      </div>
      {/* Dashboard content passed as children */}
      {children}
    </div>
  );
}

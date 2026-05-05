/**
 * OrdersClient - Client wrapper for orders tab with sub-tabs
 * Handles tab navigation via URL params and order selection
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { PackageX, Clock, PackageCheck, List, type LucideIcon } from "lucide-react";
import { CsvExportButton } from "./CsvExportButton";
import { OrdersTable } from "./OrdersTable";
import type { FulfillmentFilter, OrderWithItems } from "~/server/admin-queries";

interface OrderCounts {
  unshipped: number;
  inProcess: number;
  shipped: number;
  all: number;
}

interface OrdersClientProps {
  currentTab: FulfillmentFilter;
  counts: OrderCounts;
  orders: OrderWithItems[];
  // When true, test orders are included in the list and counts
  includeTest: boolean;
}

// Sub-tab configuration with labels, icons, and counts
const ORDER_TABS: {
  id: FulfillmentFilter;
  label: string;
  icon: LucideIcon;
  countKey: keyof OrderCounts;
}[] = [
  { id: "unshipped", label: "Unshipped", icon: PackageX, countKey: "unshipped" },
  { id: "in_process", label: "In Process", icon: Clock, countKey: "inProcess" },
  { id: "shipped", label: "Shipped", icon: PackageCheck, countKey: "shipped" },
  { id: "all", label: "All", icon: List, countKey: "all" },
];

function OrdersTabsContent({ currentTab, counts, orders, includeTest }: OrdersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Track selected order IDs for CSV export
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());

  // Navigate to tab by updating URL params (preserves includeTest param)
  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabId);
    // Clear selection when changing tabs
    setSelectedOrders(new Set());
    router.push(`/admin/orders?${params.toString()}`);
  };

  // Toggle "Show test orders" — flips the URL param and reloads via router
  const handleIncludeTestToggle = (checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (checked) params.set("includeTest", "true");
    else params.delete("includeTest");
    router.push(`/admin/orders?${params.toString()}`);
  };

  // Only show selection on unshipped tab
  const showSelection = currentTab === "unshipped";

  return (
    <div className="space-y-6">
      {/* Header with export button for unshipped tab */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Orders</h1>
        <div className="flex items-center gap-4">
          {/* "Show test orders" toggle — omitted when there are no test orders to care about
              would be nice to hide, but we don't know without another query; keep it always visible */}
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeTest}
              onChange={(e) => handleIncludeTestToggle(e.target.checked)}
              className="h-4 w-4"
            />
            <span>Show test orders</span>
          </label>
          {showSelection && (
            <CsvExportButton selectedOrderIds={Array.from(selectedOrders)} />
          )}
        </div>
      </div>

      {/* Sub-tabs for fulfillment status - horizontally scrollable on mobile */}
      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex h-auto gap-1 bg-muted p-1 min-w-max">
            {ORDER_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="gap-1.5 px-3 py-2 text-sm whitespace-nowrap"
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  {/* Badge showing count - hidden on mobile to save space */}
                  <Badge
                    variant="secondary"
                    className="ml-0.5 hidden sm:inline-flex text-xs px-1.5 py-0"
                  >
                    {counts[tab.countKey]}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
      </Tabs>

      {/* Orders table with selection for unshipped tab */}
      <OrdersTable
        orders={orders}
        showSelection={showSelection}
        selectedOrders={selectedOrders}
        onSelectionChange={setSelectedOrders}
      />
    </div>
  );
}

export function OrdersClient(props: OrdersClientProps) {
  return (
    <Suspense fallback={<div className="animate-pulse">Loading orders...</div>}>
      <OrdersTabsContent {...props} />
    </Suspense>
  );
}

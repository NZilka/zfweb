/**
 * OrdersClient - Client wrapper for orders tab with sub-tabs
 * Handles tab navigation via URL params and order selection
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
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
}

// Sub-tab configuration with labels and counts
const ORDER_TABS: { id: FulfillmentFilter; label: string; countKey: keyof OrderCounts }[] = [
  { id: "unshipped", label: "Unshipped", countKey: "unshipped" },
  { id: "in_process", label: "In Process", countKey: "inProcess" },
  { id: "shipped", label: "Shipped", countKey: "shipped" },
  { id: "all", label: "All Orders", countKey: "all" },
];

function OrdersTabsContent({ currentTab, counts, orders }: OrdersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Track selected order IDs for CSV export
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());

  // Navigate to tab by updating URL params
  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabId);
    // Clear selection when changing tabs
    setSelectedOrders(new Set());
    router.push(`/admin/orders?${params.toString()}`);
  };

  // Only show selection on unshipped tab
  const showSelection = currentTab === "unshipped";

  return (
    <div className="space-y-6">
      {/* Header with export button for unshipped tab */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Orders</h1>
        {showSelection && (
          <CsvExportButton selectedOrderIds={Array.from(selectedOrders)} />
        )}
      </div>

      {/* Sub-tabs for fulfillment status */}
      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4">
          {ORDER_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
              {tab.label}
              {/* Badge showing count for this status */}
              <Badge variant="secondary" className="ml-1 text-xs">
                {counts[tab.countKey]}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
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

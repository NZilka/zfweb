/**
 * OrdersClient - Client wrapper for orders tab with sub-tabs
 * Handles tab navigation via URL params
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import type { FulfillmentFilter } from "~/server/admin-queries";

interface OrderCounts {
  unshipped: number;
  inProcess: number;
  shipped: number;
  all: number;
}

interface OrdersClientProps {
  currentTab: FulfillmentFilter;
  counts: OrderCounts;
  children: React.ReactNode;
}

// Sub-tab configuration with labels and counts
const ORDER_TABS: { id: FulfillmentFilter; label: string; countKey: keyof OrderCounts }[] = [
  { id: "unshipped", label: "Unshipped", countKey: "unshipped" },
  { id: "in_process", label: "In Process", countKey: "inProcess" },
  { id: "shipped", label: "Shipped", countKey: "shipped" },
  { id: "all", label: "All Orders", countKey: "all" },
];

function OrdersTabsContent({ currentTab, counts, children }: OrdersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Navigate to tab by updating URL params
  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabId);
    router.push(`/admin/orders?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold">Orders</h1>

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

      {/* Orders content passed as children */}
      {children}
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

/**
 * Orders tab - Admin order management and fulfillment
 * Shows orders with sub-tabs for fulfillment workflow
 */
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { OrdersClient } from "./_components/OrdersClient";
import {
  getOrdersByFulfillmentStatus,
  getOrderCounts,
  type FulfillmentFilter,
} from "~/server/admin-queries";

// Force dynamic rendering for fresh order data
export const dynamic = "force-dynamic";

interface OrdersPageProps {
  searchParams: Promise<{ tab?: string; includeTest?: string }>;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  // Get current tab from URL params, default to unshipped
  const params = await searchParams;
  const tabParam = params.tab as FulfillmentFilter | undefined;
  const currentTab: FulfillmentFilter = tabParam ?? "unshipped";
  // Opt-in inclusion of test orders — defaults off so the default view matches real orders
  const includeTest = params.includeTest === "true";

  // Fetch orders for current tab and counts for all tabs (both respect includeTest)
  const [orders, counts] = await Promise.all([
    getOrdersByFulfillmentStatus(currentTab, includeTest),
    getOrderCounts(includeTest),
  ]);

  return (
    <main className="p-3 sm:p-4 md:p-6">
      <SignedOut>
        <div className="h-full w-full text-center text-2xl">Please sign in</div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto max-w-7xl">
          {/* OrdersClient handles tabs, selection, export, and table rendering */}
          <OrdersClient
            currentTab={currentTab}
            counts={counts}
            orders={orders}
            includeTest={includeTest}
          />
        </div>
      </SignedIn>
    </main>
  );
}

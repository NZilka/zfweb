/**
 * Dashboard tab - Admin analytics and overview
 * Shows key metrics, recent orders, and business insights
 */
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { DollarSign, ShoppingCart, Package, TrendingUp } from "lucide-react";
import { DashboardClient } from "./_components/DashboardClient";
import { MetricCard } from "./_components/MetricCard";
import { RecentOrders } from "./_components/RecentOrders";
import { RecentShipments } from "./_components/RecentShipments";
import {
  getSalesMetrics,
  getRecentOrders,
  getRecentShipments,
  getDateRangeFromPreset,
  type DateRangePreset,
} from "~/server/analytics-queries";

// Force dynamic rendering for fresh analytics data
export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<{ range?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  // Get date range from URL params, default to 30 days
  const params = await searchParams;
  const rangeParam = params.range as DateRangePreset | undefined;
  const currentRange: DateRangePreset = rangeParam ?? "30d";
  const { start, end } = getDateRangeFromPreset(currentRange);

  // Fetch all dashboard data in parallel
  const [metrics, recentOrders, recentShipments] = await Promise.all([
    getSalesMetrics(start, end),
    getRecentOrders(5),
    getRecentShipments(5),
  ]);

  // Format currency for display
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  return (
    <main className="p-6">
      <SignedOut>
        <div className="h-full w-full text-center text-2xl">Please sign in</div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto max-w-7xl">
          <DashboardClient currentRange={currentRange}>
            {/* Metrics grid - 4 cards across on desktop */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Revenue"
                value={formatCurrency(metrics.revenue)}
                icon={DollarSign}
                description={`From ${metrics.orderCount} orders`}
              />
              <MetricCard
                title="Orders"
                value={metrics.orderCount}
                icon={ShoppingCart}
                description="Total paid orders"
              />
              <MetricCard
                title="Units Sold"
                value={metrics.unitsSold}
                icon={Package}
                description="Total items sold"
              />
              <MetricCard
                title="Avg Order Value"
                value={formatCurrency(metrics.avgOrderValue)}
                icon={TrendingUp}
                description="Per order average"
              />
            </div>

            {/* Recent activity section - 2 columns on desktop */}
            <div className="grid gap-4 md:grid-cols-2">
              <RecentOrders orders={recentOrders} />
              <RecentShipments shipments={recentShipments} />
            </div>
          </DashboardClient>
        </div>
      </SignedIn>
    </main>
  );
}

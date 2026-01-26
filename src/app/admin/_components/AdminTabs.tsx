/**
 * AdminTabs - Tab navigation for admin dashboard sections
 * Uses URL-based routing with visual tab indicators
 */
"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";

// Tab configuration with route mappings
const ADMIN_TABS = [
  { id: "dashboard", label: "Dashboard", path: "/admin" },
  { id: "orders", label: "Orders", path: "/admin/orders" },
  { id: "products", label: "Products", path: "/admin/products" },
  { id: "discounts", label: "Discounts", path: "/admin/discounts" },
  { id: "shipping", label: "Shipping", path: "/admin/shipping" },
] as const;

export function AdminTabs() {
  const pathname = usePathname();
  const router = useRouter();

  // Determine active tab from current pathname
  // Default to dashboard if no match (handles /admin exact match)
  const getActiveTab = () => {
    // Check for exact matches first (except dashboard which is at /admin)
    for (const tab of ADMIN_TABS) {
      if (tab.path !== "/admin" && pathname.startsWith(tab.path)) {
        return tab.id;
      }
    }
    // Default to dashboard for /admin or unknown paths
    return "dashboard";
  };

  const activeTab = getActiveTab();

  // Navigate when tab changes
  const handleTabChange = (tabId: string) => {
    const tab = ADMIN_TABS.find((t) => t.id === tabId);
    if (tab) {
      router.push(tab.path);
    }
  };

  return (
    // Tab bar with dark background, scrollable tabs on mobile
    // min-w-0 prevents flexbox/grid implicit minimum width overflow
    <div className="border-b border-gray-700 bg-gray-900 min-w-0">
      <div className="overflow-x-auto min-w-0">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="h-auto gap-0.5 sm:gap-2 bg-transparent p-0 px-2 sm:px-4 inline-flex">
            {ADMIN_TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                // White text on dark background, bold when active, smaller padding on mobile
                className="rounded-none border-b-2 border-transparent px-2 py-2 sm:px-4 sm:py-3 text-sm sm:text-base text-white data-[state=active]:border-white data-[state=active]:font-bold data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-white whitespace-nowrap"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}

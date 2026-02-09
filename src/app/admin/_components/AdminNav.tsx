/**
 * AdminNav - Overlay drawer navigation for admin dashboard
 *
 * Behavior:
 * - All sizes: Always starts closed, opened via hamburger toggle
 * - Black bg + neutral colors matching shop mobile drawer style
 * - Closes after every navigation (no persistent open on desktop)
 *
 * Uses iOS-style active states: thicker stroke + bold when active
 */
"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Tag,
  Truck,
  FileText,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { useAdminNav } from "./AdminNavContext";

// Nav item configuration with icons mapped to each route
interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { id: "orders", label: "Orders", path: "/admin/orders", icon: ShoppingCart },
  { id: "products", label: "Products", path: "/admin/products", icon: Package },
  { id: "discounts", label: "Discounts", path: "/admin/discounts", icon: Tag },
  { id: "shipping", label: "Shipping", path: "/admin/shipping", icon: Truck },
  // About page editor — between Shipping and Settings
  { id: "about", label: "About", path: "/admin/about", icon: FileText },
  { id: "settings", label: "Settings", path: "/admin/settings", icon: Settings },
];

// Determine active nav item from pathname
function getActiveNavId(pathname: string) {
  // Check specific routes first (not dashboard)
  for (const item of NAV_ITEMS) {
    if (item.path !== "/admin" && pathname.startsWith(item.path)) {
      return item.id;
    }
  }
  // Default to dashboard for /admin or unknown paths
  return "dashboard";
}

// Individual nav item button with icon + label
function NavItemButton({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        // Horizontal layout with gap
        "flex w-full items-center gap-3 px-4 py-3",
        "rounded-lg transition-colors duration-150",
        // Active: subtle neutral highlight + white text + bold (matches shop drawer)
        isActive
          ? "bg-neutral-800 text-white font-semibold"
          : "text-neutral-300 hover:bg-neutral-800/50 hover:text-white"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon
        className={cn(
          "h-5 w-5 flex-shrink-0",
          // iOS-style: thicker stroke when active
          isActive ? "stroke-[2.5]" : "stroke-[1.5]"
        )}
      />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

// Main AdminNav export - overlay drawer sidebar
export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { isOpen, close } = useAdminNav();

  const activeId = getActiveNavId(pathname);

  // Navigate and close drawer after selection (always hamburger-controlled)
  const handleNavigate = (path: string) => {
    router.push(path);
    close();
  };

  return (
    <>
      {/* Backdrop overlay — visible on all sizes when drawer is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar drawer */}
      <nav
        className={cn(
          // Fixed position, full height below header
          "fixed top-0 left-0 z-50 h-full",
          // Width
          "w-64",
          // Styling — black bg matching shop mobile drawer
          "border-r border-neutral-700 bg-black",
          // Slide in/out animation
          "transition-transform duration-300 ease-in-out",
          // Transform based on open state
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header with close button — uppercase tracking to match shop drawer */}
        <div className="flex h-14 items-center justify-between border-b border-neutral-700 px-4">
          <span className="text-sm font-medium uppercase tracking-widest text-white">Menu</span>
          <button
            onClick={close}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav items */}
        <div className="flex flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => (
            <NavItemButton
              key={item.id}
              item={item}
              isActive={activeId === item.id}
              onClick={() => handleNavigate(item.path)}
            />
          ))}
        </div>
      </nav>
    </>
  );
}

// Export nav items for potential use elsewhere
export { NAV_ITEMS };

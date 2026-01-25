# Lesson: Admin Layout with Tab Navigation

## What We Built
Restructured the admin section from a single-page product manager into a tabbed interface with Dashboard, Orders, Products, and Discounts tabs.

## Why This Approach

**URL-based navigation:** Each tab is a separate route (`/admin`, `/admin/orders`, `/admin/products`, `/admin/discounts`). This allows:
- Direct linking to specific sections
- Browser back/forward navigation works naturally
- Each page can have its own data fetching

**Client component for tabs:** The tab component reads `usePathname()` to highlight the active tab and uses `useRouter()` for navigation.

## Key Concepts

- **Next.js App Router structure**: Each tab is a folder with a `page.tsx`
- **Layout inheritance**: `layout.tsx` in `/admin` wraps all admin pages
- **Pathname-based active state**: Compare current URL to tab routes

## Code Walkthrough

```
src/app/admin/
  layout.tsx          # Contains AdminTabs component
  page.tsx            # Dashboard tab (default route)
  orders/page.tsx     # Orders tab
  products/page.tsx   # Products tab
  discounts/page.tsx  # Discounts tab
```

**AdminTabs component:**
```tsx
// src/app/admin/_components/AdminTabs.tsx
"use client";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";

const tabs = [
  { value: "dashboard", label: "Dashboard", href: "/admin" },
  { value: "orders", label: "Orders", href: "/admin/orders" },
  { value: "products", label: "Products", href: "/admin/products" },
  { value: "discounts", label: "Discounts", href: "/admin/discounts" },
];

export function AdminTabs() {
  const pathname = usePathname();
  const router = useRouter();

  // Determine active tab from pathname
  const activeTab = tabs.find(t =>
    t.href === pathname || pathname.startsWith(t.href + "/")
  )?.value ?? "dashboard";

  return (
    <Tabs value={activeTab} onValueChange={(v) => {
      const tab = tabs.find(t => t.value === v);
      if (tab) router.push(tab.href);
    }}>
      <TabsList>
        {tabs.map(tab => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
```

## Testing Strategy
Navigation is tested manually by clicking tabs and verifying URL changes. The tab component could be unit tested by mocking Next.js router hooks.

## What You Learned
- How to structure multi-section admin areas in Next.js
- URL-based state management for navigation
- The pattern of client components for interactive navigation in server-rendered apps

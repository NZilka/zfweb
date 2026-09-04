import { TopNav } from "./_components/topnav";
import { CartProvider } from "~/app/_context/CartContext";
import { CartDrawer } from "~/components/ui/CartDrawer";
import { CartMergeModal } from "./_components/CartMergeModal";

// Every shop route renders on demand. TopNav reads site settings and
// categories, so any statically prerendered child (e.g. /shop/cart, a client
// page with no segment config of its own) would query the database during
// `next build`, which fails in CI where no database exists. Phase 3 of
// docs/LAUNCH_PLAN.md replaces this with cache tags.
export const dynamic = "force-dynamic";

// Shop layout wraps all shop pages with CartProvider for cart state
// Uses parallel routes for product modals - modal slot renders product overlays
// Includes CartDrawer which renders when cart is opened
// Includes CartMergeModal for handling cart conflicts on login
export default function ShopLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  return (
    <CartProvider>
      {/* Shop-wide fonts: Work Sans body, Buenard headings via CSS below */}
      <div className="grid h-screen grid-rows-[auto_1fr] font-[family-name:var(--font-body)]">
        <TopNav />
        <main className="overflow-y-scroll">{children}</main>
      </div>
      {/* Product modal - renders when navigating to product from shop */}
      {modal}
      {/* Portal target for modal rendering */}
      <div id="modal-root" />
      {/* Cart drawer - renders when isOpen is true */}
      <CartDrawer />
      {/* Cart merge modal - shown when user has conflicting carts */}
      <CartMergeModal />
    </CartProvider>
  );
}

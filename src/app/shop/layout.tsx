import { TopNav } from "./_components/topnav";
import { CartProvider } from "~/app/_context/CartContext";
import { CartDrawer } from "~/components/ui/CartDrawer";
import { CartMergeModal } from "./_components/CartMergeModal";

// Shop layout wraps all shop pages with CartProvider for cart state
// Includes CartDrawer which renders when cart is opened
// Includes CartMergeModal for handling cart conflicts on login
export default function ShopLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <CartProvider>
      <div className="grid h-screen grid-rows-[auto_1fr]">
        <TopNav />
        <main className="overflow-y-scroll">{children}</main>
      </div>
      {/* Cart drawer - renders when isOpen is true */}
      <CartDrawer />
      {/* Cart merge modal - shown when user has conflicting carts */}
      <CartMergeModal />
    </CartProvider>
  );
}

import { TopNav } from "./_components/topnav";
import { CartProvider } from "~/app/_context/CartContext";
import { CartDrawer } from "~/components/ui/CartDrawer";

// Shop layout wraps all shop pages with CartProvider for cart state
// Includes CartDrawer which renders when cart is opened
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
    </CartProvider>
  );
}

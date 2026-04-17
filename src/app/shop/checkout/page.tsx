import { redirect } from "next/navigation";
import { getCartItems, getCartSummary } from "~/server/cart-actions";
import { getSiteSettings } from "~/server/kv";
import { env } from "~/env";
import CheckoutForm from "./CheckoutForm";
import Image from "next/image";
import Link from "next/link";
import { ScrollToTop } from "~/components/ui/ScrollToTop";
// Client component for PostHog checkout tracking
import { CheckoutTracker } from "./CheckoutTracker";

export const dynamic = "force-dynamic";

// Checkout page - displays order summary and checkout form
// Redirects to cart if cart is empty
export default async function CheckoutPage() {
  const [items, summary, settings] = await Promise.all([
    getCartItems(),
    getCartSummary(),
    getSiteSettings(),
  ]);

  // Redirect to cart if empty
  if (items.length === 0) {
    redirect("/shop/cart");
  }

  // Test mode is active only when both gates pass:
  // - env var set (staging/dev)
  // - admin has flipped the runtime toggle in /admin/settings
  // When active, the checkout form bypasses Stripe entirely.
  const testModeActive = env.TEST_MODE_ALLOWED && settings.testMode.enabled;

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      {/* Scroll to top when page loads */}
      <ScrollToTop />
      {/* Track checkout started event for analytics */}
      <CheckoutTracker cartValue={parseFloat(summary.total)} />
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/shop/cart"
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to Cart
        </Link>
        {/* Buenard heading font */}
        <h1 className="text-3xl font-bold font-[family-name:var(--font-heading)]">Checkout</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Checkout form - pass subtotal for discount calculation display.
            When testModeActive, the form bypasses Stripe Elements entirely. */}
        <div>
          <CheckoutForm
            subtotal={parseFloat(summary.total)}
            testModeActive={testModeActive}
            testModeOutcome={settings.testMode.outcome}
          />
        </div>

        {/* Order summary */}
        <div className="lg:order-last">
          <div className="sticky top-4 rounded-lg border bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800">
            {/* Heading font for section title */}
            <h2 className="mb-4 text-xl font-semibold font-[family-name:var(--font-heading)] text-gray-900 dark:text-gray-100">Order Summary</h2>

            {/* Cart items (readonly) */}
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  {/* Product thumbnail */}
                  <div className="h-12 w-12 flex-shrink-0">
                    {item.product.imgUrl[0] ? (
                      <Image
                        src={item.product.imgUrl[0]}
                        alt={item.product.title}
                        width={48}
                        height={48}
                        className="h-full w-full rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded bg-gray-200 text-xs text-gray-400">
                        No Img
                      </div>
                    )}
                  </div>

                  {/* Product info */}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.product.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Qty: {item.quantity}</p>
                  </div>

                  {/* Line total */}
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    ${(parseFloat(item.product.price) * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            {/* Totals - explicit text colors for light/dark mode */}
            <div className="mt-4 space-y-2 border-t pt-4 dark:border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                <span className="text-gray-900 dark:text-gray-100">${summary.total}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Shipping</span>
                <span className="text-gray-900 dark:text-gray-100">Free</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-lg font-semibold dark:border-gray-700">
                <span className="text-gray-900 dark:text-gray-100">Total</span>
                <span className="text-gray-900 dark:text-gray-100">${summary.total}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

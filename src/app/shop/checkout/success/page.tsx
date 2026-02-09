import { redirect } from "next/navigation";
import { getOrderByPaymentIntent } from "~/server/order-actions";
import { syncPaymentStateByPaymentIntent } from "~/server/stripe-sync";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { OrderPolling } from "./OrderPolling";

// This page is the return_url from Stripe after successful payment
// It looks up the order by payment_intent and redirects to order confirmation
// Per stripe-recommendations: eagerly sync state here before webhooks arrive
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ payment_intent?: string; redirect_status?: string }>;
}) {
  const params = await searchParams;
  const { payment_intent, redirect_status } = params;

  // Eager sync: Update KV state immediately when user returns from Stripe
  // This prevents race conditions where user returns before webhook arrives
  // The sync function handles the case where KV isn't configured
  if (payment_intent) {
    await syncPaymentStateByPaymentIntent(payment_intent).catch((err) => {
      // Log but don't block - webhook will sync eventually
      console.error("[CheckoutSuccess] Eager sync failed:", err.message);
    });
  }

  // Check if payment was successful
  if (redirect_status !== "succeeded") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)] text-red-600">Payment Failed</h1>
        <p className="text-gray-600">
          Your payment was not successful. Please try again.
        </p>
        <Link href="/shop/checkout">
          <Button>Return to Checkout</Button>
        </Link>
      </div>
    );
  }

  // Look up order by payment intent
  if (!payment_intent) {
    redirect("/shop");
  }

  // Try to find the order - it may take a moment for webhook to create it
  const order = await getOrderByPaymentIntent(payment_intent);

  // If order not found yet, show processing message
  // The webhook creates the order asynchronously
  if (!order) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-black" />
        <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">Processing Your Order</h1>
        <p className="text-gray-600">
          Please wait while we confirm your payment...
        </p>
        <p className="text-sm text-gray-500">
          This page will automatically redirect when your order is ready.
        </p>
        {/* Client component handles polling for order creation */}
        <OrderPolling />
      </div>
    );
  }

  // Redirect to order confirmation page using payment_intent (secure, unpredictable)
  redirect(`/shop/order/confirmation/${payment_intent}`);
}

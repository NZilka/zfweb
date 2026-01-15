import { redirect } from "next/navigation";
import { getOrderByPaymentIntent } from "~/server/order-actions";
import Link from "next/link";
import { Button } from "~/components/ui/button";

// This page is the return_url from Stripe after successful payment
// It looks up the order by payment_intent and redirects to order confirmation
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ payment_intent?: string; redirect_status?: string }>;
}) {
  const params = await searchParams;
  const { payment_intent, redirect_status } = params;

  // Check if payment was successful
  if (redirect_status !== "succeeded") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-bold text-red-600">Payment Failed</h1>
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
  // In production, you might want to poll or use a loading state
  let order = await getOrderByPaymentIntent(payment_intent);

  // If order not found yet, show processing message
  // The webhook creates the order asynchronously
  if (!order) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-black" />
        <h1 className="text-2xl font-bold">Processing Your Order</h1>
        <p className="text-gray-600">
          Please wait while we confirm your payment...
        </p>
        <p className="text-sm text-gray-500">
          This page will automatically redirect when your order is ready.
        </p>
        {/* Auto-refresh to check for order */}
        <meta httpEquiv="refresh" content="3" />
      </div>
    );
  }

  // Redirect to order confirmation page
  redirect(`/shop/order/${order.id}`);
}

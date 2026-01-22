import { notFound } from "next/navigation";
import { getOrderByPaymentIntent } from "~/server/order-actions";
import Image from "next/image";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { CheckCircle } from "lucide-react";
import { PrintButton } from "../../[id]/PrintButton";
import { CreateAccountPrompt } from "./CreateAccountPrompt";

export const dynamic = "force-dynamic";

// Secure order confirmation page - uses payment_intent_id instead of order ID
// This prevents IDOR attacks since payment_intent is unpredictable
export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ payment_intent: string }>;
}) {
  const { payment_intent } = await params;

  // Look up order by payment intent (secure, unpredictable identifier)
  const order = await getOrderByPaymentIntent(payment_intent);

  if (!order) {
    notFound();
  }

  // Parse shipping address
  const shippingAddress = order.shippingAddress as {
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      {/* Success header */}
      <div className="mb-8 text-center">
        <div className="mb-4 flex justify-center">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>
        <h1 className="text-3xl font-bold">Thank You for Your Order!</h1>
        <p className="mt-2 text-gray-600">
          Order #{order.id} has been placed successfully.
        </p>
        <p className="text-sm text-gray-500">
          A confirmation email has been sent to {order.customer_email}
        </p>
      </div>

      {/* Account creation prompt for guest users */}
      <CreateAccountPrompt customerEmail={order.customer_email} />

      {/* Order details card */}
      <div className="mb-8 rounded-lg border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-4 text-xl font-semibold">Order Details</h2>

        {/* Order info */}
        <div className="mb-6 grid gap-4 border-b pb-4 sm:grid-cols-2 dark:border-gray-700">
          <div>
            <p className="text-sm text-gray-500">Order Number</p>
            <p className="font-medium">#{order.id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Order Date</p>
            <p className="font-medium">
              {new Date(order.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <p className="font-medium capitalize text-green-600">{order.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total</p>
            <p className="font-medium">${order.total}</p>
          </div>
        </div>

        {/* Shipping address */}
        <div className="mb-6 border-b pb-4 dark:border-gray-700">
          <h3 className="mb-2 font-semibold">Shipping Address</h3>
          <p className="text-gray-600 dark:text-gray-400">
            {order.customer_name}
            <br />
            {shippingAddress.address1}
            {shippingAddress.address2 && (
              <>
                <br />
                {shippingAddress.address2}
              </>
            )}
            <br />
            {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zipCode}
            <br />
            {shippingAddress.country}
          </p>
        </div>

        {/* Order items */}
        <div>
          <h3 className="mb-4 font-semibold">Items Ordered</h3>
          <div className="space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-4">
                {/* Product image */}
                <div className="h-16 w-16 flex-shrink-0">
                  {item.product.imgUrl[0] ? (
                    <Image
                      src={item.product.imgUrl[0]}
                      alt={item.product.title}
                      width={64}
                      height={64}
                      className="h-full w-full rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded bg-gray-200 text-xs text-gray-400">
                      No Img
                    </div>
                  )}
                </div>

                {/* Product details */}
                <div className="flex-1">
                  <p className="font-medium">{item.product.title}</p>
                  <p className="text-sm text-gray-500">
                    Qty: {item.quantity} × ${item.product.price}
                  </p>
                </div>

                {/* Line total */}
                <p className="font-medium">
                  ${(parseFloat(item.product.price) * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          {/* Order total */}
          <div className="mt-4 flex justify-between border-t pt-4 text-lg font-semibold dark:border-gray-700">
            <span>Total</span>
            <span>${order.total}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <Link href="/shop">
          {/* Primary action with visible border for definition */}
          <Button className="border border-primary">Continue Shopping</Button>
        </Link>
        <PrintButton />
      </div>
    </div>
  );
}

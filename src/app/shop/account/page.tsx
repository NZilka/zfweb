import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getOrdersByEmail,
  getCustomerByClerkId,
  linkGuestOrdersToUser,
} from "~/server/queries";
import { getPaymentStateCache, isKvConfigured } from "~/server/kv";
import { Button } from "~/components/ui/button";

// Force dynamic rendering to always fetch fresh data
export const dynamic = "force-dynamic";

// Customer account page - displays order history and saved payment info
// Protected by Clerk authentication - redirects to sign-in if not authenticated
export default async function AccountPage() {
  // Get current authenticated user from Clerk
  const user = await currentUser();

  // Redirect to sign-in if not authenticated
  if (!user) {
    redirect("/sign-in");
  }

  // Get primary email from Clerk user
  const email = user.emailAddresses[0]?.emailAddress;
  if (!email) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-8">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">No Email Found</h1>
        <p className="text-gray-600">Please add an email to your account.</p>
      </div>
    );
  }

  // Link any guest orders to this user account (runs on first visit)
  // This connects orders made before account creation to the user
  await linkGuestOrdersToUser(user.id, email);

  // Fetch orders for this user's email
  const orders = await getOrdersByEmail(email);

  // Try to get customer record and payment info from KV
  const customer = await getCustomerByClerkId(user.id);
  let paymentInfo = null;

  // If customer has Stripe ID and KV is configured, fetch cached payment state
  if (customer?.stripe_customer_id && isKvConfigured()) {
    try {
      paymentInfo = await getPaymentStateCache(customer.stripe_customer_id);
    } catch {
      // KV error - continue without payment info
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Account header */}
      <div className="mb-8">
        {/* Cormorant Garamond heading font */}
        <h1 className="text-3xl font-bold font-[family-name:var(--font-heading)]">My Account</h1>
        <p className="text-gray-600">{email}</p>
      </div>

      {/* Saved payment method section */}
      {paymentInfo?.paymentMethod && (
        <div className="mb-8 rounded-lg border p-6">
          <h2 className="mb-4 text-xl font-semibold font-[family-name:var(--font-heading)]">Saved Payment Method</h2>
          <div className="flex items-center gap-3">
            <div className="rounded bg-gray-100 px-3 py-2 font-mono">
              {paymentInfo.paymentMethod.brand?.toUpperCase()} ****
              {paymentInfo.paymentMethod.last4}
            </div>
          </div>
        </div>
      )}

      {/* Order history section */}
      <div className="rounded-lg border p-6">
        <h2 className="mb-4 text-xl font-semibold font-[family-name:var(--font-heading)]">Order History</h2>

        {orders.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-gray-600">No orders yet.</p>
            <Link href="/shop">
              <Button className="mt-4">Start Shopping</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/shop/order/confirmation/${order.payment_intent_id}`}
                className="block rounded-lg border p-4 transition-colors hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Order #{order.id}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(order.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${order.total}</p>
                    <p
                      className={`text-sm ${
                        order.status === "paid"
                          ? "text-green-600"
                          : order.status === "pending"
                            ? "text-yellow-600"
                            : "text-gray-600"
                      }`}
                    >
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

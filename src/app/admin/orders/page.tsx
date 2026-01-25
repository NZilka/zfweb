/**
 * Orders tab - Admin order management and fulfillment
 * Placeholder for order list with fulfillment workflow
 */
import { SignedIn, SignedOut } from "@clerk/nextjs";

// Force dynamic rendering for fresh order data
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  return (
    <main className="p-6">
      <SignedOut>
        <div className="h-full w-full text-center text-2xl">Please sign in</div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto max-w-7xl">
          <h1 className="mb-6 text-2xl font-bold">Orders</h1>
          {/* TODO: Add OrdersClient component with sub-tabs */}
          <div className="rounded-lg border bg-gray-50 p-8 text-center dark:border-gray-800 dark:bg-gray-900">
            <p className="text-gray-500">Order management coming soon</p>
            <p className="mt-2 text-sm text-gray-400">
              Sub-tabs: Unshipped, In Process, Shipped, All Orders
            </p>
          </div>
        </div>
      </SignedIn>
    </main>
  );
}

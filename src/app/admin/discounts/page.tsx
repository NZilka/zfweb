/**
 * Discounts tab - Admin discount code management
 * Placeholder for discount CRUD operations
 */
import { SignedIn, SignedOut } from "@clerk/nextjs";

// Force dynamic rendering for fresh discount data
export const dynamic = "force-dynamic";

export default async function DiscountsPage() {
  return (
    <main className="p-6">
      <SignedOut>
        <div className="h-full w-full text-center text-2xl">Please sign in</div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto max-w-7xl">
          <h1 className="mb-6 text-2xl font-bold">Discounts</h1>
          {/* TODO: Add DiscountsClient component with CRUD */}
          <div className="rounded-lg border bg-gray-50 p-8 text-center dark:border-gray-800 dark:bg-gray-900">
            <p className="text-gray-500">Discount code management coming soon</p>
            <p className="mt-2 text-sm text-gray-400">
              Create and manage discount codes with expiration and usage limits
            </p>
          </div>
        </div>
      </SignedIn>
    </main>
  );
}

/**
 * Discounts tab - Admin discount code management
 * Full CRUD interface for discount codes
 */
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { DiscountsClient } from "./_components/DiscountsClient";
import { getDiscounts } from "~/server/discount-actions";

// Force dynamic rendering for fresh discount data
export const dynamic = "force-dynamic";

export default async function DiscountsPage() {
  // Fetch all discounts for the table
  const discounts = await getDiscounts();

  return (
    <main className="p-6">
      <SignedOut>
        <div className="h-full w-full text-center text-2xl">Please sign in</div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto max-w-7xl">
          <DiscountsClient discounts={discounts} />
        </div>
      </SignedIn>
    </main>
  );
}

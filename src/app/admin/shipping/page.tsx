/**
 * Shipping tab - Admin shipping zone and rate management
 * Full CRUD interface for shipping configuration
 */
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { ShippingClient } from "./_components/ShippingClient";
import { getShippingZones } from "~/server/shipping-actions";

// Force dynamic rendering for fresh shipping data
export const dynamic = "force-dynamic";

export default async function ShippingPage() {
  // Fetch all shipping zones with their rates
  const zones = await getShippingZones();

  return (
    <main className="p-3 sm:p-4 md:p-6">
      <SignedOut>
        <div className="h-full w-full text-center text-2xl">Please sign in</div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto max-w-7xl">
          <ShippingClient zones={zones} />
        </div>
      </SignedIn>
    </main>
  );
}

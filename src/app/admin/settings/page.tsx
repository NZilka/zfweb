/**
 * Admin Settings Page
 * Server component that fetches settings, products, and renders the client form
 */
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { SettingsClient } from "./_components/SettingsClient";
import { getSettings, checkSettingsAvailable } from "~/server/settings-actions";
import { getProducts } from "~/server/queries";
import { env } from "~/env";

// Force dynamic to always fetch fresh settings
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // Fetch settings, availability, and products in parallel
  // Products are needed for the carousel image picker
  const [settings, isAvailable, products] = await Promise.all([
    getSettings(),
    checkSettingsAvailable(),
    getProducts(),
  ]);

  // Extract product images for the carousel cell picker
  const productImages = products
    .filter((p) => p.imgUrl.length > 0)
    .flatMap((p) => p.imgUrl.map((url) => ({ url, alt: p.title })));

  return (
    <main className="p-3 sm:p-4 md:p-6">
      <SignedOut>
        <div className="h-full w-full text-center text-2xl">Please sign in</div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto max-w-7xl">
          <SettingsClient
            initialSettings={settings}
            kvAvailable={isAvailable}
            productImages={productImages}
            testModeAllowed={env.TEST_MODE_ALLOWED}
          />
        </div>
      </SignedIn>
    </main>
  );
}

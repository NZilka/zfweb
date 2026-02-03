/**
 * Admin Settings Page
 * Server component that fetches settings and renders the client form
 */
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { SettingsClient } from "./_components/SettingsClient";
import { getSettings, checkSettingsAvailable } from "~/server/settings-actions";

// Force dynamic to always fetch fresh settings
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, isAvailable] = await Promise.all([
    getSettings(),
    checkSettingsAvailable(),
  ]);

  return (
    <main className="p-3 sm:p-4 md:p-6">
      <SignedOut>
        <div className="h-full w-full text-center text-2xl">Please sign in</div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto max-w-7xl">
          <SettingsClient initialSettings={settings} kvAvailable={isAvailable} />
        </div>
      </SignedIn>
    </main>
  );
}

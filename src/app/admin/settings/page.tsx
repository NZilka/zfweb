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
    <>
      <SignedIn>
        <div className="p-4 sm:p-6">
          <SettingsClient initialSettings={settings} kvAvailable={isAvailable} />
        </div>
      </SignedIn>
      <SignedOut>
        <div className="flex h-full items-center justify-center">
          <p className="text-gray-500">Please sign in to access settings.</p>
        </div>
      </SignedOut>
    </>
  );
}

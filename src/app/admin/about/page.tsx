/**
 * Admin About Page
 * Server component that fetches current about settings and renders the editor
 */
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { AboutClient } from "./_components/AboutClient";
import { getSettings, checkSettingsAvailable } from "~/server/settings-actions";

// Force dynamic to always fetch fresh settings
export const dynamic = "force-dynamic";

export default async function AboutPage() {
  // Fetch settings and KV availability in parallel
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
        <div className="mx-auto max-w-4xl">
          <AboutClient
            initialAbout={settings.about}
            kvAvailable={isAvailable}
          />
        </div>
      </SignedIn>
    </main>
  );
}

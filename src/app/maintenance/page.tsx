/**
 * Maintenance Page
 * Displayed when site is in maintenance mode
 * Shows the configured message and optional image
 * Redirects to /shop if maintenance mode is disabled
 */
import { redirect } from "next/navigation";
import Image from "next/image";
import { Wrench } from "lucide-react";
import { getSiteSettings } from "~/server/kv";

// Force dynamic to always check current maintenance status
export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  // Get current site settings from KV store
  const settings = await getSiteSettings();

  // If maintenance mode is off, redirect to shop
  // This prevents direct access to /maintenance when not needed
  if (!settings.maintenanceMode.enabled) {
    redirect("/shop");
  }

  const { message, imageUrl } = settings.maintenanceMode;

  return (
    // Full viewport centered layout
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      {/* Content container with max width for readability */}
      <div className="w-full max-w-md space-y-6 text-center sm:max-w-lg">
        {/* Icon indicator */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 sm:h-20 sm:w-20">
          <Wrench className="h-8 w-8 text-orange-600 sm:h-10 sm:w-10" />
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Under Maintenance
        </h1>

        {/* Optional maintenance image */}
        {imageUrl && (
          <div className="mx-auto overflow-hidden rounded-lg">
            <Image
              src={imageUrl}
              alt="Maintenance"
              width={400}
              height={300}
              className="h-auto w-full object-cover"
              priority
            />
          </div>
        )}

        {/* Maintenance message from settings */}
        {message && (
          <p className="text-base text-gray-600 sm:text-lg">{message}</p>
        )}

        {/* Fallback message if somehow no message is set */}
        {!message && (
          <p className="text-base text-gray-600 sm:text-lg">
            We&apos;re currently performing scheduled maintenance. Please check
            back soon!
          </p>
        )}
      </div>
    </div>
  );
}

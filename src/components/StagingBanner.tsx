import { isStaging } from "~/lib/env-info";

// Yellow bar rendered site-wide (root layout) on the dedicated staging branch
// deploy. Visibility is intentional — prevents admins from mistaking staging
// data for production. No-op (returns null) on prod and local dev.
export function StagingBanner() {
  if (!isStaging) return null;

  return (
    <div className="bg-yellow-400 px-4 py-2 text-center text-sm font-semibold text-yellow-950">
      STAGING ENVIRONMENT — Data is not real, Stripe is in test mode
    </div>
  );
}

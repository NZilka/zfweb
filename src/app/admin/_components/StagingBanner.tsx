import { isStaging } from "~/lib/env-info";

// Yellow bar rendered at the top of the admin layout when running on the
// dedicated staging branch. Visibility is intentional — prevents admins from
// mistaking staging data for production.
export function StagingBanner() {
  if (!isStaging) return null;

  return (
    <div className="bg-yellow-400 px-4 py-2 text-center text-sm font-semibold text-yellow-950">
      STAGING ENVIRONMENT — Data is not real, Stripe is in test mode
    </div>
  );
}

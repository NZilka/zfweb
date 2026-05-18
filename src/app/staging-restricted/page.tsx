// Landing page for users who pass Clerk sign-in on staging but lack admin
// metadata (privateMetadata["can-upload"] !== true). The proxy.ts staging
// gate redirects non-admins here so they don't see the actual app.
import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";

export default function StagingRestrictedPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-semibold">Staging environment</h1>
      <p className="max-w-md text-sm text-neutral-600">
        This deploy is restricted to administrators. If you reached this page
        by mistake, sign out and visit{" "}
        <Link href="https://zilkaforgewerks.com" className="underline">
          the production site
        </Link>{" "}
        instead.
      </p>
      {/* SignOutButton is a Clerk client component; wraps its children with the sign-out handler. */}
      <SignOutButton>
        <button
          type="button"
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
        >
          Sign out
        </button>
      </SignOutButton>
    </main>
  );
}

"use client";

import { useEffect } from "react";

// Route-level error boundary. Catches errors thrown during render of any
// nested route segment. Two display modes:
//   - production: show only the digest (matches Next's default behavior of
//     hiding sensitive details). Digest can be searched in Vercel logs to
//     find the original error.
//   - any non-production env (local dev, staging preview, feature previews):
//     also show the message + stack inline so QA can diagnose without
//     leaving the browser tab.
//
// process.env.NEXT_PUBLIC_VERCEL_ENV is auto-injected by Vercel at build
// time ("production" on prod, "preview" elsewhere). It's inlined into the
// client bundle, so this check works without a runtime fetch.
const showDetails =
  process.env.NEXT_PUBLIC_VERCEL_ENV !== "production";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server logs already capture this; client log helps when debugging
    // from devtools on a non-prod deploy.
    console.error("RouteError boundary:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h2 className="mb-2 text-xl font-semibold">Something went wrong</h2>
      {error.digest && (
        <p className="mb-4 text-sm text-neutral-500">
          Error digest: <code className="font-mono break-all">{error.digest}</code>
        </p>
      )}
      {showDetails && (
        <pre className="mb-4 overflow-auto rounded bg-red-50 p-3 text-xs text-red-900 max-h-96">
          {error.message}
          {error.stack ? "\n\n" + error.stack : ""}
        </pre>
      )}
      <button
        onClick={reset}
        className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-50"
        type="button"
      >
        Try again
      </button>
    </div>
  );
}

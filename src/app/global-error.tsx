"use client";

import { useEffect } from "react";

// Last-resort error boundary that fires when the root layout itself errors
// during render. Must render <html><body> because it replaces the root
// layout entirely (Next.js docs).
//
// Same staging gate as src/app/error.tsx — see that file for the rationale.
const showDetails =
  process.env.NEXT_PUBLIC_VERCEL_ENV !== "production";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("GlobalError boundary:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-2xl p-4 sm:p-6">
          <h2 className="mb-2 text-xl font-semibold">Application error</h2>
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
      </body>
    </html>
  );
}

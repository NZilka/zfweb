/**
 * Proxy/Middleware for authentication, staging access gate, and maintenance mode.
 *
 * Order of checks per request:
 *   1. Staging admin gate (only on the staging branch deploy) — redirects
 *      unauth to Clerk sign-in, non-admin to /staging-restricted.
 *   2. Maintenance mode (when enabled in KV) — redirects non-admin shop traffic
 *      to /maintenance.
 *
 * Every response on the staging deploy also gets an X-Robots-Tag: noindex
 * header as defense in depth against the URL being indexed if the gate
 * ever has a bug or leaks.
 */
import { clerkMiddleware, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStaging } from "~/lib/env-info";
// Use middleware-safe KV utility (no server-only directive)
import { getMaintenanceSettings } from "~/server/kv-middleware";

// Paths exempt from the staging admin gate.
// - Sign-in / sign-up flows must be reachable while unauthenticated, otherwise
//   the user can't log in to satisfy the gate.
// - Clerk callback endpoints (/api/clerk/*) carry their own auth.
// - Stripe webhook accepts unauth POSTs; signature verification is its auth.
// - /staging-restricted is the landing page for non-admins.
// Exported so the unit test can verify the allowlist without booting middleware.
export function isStagingAllowlisted(pathname: string): boolean {
  return (
    pathname === "/staging-restricted" ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/api/clerk") ||
    pathname === "/api/stripe/webhook"
  );
}

// Attach X-Robots-Tag on every staging response so search engines don't
// index staging even if the gate ever fails or the URL leaks.
function withStagingHeaders(res: Response): Response {
  if (isStaging) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
}

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // === Staging admin gate ===
  // Only fires on the dedicated `staging` branch preview deploy. Production
  // and feature-branch previews bypass entirely (isStaging guards both).
  if (isStaging && !isStagingAllowlisted(pathname)) {
    const { userId, redirectToSignIn } = await auth();

    if (!userId) {
      // Send unauthenticated visitors to Clerk's sign-in (Clerk knows whether
      // it's app-hosted or Clerk-hosted) with a return URL.
      return withStagingHeaders(
        redirectToSignIn({ returnBackUrl: req.url }),
      );
    }

    // Authenticated — verify admin status. Same lookup pattern as the
    // maintenance check below; cost is one extra Clerk API call per request
    // on staging only.
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const isAdmin = user?.privateMetadata?.["can-upload"] === true;

    if (!isAdmin) {
      return withStagingHeaders(
        NextResponse.redirect(new URL("/staging-restricted", req.url)),
      );
    }
    // Admin — fall through to maintenance check.
  }

  // === Maintenance mode (existing logic) ===
  // Skip maintenance check for admin routes and the maintenance page itself.
  // All other routes should show maintenance page when enabled.
  const isAdminRoute = pathname.startsWith("/admin");
  const isMaintenancePage = pathname === "/maintenance";
  const isApiRoute = pathname.startsWith("/api");

  if (!isAdminRoute && !isMaintenancePage && !isApiRoute) {
    const settings = await getMaintenanceSettings();

    if (settings.maintenanceMode.enabled) {
      // Check if user is an admin (has can-upload permission)
      // Admins can bypass maintenance mode to test the site
      const { userId } = await auth();

      if (userId) {
        // Fetch user data to check admin permissions
        const client = await clerkClient();
        const user = await client.users.getUser(userId);
        const isAdmin = user?.privateMetadata?.["can-upload"] === true;

        // Allow admins to access site during maintenance
        if (isAdmin) {
          return withStagingHeaders(NextResponse.next());
        }
      }

      // Redirect non-admin users to maintenance page
      const maintenanceUrl = new URL("/maintenance", req.url);
      return withStagingHeaders(NextResponse.redirect(maintenanceUrl));
    }
  }

  // Allow request to proceed for admin routes or when maintenance is off
  return withStagingHeaders(NextResponse.next());
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

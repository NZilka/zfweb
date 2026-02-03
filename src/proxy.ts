/**
 * Proxy/Middleware for authentication and maintenance mode
 * Extends Clerk middleware to add maintenance mode redirect logic
 */
import { clerkMiddleware, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
// Use middleware-safe KV utility (no server-only directive)
import { getMaintenanceSettings } from "~/server/kv-middleware";

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // Skip maintenance check for admin routes and the maintenance page itself
  // All other routes should show maintenance page when enabled
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
          return NextResponse.next();
        }
      }

      // Redirect non-admin users to maintenance page
      const maintenanceUrl = new URL("/maintenance", req.url);
      return NextResponse.redirect(maintenanceUrl);
    }
  }

  // Allow request to proceed for admin routes or when maintenance is off
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

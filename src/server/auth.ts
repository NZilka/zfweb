/**
 * Authorization helpers shared by server actions, server components, route
 * handlers, and the proxy.
 *
 * No `server-only` import on purpose: src/proxy.ts imports `isAdminUser`,
 * and `server-only` throws when bundled outside the React Server layer
 * (the same reason src/server/kv-middleware.ts skips it). The module still
 * cannot reach a client bundle because `@clerk/nextjs/server` refuses to.
 *
 * What "admin" means today: Clerk `privateMetadata["can-upload"] === true`.
 * The flag name is historical (it first gated UploadThing only) but it is
 * the single source of truth for admin across the app. Phase 2 of
 * docs/LAUNCH_PLAN.md moves the role into `customer.role` in Postgres; only
 * the body of `isAdminUser` needs to change then.
 */
import { cache } from "react";
import { auth, clerkClient } from "@clerk/nextjs/server";

// Clerk private-metadata key that marks an admin account.
export const ADMIN_FLAG = "can-upload";

// Thrown by requireAdmin(). `status` lets route handlers map it to 401/403.
export class AuthorizationError extends Error {
  readonly status: 401 | 403;

  constructor(kind: "Unauthorized" | "Forbidden") {
    super(kind);
    this.name = "AuthorizationError";
    this.status = kind === "Unauthorized" ? 401 : 403;
  }
}

// Memoized with React cache() so a layout, its page, and nested server calls
// in the same request share one Clerk Backend API call. Outside a React
// request (proxy, tests) cache() degrades to a plain function call.
export const isAdminUser = cache(async (userId: string) => {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return user?.privateMetadata?.[ADMIN_FLAG] === true;
});

// Throwing variant for actions and components that use throw-style errors.
// Call it as the first statement of every admin-only server action.
export async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new AuthorizationError("Unauthorized");
  if (!(await isAdminUser(userId))) throw new AuthorizationError("Forbidden");
  return { userId };
}

// Boolean variant for actions that report failures as { success, error }
// objects instead of throwing. Fails closed: any error counts as "not admin".
export async function checkAdmin() {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

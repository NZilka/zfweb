/**
 * Unit tests for the staging admin gate allowlist in src/proxy.ts.
 *
 * The full middleware (Clerk auth + redirect flow) is hard to test in
 * isolation because it depends on Clerk's runtime context. Instead, we
 * verify the pure helper `isStagingAllowlisted` — that's the single
 * source of truth for which paths bypass the staging admin check, so
 * regressions in that list would silently expose routes.
 */
import { describe, it, expect, vi } from "vitest";

// proxy.ts pulls in env-info (which uses "server-only"), Clerk, and kv —
// stub all of them out so importing the module doesn't try to initialize
// any of those at test time.
vi.mock("server-only", () => ({}));
vi.mock("~/lib/env-info", () => ({ isStaging: false }));
vi.mock("~/server/kv-middleware", () => ({
  getMaintenanceSettings: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({
  // clerkMiddleware identity-wraps so the default export still loads
  clerkMiddleware: (fn: unknown) => fn,
  clerkClient: vi.fn(),
  // Route matcher used by the /admin gate; a plain prefix check is enough here
  createRouteMatcher: (patterns: string[]) => (req: { nextUrl: { pathname: string } }) =>
    patterns.some((p) => req.nextUrl.pathname.startsWith(p.replace("(.*)", ""))),
}));

import { isStagingAllowlisted } from "~/proxy";

describe("isStagingAllowlisted", () => {
  it("allowlists Clerk sign-in paths", () => {
    expect(isStagingAllowlisted("/sign-in")).toBe(true);
    expect(isStagingAllowlisted("/sign-in/factor-one")).toBe(true);
    expect(isStagingAllowlisted("/sign-in/anything/nested")).toBe(true);
  });

  it("allowlists Clerk sign-up paths", () => {
    expect(isStagingAllowlisted("/sign-up")).toBe(true);
    expect(isStagingAllowlisted("/sign-up/verify-email")).toBe(true);
  });

  it("allowlists Clerk's own API callbacks", () => {
    expect(isStagingAllowlisted("/api/clerk")).toBe(true);
    expect(isStagingAllowlisted("/api/clerk/webhook")).toBe(true);
  });

  it("allowlists the Stripe webhook (signature verifies the caller)", () => {
    expect(isStagingAllowlisted("/api/stripe/webhook")).toBe(true);
  });

  it("allowlists the /staging-restricted landing page so non-admins can land there", () => {
    expect(isStagingAllowlisted("/staging-restricted")).toBe(true);
  });

  it("does NOT allowlist normal shop routes", () => {
    expect(isStagingAllowlisted("/")).toBe(false);
    expect(isStagingAllowlisted("/shop")).toBe(false);
    expect(isStagingAllowlisted("/shop/about")).toBe(false);
    expect(isStagingAllowlisted("/shop/checkout")).toBe(false);
  });

  it("does NOT allowlist admin routes — admins still go through the gate", () => {
    expect(isStagingAllowlisted("/admin")).toBe(false);
    expect(isStagingAllowlisted("/admin/orders")).toBe(false);
    expect(isStagingAllowlisted("/admin/settings")).toBe(false);
  });

  it("does NOT allowlist arbitrary API routes — only the specifically named ones", () => {
    // Defensive: a future /api/something endpoint must not auto-bypass.
    // The Clerk gate is what protects API surface; only documented exceptions pass.
    expect(isStagingAllowlisted("/api/uploadthing")).toBe(false);
    expect(isStagingAllowlisted("/api/orders")).toBe(false);
    // Substring confusion check: /api/stripe (not the webhook) should NOT bypass
    expect(isStagingAllowlisted("/api/stripe")).toBe(false);
    expect(isStagingAllowlisted("/api/stripe/checkout")).toBe(false);
  });

  it("does NOT allowlist paths that merely contain 'sign-in' substring", () => {
    // Defensive: prefix match, not substring. A page like /admin/sign-in-log
    // would start with /admin, not /sign-in, so it doesn't bypass.
    expect(isStagingAllowlisted("/some/sign-in")).toBe(false);
    expect(isStagingAllowlisted("/admin/sign-in-history")).toBe(false);
  });
});

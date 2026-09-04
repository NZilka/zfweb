/**
 * Proxy admin gate: /admin(.*) requires a signed-in admin.
 *
 * Boots the middleware handler with mocked Clerk primitives and asserts the
 * three outcomes: anonymous → sign-in redirect, signed-in non-admin → /shop,
 * admin → request continues. Also checks that non-admin routes are untouched
 * and that a settings document without maintenanceMode does not crash.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  userId: null as string | null,
  admins: new Set<string>(),
  redirectToSignIn: vi.fn((opts: { returnBackUrl: string }) => ({
    kind: "sign-in",
    returnBackUrl: opts.returnBackUrl,
  })),
  maintenanceSettings: { maintenanceMode: { enabled: false } } as unknown,
}));

vi.mock("server-only", () => ({}));
vi.mock("~/lib/env-info", () => ({ isStaging: false }));
vi.mock("~/server/kv-middleware", () => ({
  getMaintenanceSettings: vi.fn(async () => state.maintenanceSettings),
}));
vi.mock("~/server/auth", () => ({
  isAdminUser: vi.fn(async (id: string) => state.admins.has(id)),
}));
vi.mock("@clerk/nextjs/server", () => ({
  // Identity wrapper: the default export becomes the raw (auth, req) handler
  clerkMiddleware: (fn: unknown) => fn,
  createRouteMatcher: (patterns: string[]) => (req: { nextUrl: { pathname: string } }) =>
    patterns.some((p) => req.nextUrl.pathname.startsWith(p.replace("(.*)", ""))),
}));

import proxy from "~/proxy";

type Handler = (
  auth: () => Promise<{ userId: string | null; redirectToSignIn: typeof state.redirectToSignIn }>,
  req: { url: string; nextUrl: { pathname: string } },
) => Promise<Response | { kind: string; returnBackUrl: string }>;

const handler = proxy as unknown as Handler;

const auth = async () => ({
  userId: state.userId,
  redirectToSignIn: state.redirectToSignIn,
});

const req = (pathname: string) => ({
  url: `https://shop.example${pathname}`,
  nextUrl: { pathname },
});

const location = (res: unknown) =>
  res instanceof Response ? res.headers.get("location") : null;

beforeEach(() => {
  state.userId = null;
  state.admins = new Set();
  state.redirectToSignIn.mockClear();
  state.maintenanceSettings = { maintenanceMode: { enabled: false } };
});

describe("proxy /admin gate", () => {
  it("sends anonymous visitors to sign-in with a return URL", async () => {
    const res = await handler(auth, req("/admin/orders"));
    expect(res).toMatchObject({ kind: "sign-in", returnBackUrl: "https://shop.example/admin/orders" });
    expect(state.redirectToSignIn).toHaveBeenCalledTimes(1);
  });

  it("sends signed-in non-admins to the shop", async () => {
    state.userId = "user_shopper";
    const res = await handler(auth, req("/admin"));
    expect(location(res)).toBe("https://shop.example/shop");
  });

  it("lets admins through", async () => {
    state.userId = "user_owner";
    state.admins.add("user_owner");
    const res = await handler(auth, req("/admin/settings"));
    expect(res).toBeInstanceOf(Response);
    expect(location(res)).toBeNull();
    // Next's `next()` response marks itself with this header
    expect((res as Response).headers.get("x-middleware-next")).toBe("1");
  });

  it("does not gate shop routes", async () => {
    const res = await handler(auth, req("/shop/product/1"));
    expect(location(res)).toBeNull();
    expect(state.redirectToSignIn).not.toHaveBeenCalled();
  });

  it("survives a settings document without maintenanceMode", async () => {
    state.maintenanceSettings = {};
    const res = await handler(auth, req("/shop"));
    expect(location(res)).toBeNull();
  });

  it("redirects shoppers to /maintenance when maintenance mode is on, but not admins", async () => {
    state.maintenanceSettings = { maintenanceMode: { enabled: true } };
    expect(location(await handler(auth, req("/shop")))).toBe("https://shop.example/maintenance");

    state.userId = "user_owner";
    state.admins.add("user_owner");
    expect(location(await handler(auth, req("/shop")))).toBeNull();
  });
});

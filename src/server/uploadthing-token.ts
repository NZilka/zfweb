// Pure helpers for inspecting an UploadThing token. Kept in its own file
// (no server-only / env-info imports) so node scripts like the re-key
// migration can reuse the helpers without triggering server-component
// runtime guards.

// Prod UploadThing app id. NOT a secret — it appears in every upload URL
// served from the prod app. Hardcoded so a misconfigured env can never
// silently let staging/dev code reach prod storage.
export const PROD_UPLOADTHING_APP_ID = "515kq3lhmc";

// Decode the UploadThing token (a base64-encoded JSON blob) and pull out
// the appId. Returns null on missing or malformed input — callers decide
// how to treat that.
export function getAppIdFromToken(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
    if (
      decoded &&
      typeof decoded === "object" &&
      typeof decoded.appId === "string"
    ) {
      return decoded.appId;
    }
    return null;
  } catch {
    return null;
  }
}

// Pure decision: should the boot tripwire refuse to start?
// True only when the prod appId is active in a non-prod environment.
// Other configurations (no token, unknown appId, staging app in prod) are
// the caller's problem to debug; the tripwire only blocks the *dangerous*
// direction (mutating prod files from staging/dev code).
export function shouldRefuseUploadThingBoot(opts: {
  isProd: boolean;
  appId: string | null;
  prodAppId: string;
}): boolean {
  return !opts.isProd && opts.appId === opts.prodAppId;
}

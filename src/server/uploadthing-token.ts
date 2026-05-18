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

// Detects a token that is *present but malformed* — the typical cause is
// pasting the token into Vercel's env var UI with surrounding quotes
// preserved from the .env file. Returns a human-readable reason if broken,
// null if the token is either absent (caller's problem) or shape-valid.
//
// Exported for unit tests and re-use by the boot tripwire.
export function getMalformedTokenReason(
  token: string | undefined,
): string | null {
  if (!token) return null;
  // Most common: a literal `'` or `"` at the start or end of the value.
  // dotenv strips these locally but Vercel's UI does not, so a quoted
  // copy-paste from .env.local lands in the deploy with literal quotes.
  if (/^['"]|['"]$/.test(token.trim())) {
    return "token has wrapping quotes — strip them when pasting into Vercel's env-var UI";
  }
  if (getAppIdFromToken(token) === null) {
    return "token is not a valid base64-encoded JSON object with an appId field";
  }
  return null;
}

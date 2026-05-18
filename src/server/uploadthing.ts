import { UTApi } from "uploadthing/server";
import { isProd } from "~/lib/env-info";
import {
  getAppIdFromToken,
  getMalformedTokenReason,
  shouldRefuseUploadThingBoot,
  PROD_UPLOADTHING_APP_ID,
} from "./uploadthing-token";

// Boot tripwire — runs once when this module is first imported.
// Two refusal conditions, checked in order. Either failure throws at boot
// so the deploy / dev server fails loudly rather than silently breaking
// uploads at request time.
//
// 1. Token is set but malformed (e.g. pasted with quotes into Vercel UI).
//    Without this, the SDK fails per-request with an opaque "Invalid token"
//    message that doesn't point at the cause.
const _tokenProblem = getMalformedTokenReason(process.env.UPLOADTHING_TOKEN);
if (_tokenProblem) {
  // Temporary diagnostics: include length, edge chars, and positions of
  // any non-base64 characters so we can see what's actually in the value
  // without exposing the secret. Remove once the staging deploy is unblocked.
  const raw = process.env.UPLOADTHING_TOKEN ?? "";
  const nonB64 = Array.from(raw)
    .map((c, i) => (/[A-Za-z0-9+/=]/.test(c) ? null : `[${i}]=U+${c.charCodeAt(0).toString(16).padStart(4, "0")}`))
    .filter(Boolean)
    .slice(0, 12)
    .join(",");
  const diag =
    `length=${raw.length}, ` +
    `first8=${JSON.stringify(raw.slice(0, 8))}, ` +
    `last8=${JSON.stringify(raw.slice(-8))}, ` +
    `nonB64=[${nonB64}]`;
  throw new Error(
    `UPLOADTHING_TOKEN is malformed: ${_tokenProblem}. ` +
      `VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}, ` +
      `branch=${process.env.VERCEL_GIT_COMMIT_REF ?? "unset"}. ` +
      `Diag: ${diag}. ` +
      `See docs/STAGING_SETUP.md for env var setup.`,
  );
}

// 2. Prod token is active in a non-prod env (would mutate prod storage on
//    the first delete).
const _currentAppId = getAppIdFromToken(process.env.UPLOADTHING_TOKEN);
if (
  shouldRefuseUploadThingBoot({
    isProd,
    appId: _currentAppId,
    prodAppId: PROD_UPLOADTHING_APP_ID,
  })
) {
  throw new Error(
    `UploadThing prod token detected in a non-prod environment ` +
      `(VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}, ` +
      `branch=${process.env.VERCEL_GIT_COMMIT_REF ?? "unset"}). ` +
      `Refusing to start to prevent prod storage corruption — configure ` +
      `the staging UploadThing token instead. See docs/STAGING_SETUP.md.`,
  );
}

export const utapi = new UTApi({
  // ...options,
});

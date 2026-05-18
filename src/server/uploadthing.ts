import { UTApi } from "uploadthing/server";
import { isProd } from "~/lib/env-info";
import {
  getAppIdFromToken,
  shouldRefuseUploadThingBoot,
  PROD_UPLOADTHING_APP_ID,
} from "./uploadthing-token";

// Boot tripwire — runs once when this module is first imported.
// If prod's UploadThing token is somehow active in a non-prod deploy or
// local dev, throw at module load so the deploy / dev server fails loudly
// rather than silently corrupting prod storage on the first delete.
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

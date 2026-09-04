/**
 * UploadThing URL helpers. Pure (no server-only) so both server validation
 * and unit tests can use them.
 *
 * Two hosts serve UploadThing files:
 * - `utfs.io`: the legacy shared host. Still what the SDK's deprecated
 *   `file.url` returns, so most stored URLs look like this today.
 * - `<appId>.ufs.sh`: the per-app host behind `file.ufsUrl`. The staging
 *   re-key script already writes these, and uploadthing v9 will drop
 *   `file.url` entirely, so both hosts must be accepted everywhere a URL is
 *   validated or rendered (see `images.remotePatterns` in next.config.js).
 */

export const UPLOADTHING_LEGACY_HOST = "utfs.io";
export const UPLOADTHING_PER_APP_SUFFIX = ".ufs.sh";

// True when `value` is an https URL to a file on either UploadThing host.
// Requires the `/f/` file path so arbitrary pages on those hosts are rejected.
export function isUploadThingUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname;
  const hostOk =
    host === UPLOADTHING_LEGACY_HOST ||
    (host.endsWith(UPLOADTHING_PER_APP_SUFFIX) &&
      host.length > UPLOADTHING_PER_APP_SUFFIX.length);
  return hostOk && url.pathname.startsWith("/f/");
}

// Helpers for detecting which deployment environment the code is running in.
// Server-only because VERCEL_GIT_COMMIT_REF is not exposed to the client by default.
// For client-side detection, read process.env.NEXT_PUBLIC_VERCEL_ENV directly
// (Vercel auto-exposes this for Next.js deploys).
import "server-only";

// Vercel-injected system env vars. Always strings on Vercel, undefined locally.
// See https://vercel.com/docs/projects/environment-variables/system-environment-variables
export const VERCEL_ENV = process.env.VERCEL_ENV as
  | "production"
  | "preview"
  | "development"
  | undefined;

export const VERCEL_GIT_COMMIT_REF = process.env.VERCEL_GIT_COMMIT_REF;

// True on the Vercel production deployment (main branch + custom domain).
export const isProd = VERCEL_ENV === "production";

// True only when the preview deploy is our dedicated staging branch.
// Feature-branch previews have VERCEL_ENV === "preview" too, but a different git ref,
// so they do NOT qualify as staging even if they share some env vars.
export const isStaging =
  VERCEL_ENV === "preview" && VERCEL_GIT_COMMIT_REF === "staging";

// True when running locally (outside Vercel).
export const isLocal = !VERCEL_ENV || VERCEL_ENV === "development";

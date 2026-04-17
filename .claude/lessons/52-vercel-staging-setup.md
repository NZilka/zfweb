# Lesson: Vercel Staging Setup

## What We Built

A staging environment for zfweb on Vercel so changes can be verified on a production-like deploy before merging to `main`. This PR adds the code-level scaffolding:

- New env var `TEST_MODE_ALLOWED` validated through T3 env schema.
- `src/lib/env-info.ts` — server-only helpers `isProd`, `isStaging`, `isLocal` derived from Vercel's `VERCEL_ENV` + `VERCEL_GIT_COMMIT_REF`.
- `StagingBanner` component rendered in the admin layout, visible only when the deploy is the dedicated `staging` branch.
- PostHog analytics skipped on any preview deploy so staging + feature previews don't pollute production analytics.
- `docs/STAGING_SETUP.md` — full step-by-step dashboard runbook for Neon branching, Stripe test keys, Upstash, and Vercel env var configuration.

No functional change to prod — this PR is all plumbing. The user still needs to do the dashboard setup documented in `STAGING_SETUP.md`.

## Why This Approach

**Why a separate Neon branch + separate Upstash DB, but shared Clerk + UploadThing?**

Isolate what differs between envs (data, payment state). Share what's expensive to duplicate (auth users, file storage) — sharing Clerk means admins don't have to re-grant permissions on staging, and sharing UploadThing avoids running a second file-storage app. The tradeoff is documented (don't delete files from staging if prod references them).

**Why is `isStaging` strict about the branch name?**

Feature-branch previews on Vercel have `VERCEL_ENV === "preview"` too. Without the `VERCEL_GIT_COMMIT_REF === "staging"` check, opening a PR would trigger the yellow banner (and eventually staging-only behaviors). Strict branch-name match ensures only the dedicated long-lived `staging` branch qualifies.

**Why `TEST_MODE_ALLOWED` as a transformed string, not `z.coerce.boolean()`?**

`z.coerce.boolean()` treats any non-empty string as truthy — including the literal string `"false"`. That's a production footgun. Explicit `.string().optional().transform(v => v === "true")` is unambiguous.

**Why skip PostHog on ALL preview deploys, not just staging?**

Feature-branch previews are also non-production traffic that shouldn't pollute analytics. Easier and safer to skip the whole `preview` env than to enumerate branches.

## Key Concepts

- **Vercel env scopes:** Production / Preview / Development. Preview applies to every preview branch by default — use branch filters to scope staging-specific vars.
- **T3 env schema:** one source of truth for server/client env var typing via `@t3-oss/env-nextjs`. New vars go in `server` or `client` blocks + `runtimeEnv`.
- **`server-only` import:** marks a module as never-bundled-into-client. Tests must mock it with `vi.mock("server-only", () => ({}))`.
- **`vi.resetModules()`:** clears the module cache so a re-import sees updated `process.env`. Necessary when testing modules that read env at import time.

## Code Walkthrough

### The capability gate

```js
TEST_MODE_ALLOWED: z
  .string()
  .optional()
  .transform((v) => v === "true"),
```

Three properties: absent → false, `"false"` → false, `"true"` → true. Any other value → false. This is the single gate that decides whether the whole test-mode feature can run (PR #2+ will build on this).

### The staging detector

```ts
export const isStaging =
  VERCEL_ENV === "preview" && VERCEL_GIT_COMMIT_REF === "staging";
```

Both conditions required. Ordering matters only for short-circuit performance, not correctness.

### The banner

Server component (no `"use client"`, no hooks). Simply imports `isStaging` and early-returns null otherwise. Renders as the first child of the admin layout so it's always visible in admin views.

### PostHog guard

The module-level init check and the provider both gate on `isPreviewDeploy`. The provider early-returns `<>{children}</>` on previews, which skips mounting `<PHProvider>` entirely — analytics events simply aren't captured.

## Testing Strategy

Six unit tests covering the flag truth table:
- Absent `VERCEL_ENV` → local
- `VERCEL_ENV=development` → local
- `VERCEL_ENV=production` → prod
- `VERCEL_ENV=preview` + `VERCEL_GIT_COMMIT_REF=staging` → staging
- `VERCEL_ENV=preview` + `VERCEL_GIT_COMMIT_REF=feature/x` → NOT staging (critical guard)
- `VERCEL_ENV=preview` with no ref → NOT staging

Each test calls `vi.resetModules()` in `beforeEach` and re-imports `~/lib/env-info`, because the module reads `process.env` once at load time.

## What You Learned

- Vercel's preview scope is a shared bucket across ALL preview branches; always use branch filters for env-specific values.
- `z.coerce.boolean()` is the wrong tool for env vars — it treats `"false"` as true. Use explicit string comparison.
- `server-only` is a real runtime marker; tests must mock it.
- `vi.resetModules()` is the escape hatch for testing code that reads `process.env` at import time rather than on each call.
- Strict branch-name checks prevent preview env bleed (e.g., feature PRs accidentally matching staging).

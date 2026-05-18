# Staging Environment Setup

This doc covers the one-time setup to give the project a staging environment on Vercel that mirrors production but with isolated data and Stripe test mode.

## Overview

| Piece | Production | Staging | Notes |
| --- | --- | --- | --- |
| Git branch | `main` | `staging` | Both auto-deploy via Vercel |
| Domain | your prod domain | `staging.crft.shop` (interim; switches to `staging.zilkaforgewerks.com` at launch) | |
| Neon DB | prod branch | `staging` branch | Branched from prod, separate data |
| Upstash Redis | prod DB | separate DB | Don't share — SiteSettings would cross-contaminate |
| Stripe | live keys | test-mode keys | Separate webhook endpoints |
| Clerk | shared | shared | Users + admin metadata are the same |
| UploadThing | shared | shared | Tradeoff: don't delete files from staging |
| `TEST_MODE_ALLOWED` | omit (or `"false"`) | `"true"` | Unlocks the admin test mode toggle |

## Step-by-step

### 1. Git — create the staging branch

```bash
git checkout main
git pull
git checkout -b staging
git push -u origin staging
```

This branch should be long-lived. Going forward, merge `main` → `staging` to redeploy staging with latest prod, or cherry-pick/merge feature branches into `staging` to test them before promoting to `main`.

### 2. Neon — create a staging DB branch

1. Open the Neon console → your project → **Branches** tab.
2. Click **Create branch**, name it `staging`, source from `main`.
3. From the staging branch's page, copy the **pooled** connection string (ends with `?sslmode=require`).
4. Save it aside — you'll paste it into Vercel below as `DATABASE_URL`.

Note: Neon branches start as copy-on-write from the parent, so staging ships with a snapshot of prod data as of the branch point. Periodically re-branch (delete + recreate) to refresh if data drifts too much.

### 3. Upstash Redis — create a separate staging DB

Sharing the KV store with prod is tempting but dangerous: toggling test mode (or maintenance mode, announcement banner, etc.) on staging would affect production. Create a fresh DB.

1. Upstash console → **Create database**, name it `zfweb-staging`, same region as your prod DB.
2. Copy the REST URL and REST token from the new DB's page.

### 4. Stripe — grab test-mode keys and create a webhook

1. Stripe Dashboard → top-right toggle → switch to **Test mode**.
2. **Developers → API keys** → copy the publishable key (`pk_test_…`) and secret key (`sk_test_…`).
3. **Developers → Webhooks → Add endpoint.**
   - URL: `https://<your-staging-url>/api/stripe/webhook`
   - Events: `payment_intent.succeeded`, `payment_intent.processing`, `payment_intent.payment_failed`, `payment_intent.canceled`
   - After creating, copy the signing secret (`whsec_…`).

Make sure you're in **Test mode** when creating the webhook — a live-mode webhook pointed at staging will silently fail signature verification.

### 5. Vercel — configure environment variables

The key subtlety: Vercel's **Preview** scope applies to every preview branch (every PR). Without a branch filter, feature-branch previews will inherit staging's DB URL and Stripe keys. Always use the **branch filter** when setting staging-specific vars.

1. Vercel dashboard → your project → **Settings → Environment Variables**.
2. For each variable below, add it with scope **Preview** and set the branch filter to `staging`:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Neon staging branch pooled URL |
   | `STRIPE_SECRET_KEY` | `sk_test_…` |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_…` from step 4 |
   | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` |
   | `UPSTASH_REDIS_REST_URL` | staging Upstash URL |
   | `UPSTASH_REDIS_REST_TOKEN` | staging Upstash token |
   | `TEST_MODE_ALLOWED` | `true` |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | same as Production |
   | `CLERK_SECRET_KEY` | same as Production |
   | `UPLOADTHING_TOKEN` | same as Production |

3. **Double-check Production scope**: `TEST_MODE_ALLOWED` must be absent or `"false"`. This is the most important guard — it's what prevents test mode from running in prod.

### 6. Vercel — connect the branch

1. **Settings → Git** — confirm Production Branch is `main`.
2. Push any commit to `staging` — Vercel will build and deploy to `https://staging.crft.shop` (the custom domain assigned to the `staging` branch via Vercel Settings → Domains, scoped Preview / branch `staging`).
3. Update the Stripe webhook URL from step 4 if the actual Vercel URL differs from what you guessed.

### 7. (Optional) Branch protection

On GitHub, add branch protection rules for both `main` and `staging`:
- Require pull request reviews before merging
- Require status checks to pass

This prevents direct pushes to either branch.

## Verifying the setup

After the first staging deploy:

- [ ] Visit `https://staging.crft.shop` unauthenticated → redirected to Clerk sign-in (staging admin gate).
- [ ] Sign in as a non-admin Clerk user → redirected to `/staging-restricted` with a sign-out button.
- [ ] Sign in as an admin (`privateMetadata["can-upload"] === true`) → see the shop and `/admin` normally.
- [ ] Yellow "STAGING ENVIRONMENT" banner appears site-wide (shop + admin), not just inside `/admin`.
- [ ] `curl -I https://staging.crft.shop/` returns header `X-Robots-Tag: noindex, nofollow` on every response.
- [ ] Open browser devtools → Network tab on staging → no PostHog requests (analytics are skipped on preview deploys).
- [ ] Connect to the staging Neon branch via `pnpm db:studio` with staging `DATABASE_URL` — confirm it has its own data.
- [ ] `/admin/settings` shows a red **Test Mode** card on staging. That same card is absent on prod.

## Running schema migrations across environments

There's no automatic migration on Vercel build. Schema changes are applied
manually per environment via `pnpm db:push`, with the staging push happening
*before* the release PR ships to prod. The canonical ordering and commands
live in `docs/RELEASE_WORKFLOW.md` (see "Schema migrations" there).

Key thing to know locally: `drizzle.config.ts` loads `.env.local` explicitly,
so the URL you set in `.env.local` is the URL `pnpm db:push` writes to. Always
verify before running.

## Gotchas

- **Feature previews leak staging env.** If you forget the branch filter, any feature PR preview inherits staging's `DATABASE_URL` + `TEST_MODE_ALLOWED=true` and will write to the staging DB. Always use the branch filter.
- **Stripe test mode toggle in dashboard.** If you don't see the webhook you created under Webhooks, check the top-right Test/Live toggle.
- **Shared Clerk:** admin-only Clerk metadata (`privateMetadata.can-upload`) is shared across environments because Clerk users are shared. Usually desired.
- **Shared UploadThing:** deleting a file on staging (e.g., swapping logos) removes it from the shared bucket. If prod still references that file's key, prod breaks. Since KV is separate, this only happens if you manually copy settings across — still, don't hand-delete UT files on staging.
- **Neon free-tier branch limits.** Long-lived staging counts toward branch quota. Upgrade if needed.
- **PostHog:** the provider skips init on any preview deploy (`NEXT_PUBLIC_VERCEL_ENV === "preview"`), so staging + feature previews never send analytics events to the production PostHog project.

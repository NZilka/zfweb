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
| UploadThing | prod app | separate `zfstage` app | Tokens scoped per env; boot tripwire refuses to start with prod token in non-prod |
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

### 3.5. UploadThing — create a separate staging app

The prod and staging environments must NOT share an UploadThing app. The
staging Neon branch is copy-on-write off prod, so freshly branched staging
rows reference prod UT files — any delete on staging against a shared app
would 404 the prod URLs. Token-level isolation is the only structural fix.

1. UploadThing dashboard → **Create app**, name it `zfstage` (or similar).
2. Copy the staging app's token.
3. Vercel → Settings → Environment Variables → `UPLOADTHING_TOKEN` with
   scope **Preview**, branch filter **staging**, value = the new token.
4. Local dev: paste the same token into `.env.local`'s `UPLOADTHING_TOKEN`
   line. (Production keeps the original prod token in Vercel's Production
   scope; never put it in `.env.local`.)
5. A boot-time tripwire in `src/server/uploadthing.ts` decodes the active
   token and refuses to start if either (a) the token is malformed (e.g.
   has wrapping quote characters from a copy-paste), or (b) the **prod**
   appId is detected in a non-prod context. So if you ever paste the wrong
   value or forget the Vercel branch filter, the deploy fails loudly instead
   of silently breaking uploads at request time.

> **Pasting tokens into Vercel's env-var UI** — two common mistakes the
> boot tripwire catches:
>
> 1. **Wrapping quotes.** dotenv strips `'…'` / `"…"` from `.env.local`
>    lines but Vercel's UI preserves them as part of the value. Strip them
>    when pasting.
> 2. **The whole .env line.** Copying `UPLOADTHING_TOKEN=eyJ…=` and pasting
>    into Vercel's *value* field stores the variable name as part of the
>    value. The variable name belongs in the field on the left; only the
>    `eyJ…=` (the part after `=`) goes in the value field.
>
> Same rules apply to any other env var. The tripwire surfaces a specific
> error message for each mistake so the fix is obvious.

Note: a freshly branched staging Neon DB's image URLs still point at prod
UT files. They'll load fine for reads (the prod app's bucket is publicly
readable), but staging deletes won't reach them. After branching, run the
re-key script in step 8 below to copy each prod-owned file into the
staging app and rewrite the staging DB/KV references.

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
   | `UPLOADTHING_TOKEN` | the `zfstage` (staging) app token from step 3.5 — NOT prod's |

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

### 8. Re-key UploadThing references after Neon re-branch

A freshly branched staging Neon DB references prod-owned UT files (image
URLs still point at the prod app's bucket). To finish isolating staging
storage from prod, run the re-key script — it copies every prod-referenced
file into the staging UT app and rewrites the DB + KV pointers:

```bash
# 1. Confirm .env.local's UPLOADTHING_TOKEN is the zfstage token
# 2. Confirm DATABASE_URL points at the staging Neon branch
# 3. Dry run — prints every operation without mutating
pnpm tsx scripts/restaging-uploadthing.ts

# 4. Apply
pnpm tsx scripts/restaging-uploadthing.ts --apply
```

The script refuses to run if `UPLOADTHING_TOKEN` resolves to the prod
appId (`515kq3lhmc`). Re-run this any time you delete + recreate the
staging Neon branch. Re-running on already-migrated data will skip
already-staging files; only legacy `utfs.io/...` URLs (no per-app
subdomain) are re-uploaded conservatively.

## Error visibility on staging

Next.js builds preview deploys with `NODE_ENV=production`, which strips
error messages from Server Component render errors at runtime (the
generic "specific message is omitted in production builds…" page). This
is hostile for QA. To work around it, `src/app/error.tsx` and
`src/app/global-error.tsx` boundaries check
`process.env.NEXT_PUBLIC_VERCEL_ENV !== "production"` and render the
full `error.message` + stack inline on any non-prod deploy. Production
deploys still show only the digest, matching Next's default behavior.

The `NEXT_PUBLIC_VERCEL_ENV` value is auto-injected by Vercel — no env
var setup needed.

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
- **UploadThing isolation depends on the right token reaching the right env.** Staging uses the `zfstage` app; prod uses the original app. The Vercel branch filter on `UPLOADTHING_TOKEN` is the structural guard; the boot tripwire in `src/server/uploadthing.ts` is the loud-failure backstop. If you ever see a deploy fail with "UploadThing prod token detected in a non-prod environment," the Vercel env var scope is wrong.
- **Neon free-tier branch limits.** Long-lived staging counts toward branch quota. Upgrade if needed.
- **PostHog:** the provider skips init on any preview deploy (`NEXT_PUBLIC_VERCEL_ENV === "preview"`), so staging + feature previews never send analytics events to the production PostHog project.

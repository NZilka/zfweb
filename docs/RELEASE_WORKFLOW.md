# Release Workflow

How code moves from a feature branch to production for zfweb. Read alongside `docs/STAGING_SETUP.md`, which describes the environment this workflow assumes.

## TL;DR

```
feature/X ─┐
           ├─► staging ─(local ff-merge, verify on staging deploy)─► batched release PR ─► main ─► prod deploy
feature/Y ─┘
```

- All work happens on short-lived `feature/*` or `fix/*` branches.
- Branches **always merge into `staging` first**, never directly into `main`.
- Staging is verified on the live `*-staging.vercel.app` deploy.
- Production releases happen as a **batched `staging` → `main` PR** via GitHub.
- Hotfixes follow the exact same path — no bypass.

## Branch model

| Branch | Lifetime | Purpose | Deploys to |
| --- | --- | --- | --- |
| `main` | permanent | Production. Only ever updated via a release PR from `staging`. | Vercel production |
| `staging` | permanent | Integration / release candidate. Receives every feature first. | Vercel staging (`*-staging.vercel.app`) |
| `feature/<name>` | short-lived | One feature. Merged into `staging` and then deleted. | Preview deploy on push |
| `fix/<name>` | short-lived | Bug fix. Same lifecycle as `feature/*`. | Preview deploy on push |
| `hotfix/<name>` | short-lived | Urgent production bug. Still goes through `staging` — the name signals urgency, not a different code path. | Preview deploy on push |

## Lifecycle

### 1. Start a feature

Branch from current `staging` (not `main`) so you pick up anything that's been tested-and-not-yet-released:

```bash
git checkout staging && git pull
git checkout -b feature/<descriptive-name>
```

### 2. Develop in phases

Follow `.claude/docs/development_workflow.md` for the phased-development pattern. Per CLAUDE.md, each PR must include:

- Unit tests for new functionality (`src/__tests__/`)
- `pnpm test:run` passing
- `pnpm check` passing
- A lesson file at `.claude/lessons/{pr-number}-{feature-name}.md`
- Explanatory comments on changed code

Push the feature branch regularly so the Vercel preview deploy stays current:

```bash
git push -u origin feature/<name>
```

### 3. Merge to staging (local, fast-forward)

When the feature is ready for QA on staging:

```bash
# Make sure local staging is current
git checkout staging && git pull

# Rebase the feature branch onto current staging
git checkout feature/<name>
git rebase staging

# Fast-forward staging onto the rebased feature
git checkout staging
git merge --ff-only feature/<name>

# Verify nothing broke at the type level
pnpm check

# Publish
git push origin staging
```

**Why rebase + `--ff-only`:** keeps `staging` history linear and forces you to resolve any conflicts on the feature branch before they reach staging. This also avoids the chained-PR-merge incident pattern documented in `MEMORY.md` (PRs #43/#44 → #45).

**If the feature touches `src/server/db/schema.ts`:** see the [Schema migrations](#schema-migrations) section below — apply the schema to staging Neon *before* relying on the new column in code that deploys.

### 4. Verify on the staging deploy

After pushing, Vercel builds and deploys staging within ~1–2 minutes. Verify the feature end-to-end on `*-staging.vercel.app`:

- Exercise the feature in a browser (golden path + edge cases).
- Check `/admin/settings` shows the yellow STAGING banner and (when enabled) the red Test Mode card.
- Run any feature-specific checklist from the PR description.
- For frontend changes, test mobile width (320px) per CLAUDE.md's mobile-first rules.

If something breaks on the staging deploy, fix forward on a new branch — don't `git revert` on `staging` unless you've coordinated with anything else that's been merged but not yet released.

### 5. Delete the merged feature branch

Once the feature is on staging and verified, the feature branch has served its purpose:

```bash
git branch -d feature/<name>
git push origin --delete feature/<name>
```

### 6. Batched release PR to production

When a set of features has been verified on staging and is ready to ship, open one PR promoting everything in `staging` to `main`:

```bash
# Make sure staging is current
git checkout staging && git pull

# Open the release PR via GitHub
gh pr create --base main --head staging --title "release: <date or version>" --body "$(cat <<'EOF'
## Release contents

- feat: <feature 1> (#PR)
- fix: <fix 1> (#PR)
- ...

## Verified on staging

- [ ] feature 1: <what was tested>
- [ ] fix 1: <what was tested>

## Schema changes

- [ ] None
- [ ] `is_test` column on `order` table — `pnpm db:push` against prod Neon **after** this PR merges
EOF
)"
```

**The release PR is the production gate.** It must:

- Pass required GitHub status checks (CI, typecheck).
- Have a clean diff against `main` (no unexpected files).
- List every schema change in the body so post-merge migration steps are explicit.

Merge the PR via GitHub UI (not local) so the merge commit and review history live on `main`.

### 7. Apply schema changes to production

If the release included schema changes, apply them to the prod Neon branch **only after** the release PR has merged:

```bash
# Edit .env to point DATABASE_URL at PROD Neon (not staging)
# (drizzle.config.ts loads .env, not .env.local)
pnpm db:push
```

Then revert `.env` to the staging URL for ongoing development.

### 8. Verify production

- Smoke-test the prod URL.
- Check Vercel deployment logs.
- If you applied a schema migration, run a quick `SELECT` in the Neon console against the prod branch to confirm the column/table is there.

## Schema migrations

Schema lives in `src/server/db/schema.ts`. The project uses **`pnpm db:push`** (diff-based) rather than versioned `pnpm db:migrate`. That means schema is applied per-environment by manually running the command with the right `DATABASE_URL`.

**Order matters:** apply schema **before** the code that depends on it ships, on each environment:

| When | Action |
| --- | --- |
| Feature merged to `staging` | Point `.env` at staging Neon → `pnpm db:push` → push schema change → wait for Vercel staging deploy → verify |
| Release PR merged to `main` | Point `.env` at prod Neon → `pnpm db:push` → Vercel auto-deploys prod from `main` |

**Footgun:** `drizzle.config.ts` uses `dotenv/config`, which loads `.env` and ignores `.env.local`. Always update `.env` — not `.env.local` — before running `pnpm db:push`.

**Never** push staging-only schema changes to prod. If `is_test` is added on a feature branch and applied to staging, prod must NOT receive it until the release PR carries that schema into `main`'s source tree.

## Hotfix flow

Even urgent production bugs follow the standard path. The `hotfix/` prefix signals priority to humans; it does not skip staging.

```bash
git checkout staging && git pull
git checkout -b hotfix/<bug-description>
# fix + commit + push
# merge into staging as in step 3
# verify on staging deploy
# open release PR immediately (don't batch — promote alone)
```

The only difference from a feature is **release cadence**: open the `staging → main` release PR as soon as the hotfix is verified on staging, instead of waiting for the next batched release.

If a hotfix cannot wait for staging verification (true emergency: prod is down, users losing money), pause and discuss before bypassing this flow. Bypass should be a recorded decision, not a habit.

## Common pitfalls

- **Chained PRs dropping changes on GitHub merge.** If feature B is opened against feature A's branch, GitHub computes the diff against A — not against `staging` — and may silently drop changes that already exist in A. Mitigation: always rebase each feature onto current `staging` before merging the next link in the chain. See `MEMORY.md` "Chained PR Merges — DANGER" and `.claude/lessons/45-restore-carousel-types.md`.

- **`pnpm db:push` reading the wrong env file.** `drizzle.config.ts` loads `.env` (not `.env.local`). If `.env.local` is staging but `.env` is prod, you'll push schema to prod by accident. Always read the active `DATABASE_URL` from `.env` before running.

- **Forgetting to apply schema to prod after release.** The release PR carries the schema *source* to `main`, but `pnpm db:push` still has to be run manually against prod Neon. List schema changes in every release PR body so this step isn't missed.

- **Releasing staging when it contains unfinished work.** Because we batch, `staging` may contain features that aren't ready. Before opening a release PR, confirm every feature on the staging diff is QA'd. If something isn't ready, either finish it or `git revert` it on staging first.

- **Direct push to `main`.** This bypasses the entire flow. Enable GitHub branch protection on `main`: required PR review, required status checks, no force-push. Same protections on `staging` (per `STAGING_SETUP.md` step 7).

## Quick reference

```bash
# Start a feature
git checkout staging && git pull
git checkout -b feature/<name>

# After implementation, merge to staging
git checkout staging && git pull
git checkout feature/<name> && git rebase staging
git checkout staging && git merge --ff-only feature/<name>
pnpm check && git push origin staging
# (then pnpm db:push if schema changed, verify on staging deploy)

# Release to production
gh pr create --base main --head staging --title "release: <date>"
# merge via GitHub UI after checks pass
# (then pnpm db:push against prod if schema changed)
```

## Related docs

- `docs/STAGING_SETUP.md` — one-time setup of the staging environment (Neon branch, Upstash, Stripe webhooks, Vercel env vars).
- `.claude/docs/development_workflow.md` — phased development pattern within a single feature branch.
- `.claude/docs/architectural_patterns.md` — code organization, server/client patterns, modal/upload patterns.
- `.claude/lessons/` — per-PR lessons capturing what was built and why.
- `CLAUDE.md` — overall project guidance and PR completion requirements.

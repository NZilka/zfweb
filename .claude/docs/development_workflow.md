# Structured Development Workflow

When implementing a feature or significant change, follow this structured workflow.

## 1. Planning Phase

- Create a planning document (markdown) in `docs/` that outlines:
  - Overall goal and scope
  - Technical approach
  - Dependencies and prerequisites
- Break the work into PR-sized phases (3-6 phases typical)
- Each phase should be:
  - Independently testable
  - Small enough to review in one sitting
  - Building on previous phases

**Example planning doc structure:**
```markdown
# Feature Name Implementation Plan

## Overview
Brief description of the feature.

## Phases
### Phase 1: Infrastructure
- Task 1
- Task 2

### Phase 2: Core Implementation
- Task 1
- Task 2

... etc
```

## 2. Branch Creation

- Create a feature branch from **current `staging`** (not `main`) so you pick up anything that's been tested-and-not-yet-released:
  ```bash
  git checkout staging && git pull
  git checkout -b feature/<feature-name>
  # or for fixes:
  git checkout -b fix/<bug-description>
  ```
- All work for all phases happens on this single branch
- Push the branch after each phase commit

See `docs/RELEASE_WORKFLOW.md` for the full branch model and staging-first promotion flow.

## 3. Phase Execution

Repeat for each phase:

### a. Implementation
- Write the code for that phase
- Add comments explaining changes and reasoning
- Keep changes focused on the phase scope

### b. Testing
- Write unit tests for new functionality
- Run `pnpm check` (typecheck/lint)
- Run `pnpm test` to verify all tests pass
- Fix any failures before proceeding

### c. Commit & Push
- Stage and commit with descriptive message:
  ```bash
  git add .
  git commit -m "feat: Phase X - Description

  - Bullet points of changes

  Co-Authored-By: Claude <noreply@anthropic.com>"
  ```
- Push to remote: `git push`

### d. Update Progress
- Mark phase complete in planning document
- Update any relevant documentation

## 4. Merge to staging

After all phases complete, merge the feature into `staging` using a local fast-forward merge (the project's convention — see `docs/RELEASE_WORKFLOW.md` for why):

```bash
git checkout staging && git pull
git checkout feature/<name> && git rebase staging
git checkout staging && git merge --ff-only feature/<name>
pnpm check
git push origin staging
```

If the feature touched `src/server/db/schema.ts`, run `pnpm db:push` against the staging Neon branch before relying on the new schema in the deployed staging app. See the Schema migrations section of `docs/RELEASE_WORKFLOW.md`.

## 5. Verify on staging deploy

Vercel auto-deploys `staging` to `*-staging.vercel.app` within a couple minutes of the push. Verify the feature end-to-end on that deploy — type checks and unit tests verify code correctness, not feature correctness.

Then delete the merged feature branch:

```bash
git branch -d feature/<name>
git push origin --delete feature/<name>
```

## 6. Release to production

Production releases are **batched** — multiple verified features ship together via one `staging → main` PR opened via GitHub:

```bash
gh pr create --base main --head staging --title "release: <date>" --body "$(cat <<'EOF'
## Release contents
- feat: <PR titles included in this batch>

## Verified on staging
- [ ] feature 1: <what was tested>

## Schema changes
- [ ] None / list any that require `pnpm db:push` against prod after merge
EOF
)"
```

Merge via the GitHub UI after status checks pass. Apply any schema changes to prod Neon *after* the merge, then verify the prod deploy.

Full release process, including hotfix policy and schema-migration ordering rules: `docs/RELEASE_WORKFLOW.md`.

## Key Principles

| Principle | Why |
|-----------|-----|
| Each phase leaves codebase working | Enables bisecting, easier rollback |
| Tests pass before next phase | Catches issues early |
| Documentation updated with code | Stays in sync |
| Small focused commits | Easier to review and debug |
| Use TodoWrite tool | Track progress visibly |

## Quick Reference

```bash
# Start new feature (branch from staging)
git checkout staging && git pull
git checkout -b feature/my-feature

# After each phase
pnpm check && pnpm test
git add . && git commit -m "feat: Phase X - ..."
git push

# Merge to staging when feature is ready
git checkout staging && git pull
git checkout feature/my-feature && git rebase staging
git checkout staging && git merge --ff-only feature/my-feature
pnpm check && git push origin staging

# When a batch of features is verified on staging, open the release PR
gh pr create --base main --head staging --title "release: <date>"
```

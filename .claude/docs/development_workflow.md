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

- Create a feature branch from main before starting work:
  ```bash
  git checkout -b feature/<feature-name>
  # or for fixes:
  git checkout -b fix/<bug-description>
  ```
- All work for all phases happens on this single branch
- Push the branch after each phase commit

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

## 4. Pull Request

After all phases complete:

```bash
gh pr create --title "feat: Feature Name" --body "$(cat <<'EOF'
## Summary
- Key change 1
- Key change 2

## Phases Completed
1. Phase 1 description
2. Phase 2 description
...

## Test plan
- [ ] Manual test 1
- [ ] Manual test 2

Generated with [Claude Code](https://claude.ai/code)
EOF
)"
```

## 5. Review & Merge

- Address any review feedback with additional commits
- Ensure CI passes
- Merge when approved

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
# Start new feature
git checkout -b feature/my-feature

# After each phase
pnpm check && pnpm test
git add . && git commit -m "feat: Phase X - ..."
git push

# Create PR when done
gh pr create --title "feat: My Feature" --body "..."
```

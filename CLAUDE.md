# CLAUDE.md - zfweb

E-commerce platform for Zilka Forgewerks (bespoke jewelry/tools) built with Next.js 16.

Use the context from PROJECT.md in all understanding and decision making.

Use MOTIVATION.md for project understanding

After completing a task that involves tool use, provide a quick summary of the work you've done.

Always use the design skill when changing the UI.

Comment all code that is added, changed, or deleted explaining the change and reasoning. Be concise.

Keep this and all other reliant markdown files up to date to match the state of the project.

Create or use current markdown files such as CLAUDE.md or PROJECT.md to store context so there is continuity between sessions.

<use_parallel_tool_calls>
If you intend to call multiple tools and there are no dependencies
between the tool calls, make all of the independent tool calls in
parallel. Prioritize calling tools simultaneously whenever the
actions can be done in parallel rather than sequentially. For
example, when reading 3 files, run 3 tool calls in parallel to read
all 3 files into context at the same time. Maximize use of parallel
tool calls where possible to increase speed and efficiency.
However, if some tool calls depend on previous calls to inform
dependent values like the parameters, do not call these tools in
parallel and instead call them sequentially. Never use placeholders
or guess missing parameters in tool calls.
</use_parallel_tool_calls>

<investigate_before_answering>
Never speculate about code you have not opened. If the user
references a specific file, you MUST read the file before
answering. Make sure to investigate and read relevant files BEFORE
answering questions about the codebase. Never make any claims about
code before investigating unless you are certain of the correct
answer - give grounded and hallucination-free answers.
</investigate_before_answering>

## Git Workflow

**IMPORTANT:** When working on a new feature or fixing a bug, create a git branch first. Work on changes in that branch for the remainder of the session. When planning, break down tasks into pull request sized units of work. After each pull request is done, check it into the branch. Ask any questions you have.

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

## PR Completion Requirements

**Every PR must include these steps before being considered complete:**

### 1. Unit Tests

Write unit tests for all new functionality. Tests go in `src/__tests__/` following existing patterns.

```bash
pnpm test:run    # Run all tests once
pnpm test        # Run tests in watch mode (for development)
```

- Test files should be named `{feature}.test.ts` or `{component}.test.tsx`
- Use Vitest with happy-dom for React component tests
- Mock external services (database, Stripe, etc.) - see existing tests for patterns
- All tests must pass before committing the PR

### 2. Lesson Documentation

After completing each PR, create a lesson file in `.claude/lessons/` that teaches what was done and why.

**File naming:** `.claude/lessons/{pr-number}-{feature-name}.md`

**Lesson structure:**
```markdown
# Lesson: {Feature Name}

## What We Built
Brief description of the feature/change.

## Why This Approach
Explanation of architectural decisions and trade-offs.

## Key Concepts
- Concept 1: explanation
- Concept 2: explanation

## Code Walkthrough
Highlight important code patterns with explanations.

## Testing Strategy
How we tested this feature and why.

## What You Learned
Summary of new patterns, techniques, or knowledge.
```

### PR Checklist

Before committing a PR, verify:
- [ ] Unit tests written for new functionality
- [ ] All tests pass (`pnpm test:run`)
- [ ] Type check passes (`pnpm check`)
- [ ] Lesson file created in `.claude/lessons/`
- [ ] Code has explanatory comments

## Tech Stack

- **Framework:** Next.js 16 (App Router, Server Components)
- **Database:** PostgreSQL (Neon serverless) + Drizzle ORM
- **Auth:** Clerk
- **File Upload:** UploadThing
- **Styling:** Tailwind CSS + CVA for component variants
- **Package Manager:** pnpm

## Commands

```bash
pnpm dev           # Start development server
pnpm build         # Production build
pnpm check         # Lint + typecheck
pnpm test          # Run tests in watch mode
pnpm test:run      # Run all tests once
pnpm test:coverage # Run tests with coverage report
pnpm db:studio     # Open Drizzle Studio (database GUI)
pnpm db:push       # Push schema changes to database
pnpm db:generate   # Generate migrations
pnpm db:migrate    # Run migrations
```

## Project Structure

```
src/
  app/                    # Next.js App Router
    shop/                 # Public storefront
    admin/                # Protected admin area (Clerk auth required)
      @modal/             # Parallel routes for modal overlays
      _components/        # Admin-specific components
    _context/             # React Context providers (form state)
    api/uploadthing/      # UploadThing file upload API
  server/
    db/                   # Drizzle schema and config
      schema.ts           # Database tables (zfweb_ prefix)
      index.ts            # DB connection
    queries.ts            # Server-only database queries
  components/ui/          # Shared UI components (shadcn pattern)
  lib/utils.ts            # cn() utility (clsx + tailwind-merge)
  utils/uploadthing.ts    # UploadThing React helpers
  middleware.ts           # Clerk auth middleware
```

## Key Patterns

- **Server Components:** Default for data fetching; use `await db.query` directly
- **Client Components:** Mark with `"use client"` for interactivity
- **Server Actions:** Use `"use server"` directive for mutations
- **Force-Dynamic:** Add `export const dynamic = "force-dynamic"` for fresh DB queries
- **Imports:** Use `~/` alias for src directory (e.g., `import { db } from "~/server/db"`)

## UI Change Guidelines

**Only modify the specific UI elements that are requested.** Do not make changes to surrounding or related elements to achieve the requested change.

Examples:
- If asked to make text visible: change the text color, NOT the background color
- If asked to fix a button: change the button, NOT the container it's in
- If asked to adjust spacing: change the spacing, NOT the element sizes

This applies to all styling properties: colors, backgrounds, borders, sizes, fonts, spacing, etc. Stay focused on the exact element and property requested.

## Database

Tables use `zfweb_` prefix. Key tables: `product`, `product_category`, `order`, `customer`, `cart_item`.

Schema: `src/server/db/schema.ts`

## Environment Variables

Required in `.env`:

- `DATABASE_URL` - Neon PostgreSQL connection string
- Clerk keys (see Clerk dashboard)
- UploadThing keys (see UploadThing dashboard)

## Additional Documentation

Check these files for detailed patterns and conventions:

| Document                                 | When to Reference                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `.claude/docs/development_workflow.md`   | **Start here for any feature work.** Phased development, branching, testing, PR creation                     |
| `.claude/docs/architectural_patterns.md` | Adding features, understanding code organization, server/client patterns, modal implementation, file uploads |
| `.claude/lessons/`                       | Learning documentation - lessons created after each PR explaining what was built and why                     |
| `src/__tests__/`                         | Unit tests - see existing tests for patterns on mocking and test structure                                   |

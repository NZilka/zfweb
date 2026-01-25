# Lesson: shadcn/ui Component Installation

## What We Built
Installed shadcn/ui components needed for the admin dashboard: tabs, card, table, dialog, checkbox, badge, select, calendar, popover, dropdown-menu, separator, and sonner (toast notifications).

## Why This Approach

**shadcn/ui philosophy:** Unlike traditional component libraries, shadcn/ui copies component source code into your project. This gives you:
- Full control over component styling and behavior
- No external dependency version conflicts
- Easy customization without fighting library defaults

**Component-by-component installation:** Each component is added individually with `pnpm dlx shadcn@latest add <component>`. This keeps bundle size minimal by only including what you need.

## Key Concepts

- **Radix UI primitives**: shadcn/ui builds on Radix UI for accessibility and behavior
- **Tailwind styling**: Components use Tailwind CSS for styling
- **CVA (Class Variance Authority)**: Used for component variants (e.g., button sizes)

## Code Walkthrough

```bash
# Installation commands
pnpm dlx shadcn@latest add tabs
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add sonner  # Toast notifications
```

Components are installed to `src/components/ui/`:
```
src/components/ui/
  tabs.tsx      # Tab navigation
  card.tsx      # Card containers
  table.tsx     # Data tables
  dialog.tsx    # Modal dialogs
  badge.tsx     # Status badges
  ...
```

**Sonner setup in layout:**
```tsx
// src/app/layout.tsx
import { Toaster } from "~/components/ui/sonner";

// In the body
<Toaster />
```

## Testing Strategy
Visual testing by running `pnpm dev` and verifying components render correctly. Components are integration-tested through the features that use them.

## What You Learned
- The shadcn/ui approach of owning your components
- How Radix UI provides accessibility out of the box
- Setting up toast notifications with Sonner

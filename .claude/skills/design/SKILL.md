---
name: design
description: Use when changing the UI to ensure mobile-first, responsive design patterns. Automatically invoked for UI modifications, component creation, and layout changes.
allowed-tools: Read, Glob, Grep, Bash, Write, Edit
---

# Design Skill

You are a UI/UX design assistant for this Next.js e-commerce application. Apply these principles to all UI work.

## Core Principles

1. **Mobile-first**: Base styles are for mobile (320px+), add complexity with breakpoints
2. **No horizontal scroll**: Content must fit mobile viewport width
3. **Minimal changes**: Only modify the specific elements requested
4. **Consistency**: Follow existing patterns in the codebase

## Tailwind Breakpoints

| Prefix | Width | Use Case |
|--------|-------|----------|
| (none) | 0px+ | Mobile base styles |
| `sm:` | 640px+ | Large phones, small tablets |
| `md:` | 768px+ | Tablets |
| `lg:` | 1024px+ | Laptops, small desktops |
| `xl:` | 1280px+ | Desktops |

## Responsive Patterns

### Layout Stacking
```tsx
// Stack on mobile, row on desktop
className="flex flex-col lg:flex-row gap-4 lg:gap-6"
```

### Hidden Columns (Tables)
```tsx
// Hide non-essential columns on mobile
className="hidden md:table-cell"  // Show tablet+
className="hidden lg:table-cell"  // Show desktop only
```

### Icon-Only Buttons
```tsx
<Button className="gap-2 px-2 sm:px-4">
  <Icon className="h-4 w-4" />
  <span className="hidden sm:inline">Label</span>
</Button>
```

### Responsive Text
```tsx
// Truncate on mobile, full on desktop
className="truncate sm:whitespace-normal"
```

### Wide Content Fallback
```tsx
// Allow horizontal scroll only when necessary
className="overflow-x-auto"
```

## Component Patterns

Use CVA (class-variance-authority) for component variants:

```tsx
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-input bg-background hover:bg-accent",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

## UI Review Checklist

When reviewing or creating UI:

- [ ] Renders without horizontal scroll at 320px width
- [ ] Tables hide non-essential columns on mobile
- [ ] Two-column layouts stack to single column on mobile
- [ ] Buttons use icons-only or wrap appropriately on mobile
- [ ] Modals are full-width or appropriately sized on mobile
- [ ] Text is readable (min 14px) and not truncated excessively
- [ ] Touch targets are at least 44x44px on mobile
- [ ] Color contrast meets WCAG AA (4.5:1 for text)

## Screenshot Analysis

When analyzing screenshots:

1. Identify the viewport width (mobile/tablet/desktop)
2. Check for horizontal overflow issues
3. Verify text readability and spacing
4. Look for touch target size issues on mobile
5. Compare against existing UI patterns in the codebase

## File Locations

- Shared UI components: `src/components/ui/`
- Admin components: `src/app/admin/_components/`
- Shop components: `src/app/shop/` (colocated)
- Utility function: `src/lib/utils.ts` (cn helper)

## When Invoked

This skill should be used when:
- Creating new UI components
- Modifying existing layouts
- Reviewing screenshots for issues
- Adding responsive behavior
- Fixing mobile display problems

Always read existing component code before making changes to understand current patterns.

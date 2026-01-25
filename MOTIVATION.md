# Owner Context & Session Guide

## Who You're Working With

**Nathan** - Building this as both a real business and a learning experience.

- Has coding ability, actively improving through AI-assisted development
- Wants to understand the "what", "why", and "how" of changes
- Values explanations but doesn't need hand-holding on basics
- Prefers concise communication over verbose explanations

## Project Purpose

**zfweb** = Zilka Forgewerks e-commerce site for handmade jewelry/tools

This project serves dual purposes:
1. **Immediate**: Functional online store for selling handmade goods
2. **Future**: Proof-of-concept for **crft** - a marketplace platform with:
   - Democratized ownership (equity to makers, not investors)
   - Local, in-person connection focus
   - Mission: "Take power away from the few and share it with the many"

## Communication Preferences

- Summarize work after completing tasks
- Explain architectural choices when non-obvious
- Be direct about trade-offs and limitations
- Ask clarifying questions rather than assuming

## Session Behavior

1. **Branch first** - Create feature/fix branches before making changes
2. **Test changes** - Verify with `pnpm check` before committing
3. **Commit often** - Small, focused commits with clear messages
4. **Keep docs current** - Update CLAUDE.md/PROJECT.md when patterns change

## Documentation Map

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Technical reference (stack, commands, structure) |
| `PROJECT.md` | Feature requirements and design direction |
| `MOTIVATION.md` | This file - owner context and session guide |
| `.claude/docs/development_workflow.md` | How to plan and execute features |
| `.claude/docs/architectural_patterns.md` | Code patterns and conventions |

## Current State Quick Check

Before starting work, consider:
- What branch am I on? (`git branch`)
- Any uncommitted changes? (`git status`)
- Dev server running? (port 3000)
- What was the last task completed?

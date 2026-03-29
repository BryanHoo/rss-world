# Component Guidelines

> How components are built in this project.

---

## Overview

This project uses React function components with a clear split between:

- route-level shells in `src/app`
- feature components in `src/features/*`
- reusable primitives in `src/components/ui`

Feature components are allowed to contain substantial behavior, but repeated UI
building blocks should move into `src/components/ui` or feature-local helper files.

---

## Component Structure

Typical structure:

1. Imports
2. Top-level constants and helper functions
3. Props interface or local types
4. Component function
5. Local callbacks, effects, and derived state
6. JSX return

Patterns already used in this repo:

- Hoist large class name strings and timing constants to the top of the file
- Keep file-local helper functions outside the component body
- Use small typed props interfaces even for route shells
- Default optional props through parameter defaults instead of extra wrapper logic

Examples:

- `src/app/(reader)/ReaderApp.tsx`
- `src/features/articles/ArticleList.tsx`
- `src/features/articles/ArticleView.tsx`

---

## Props Conventions

- Use an explicit `Props` interface or a clearly named local type
- Use optional props for shell-level customization points
- Prefix event callbacks with `on`
- Keep file-local prop types local unless they are shared across modules
- Import shared domain types from `src/types` with `import type`

Examples:

- `ReaderAppProps` in `src/app/(reader)/ReaderApp.tsx`
- `ArticleListProps` in `src/features/articles/ArticleList.tsx`
- `ArticleViewProps` in `src/features/articles/ArticleView.tsx`

For shared primitives, the repo commonly composes existing element props:

- `src/components/ui/button.tsx` uses `React.ComponentPropsWithoutRef<'button'>`
- `src/components/ui/button.tsx` combines those props with `VariantProps`

---

## Styling Patterns

The styling stack is Tailwind-first.

Preferred patterns:

- Use utility classes directly for short styles
- Hoist long or repeated class strings into top-level constants
- Use `cn` for conditional composition
- Use `cva` for shared primitive variants
- Put reusable visual tokens in `src/lib/designSystem.ts`

Examples:

- `src/components/ui/button.tsx` for `cva`-based variants
- `src/lib/designSystem.ts` for shared class-name tokens
- `src/features/articles/ArticleView.tsx` for hoisted long surface class strings

When a shared look already exists, reuse that token or primitive instead of
rebuilding a slightly different version inside a feature.

---

## Accessibility

The repo leans on Radix primitives for accessible foundations. Preserve that
approach when building shared components.

Required habits:

- Prefer existing Radix-based wrappers from `src/components/ui`
- Keep dialog titles, descriptions, labels, and button names present
- Provide `aria-label` for icon-only controls or switches when visible text is absent
- Use semantic interactive elements instead of clickable `div`s

Examples:

- `src/components/ui/dialog.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/ui-smoke.test.tsx`

---

## Common Mistakes

- Do not copy a long `className` block into multiple files when a constant or
  shared primitive would do
- Do not fetch directly inside a presentational leaf component if `src/lib/apiClient.ts`
  or a store action already owns that API boundary
- Do not import an entire Zustand store state object when only a few selectors are needed
- Do not create a shared UI primitive in `src/components/ui` if only one feature uses it

---

## Good Reference Files

- `src/components/ui/button.tsx`
- `src/app/(reader)/ReaderApp.tsx`
- `src/features/articles/ArticleView.tsx`

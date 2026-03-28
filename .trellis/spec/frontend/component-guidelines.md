# Component Guidelines

> How React components are built in FeedFuse.

---

## Overview

FeedFuse favors small, explicit components with business logic pulled into feature hooks or stores.

The common shape is:

1. A feature container component owns orchestration
2. A presentational child renders the form or surface
3. A feature hook manages derived state, validation, and async actions

Examples:

- `src/features/feeds/FeedDialog.tsx`
- `src/features/feeds/FeedDialogForm.tsx`
- `src/features/feeds/useFeedDialogForm.ts`

---

## Component Structure

### Feature containers

Feature containers compose shared UI primitives, feature hooks, and feature-local children.

Example patterns:

- `src/features/feeds/FeedDialog.tsx` maps `mode` to metadata, calls `useFeedDialogForm`, then passes a focused prop set into `FeedDialogForm`
- `src/features/reader/ReaderLayout.tsx` coordinates layout state, global shortcuts, and store selectors, while delegating article/feed panes to child components
- `src/app/(reader)/ReaderApp.tsx` stays as a shell that wires stores, theme hydration, and top-level feature surfaces

### Presentational children

Presentational children should receive prepared values and callbacks instead of re-deriving everything themselves.

Example:

- `src/features/feeds/FeedDialogForm.tsx` receives `title`, `url`, `canSave`, error strings, and callbacks from the hook rather than fetching or validating on its own

---

## Props Conventions

- Define a dedicated `interface ...Props` or `type ...Props` directly above the component
- Type refs and event handlers explicitly when the component exposes them
- Prefer object-shaped props over positional arguments or overloaded signatures
- Export the primary component as the default export for feature files unless there is a clear reason not to

Examples:

- `src/features/feeds/AddFeedDialog.tsx`
- `src/features/reader/ReaderLayout.tsx`
- `src/components/ui/button.tsx`

---

## Styling Patterns

FeedFuse uses Tailwind utility classes, shared CSS theme tokens, and class composition helpers.

Rules:

- Reuse shared primitives from `src/components/ui/` before creating feature-local button/input/dialog implementations
- Reuse shared class constants from `src/lib/designSystem.ts` when a surface pattern already exists
- Use `cn(...)` for conditional class composition
- Use `cva(...)` for reusable variant-driven primitives

Examples:

- `src/components/ui/button.tsx` uses `cva` and `VariantProps`
- `src/features/reader/ReaderLayout.tsx` reuses `FROSTED_HEADER_CLASS_NAME` and other layout constants from `src/lib/designSystem.ts`
- `src/app/globals.css` defines the shared theme tokens consumed by components

---

## Accessibility

Accessibility is implemented explicitly in component markup.

Required patterns:

- Connect form fields to `Label`
- Generate stable `id`, `aria-describedby`, and `aria-errormessage` values for interactive forms
- Use `role="alert"` for blocking validation messages and `role="status"` / polite live regions for non-blocking status
- Provide dialog labels and close labels for modal surfaces

Examples:

- `src/features/feeds/FeedDialogForm.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/ui-smoke.test.tsx`

---

## Common Mistakes

- Do not put business fetch or mutation logic inside `src/components/ui/`
- Do not bypass shared primitives with ad-hoc buttons, inputs, or dialogs inside feature code unless the primitive is missing a needed capability
- Do not ship unlabeled inputs, dialogs, or icon-only controls
- Do not keep expanding route shell components when the logic belongs in a feature module or store

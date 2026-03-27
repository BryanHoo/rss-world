# Component Guidelines

> How React components are built in FeedFuse.

---

## Overview

Most feature components are composition layers: they read state from a store or
feature hook, derive small pieces of UI state, and render shared primitives
from `src/components/ui/`.

Keep responsibilities split:

- route entrypoints in `src/app/`
- feature composition in `src/features/`
- reusable primitives in `src/components/ui/`

Do not hide data fetching, global side effects, and styling conventions inside
random leaf components.

This repo prefers explicit ownership over clever abstractions. When a component
starts to own form state, async workflows, and transport mapping at the same
time, move those responsibilities into a hook, store action, or helper module.

---

## Component Structure

A typical feature component file follows this order:

1. imports
2. local constants
3. props interface / local helper types
4. component implementation
5. small local helpers when they are only used by that component

Patterns used in the repo:

- `FeedDialog.tsx` keeps static metadata maps near the top and delegates state
  logic to `useFeedDialogForm`
- `ReaderLayout.tsx` owns layout-specific interaction state, but shared panes
  are separate components
- `ToastHost.tsx` is a thin host around `toastStore` and Radix primitives

Main feature components commonly use a default export. Shared primitives usually
use named exports.

For larger components, keep static configuration near the top of the file:

- metadata maps such as `MODE_META` or tone-to-class maps
- local constants for layout or state labels
- small helper render components when they are tightly coupled to the file

Examples:

- `FeedDialog.tsx` keeps `MODE_META` and `VALIDATION_STATE_META` above the
  component
- `ToastHost.tsx` keeps tone class maps local because they only serve toast UI

---

## Ownership Rules

Use a component file for composition and rendering, not transport parsing.

Good ownership:

- `ReaderLayout.tsx` coordinates feature panes, responsive layout state, and
  top-level dialogs
- `FeedDialog.tsx` composes dialog chrome plus form hook output
- `ToastHost.tsx` bridges store state into Radix toast primitives

Move logic out of the component when:

- request orchestration can be reused or makes render logic hard to scan
- field validation and submit state dominate the file
- local helper logic is better tested independently

Prefer these destinations:

- feature hook for stateful UI workflows
- store action for shared snapshot or app-wide state changes
- `src/lib/apiClient.ts` for transport details
- `src/lib/designSystem.ts` for repeated layout or surface class strings

---

## Props Conventions

- Define a dedicated `*Props` interface next to the component
- Use precise unions for mode/state props instead of loose strings
- Prefer callback props with explicit payload types
- Mark optional props explicitly and provide safe defaults in the function
  signature when useful

Examples:

- `ReaderLayoutProps` in `src/features/reader/ReaderLayout.tsx`
- `FeedDialogProps` in `src/features/feeds/FeedDialog.tsx`
- `ReaderPageProps` in `src/app/(reader)/page.tsx`

When a component needs a large, behavior-heavy API, move that behavior into a
hook or helper module instead of expanding the prop surface indefinitely.

Prefer passing already-normalized values into leaf components instead of
teaching every presentational component how to interpret raw server or store
state.

---

## Styling Patterns

FeedFuse styles components with Tailwind utility classes, semantic theme tokens,
and a small set of shared class-name constants.

Required patterns:

- Use `cn(...)` from `src/lib/utils.ts` to merge conditional class names
- Reuse shared layout constants from `src/lib/designSystem.ts` when the same
  surface/layout class is used in multiple places
- Prefer semantic tokens such as `bg-background`, `text-success`, `border-error`
  instead of palette-specific classes
- Keep repeated visual rules in `src/components/ui/` or `src/lib/designSystem.ts`
  instead of copying long strings across features

Examples:

- `src/components/ui/button.tsx` uses `cva` for reusable variants
- `src/features/toast/ToastHost.tsx` maps tone to semantic token classes
- `src/features/reader/ReaderLayout.tsx` imports shared layout class constants
- `src/features/feeds/FeedDialog.tsx` reuses `DIALOG_FORM_CONTENT_CLASS_NAME`
  instead of repeating dialog width classes

Do not introduce raw `bg-white`, `text-red-500`, `shadow-md`, or similar values
when a semantic token already exists.

If the same class string appears across multiple files, extract it before
copying it a third time.

---

## Accessibility

Interactive components in this repo are expected to keep accessible labels,
focus management, and semantic roles.

Observed patterns:

- `src/app/layout.tsx` includes a skip link to `#main-content`
- `src/features/feeds/FeedDialog.tsx` passes `closeLabel`, `DialogTitle`, and
  `DialogDescription`
- `src/features/toast/ToastHost.tsx` uses `role="alert"` for error toasts and
  `role="status"` for non-error toasts
- `src/features/reader/ReaderLayout.tsx` uses sheet title/description and
  keyboard-friendly controls

Always preserve:

- visible or screen-reader-accessible labels
- focus-visible styles
- correct button semantics for clickable controls
- dialog title/description when using modal primitives
- close labels for dismissible surfaces
- status roles for asynchronous notifications

---

## Client Boundary Rules

Only mark a file with `'use client'` when it actually needs browser-only React
capabilities such as state, effects, refs, or DOM APIs.

Patterns in this repo:

- feature shells like `ReaderApp.tsx` and `ToastHost.tsx` are client components
- pure route wrappers and metadata files remain server-safe
- shared UI primitives may be client components when they wrap interactive
  Radix primitives

Do not add `'use client'` to an entire route tree when only one child component
needs it.

---

## Common Mistakes

- Putting API calls directly into shared UI primitives instead of feature hooks,
  stores, or `apiClient`
- Copying one-off Tailwind strings instead of extracting shared class constants
- Replacing semantic tokens with raw color utilities that break light/dark theme
  contracts
- Skipping `closeLabel`, `aria-label`, or dialog descriptions on interactive
  surfaces
- Expanding one component until it owns form state, request logic, and layout
  variants that should have been split into smaller modules
- Passing store state deeply through props when the owning subtree can read a
  narrow selector directly

# Directory Structure

> How frontend code is organized in this project.

---

## Overview

This project uses a feature-oriented `src/` layout on top of Next.js App Router.
Routing entrypoints live in `src/app`, but most product logic lives in
feature folders such as `src/features/articles` or `src/features/settings`.

The main rule is:

- Put route entrypoints in `src/app`
- Put reusable primitives in `src/components/ui`
- Put domain-specific UI, helpers, and feature hooks next to the feature
- Put cross-feature client state in `src/store`
- Put shared domain types in `src/types`
- Put server-only logic in `src/server`

Document current reality, not an idealized architecture. This repo already mixes
client UI, App Router handlers, worker code, and server modules under `src/`.
Follow the existing boundaries instead of inventing a new top-level layout.

---

## Directory Layout

```text
src/
├── app/                 # Next.js route entrypoints and app/api handlers
├── components/ui/       # Shared UI primitives and wrappers
├── features/            # Feature-owned UI, hooks, models, helpers
├── hooks/               # Cross-feature hooks
├── lib/                 # Shared client-safe helpers and API wrappers
├── store/               # Zustand stores and shared client state
├── types/               # Shared domain types
├── utils/               # Small generic helpers
├── data/                # Data provider contracts and mocks
├── server/              # Server-only services, repos, route support
├── worker/              # Background worker entrypoints and jobs
└── test/                # Shared test helpers and mocks
```

---

## Module Organization

### App Router Shells

Use `src/app` for route entrypoints and API routes only. Keep route files thin and
push reusable logic into `features`, `lib`, or `server`.

Examples:

- `src/app/(reader)/ReaderApp.tsx`
- `src/app/api/reader/snapshot/route.ts`
- `src/app/api/articles/[id]/route.ts`

### Feature Folders

Feature directories are the primary place for product code. A feature folder may
contain:

- React components
- Feature-local hooks
- Local view models or helper functions
- Tests for that feature

Examples:

- `src/features/articles/ArticleList.tsx`
- `src/features/articles/ArticleView.tsx`
- `src/features/feeds/useAiDigestDialogForm.ts`

If code is specific to one product area, keep it in that feature folder even if it
is not a React component.

### Shared UI Primitives

Use `src/components/ui` for reusable, design-system-like building blocks shared by
multiple features. These files usually wrap Radix primitives, apply project
styling, and export stable building blocks.

Examples:

- `src/components/ui/button.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/select.tsx`

### Shared State and Helpers

- `src/store` contains Zustand stores such as `appStore` and `settingsStore`
- `src/lib` contains cross-feature helpers such as `apiClient`, `designSystem`,
  and domain utilities
- `src/hooks` contains hooks reused across features instead of one feature only
- `src/types` contains shared domain models consumed across client and server

---

## Naming Conventions

- React components use `PascalCase.tsx`
- Feature hooks use `useSomething.ts`
- Zustand stores use `somethingStore.ts`
- Tests are colocated and end with `.test.ts` or `.test.tsx`
- Shared helpers use descriptive camelCase file names such as `apiClient.ts` or
  `mapApiErrorToUserMessage.ts`

Current codebase note:

- Import style is mixed between relative imports and the `@/*` alias
- Formatting style is not fully uniform across all files

When editing existing files, match the local style of that file unless there is a
strong reason to normalize a whole area.

---

## Examples

### Reader Entry Composition

`src/app/(reader)/ReaderApp.tsx`

- Keeps the route shell small
- Wires shared hooks and stores at the entry boundary
- Delegates layout and domain UI to `features`

### Feature-Scoped Article Module

`src/features/articles/ArticleList.tsx`

- Owns feature UI, derived state helpers, notifications, and list behavior
- Imports shared UI primitives from `@/components/ui/*`
- Keeps article-specific helpers adjacent to the feature

### Shared Primitive Layer

`src/components/ui/button.tsx`

- Wraps a reusable primitive once
- Centralizes styling and variant rules
- Avoids duplicating base button behavior across features

---

## Anti-Patterns

- Do not put feature-specific logic into `src/components/ui`
- Do not create new top-level directories for one-off code when an existing area
  already owns that concern
- Do not keep route handlers fat if the logic can live in `src/server`
- Do not scatter the same feature logic across `app`, `lib`, and `components`
  without a clear ownership boundary

# Directory Structure

> How frontend code is organized in FeedFuse.

---

## Overview

The codebase uses a layered `src/` structure instead of putting everything under routes.

Use these placement rules:

1. Keep App Router files small and route-oriented
2. Put product behavior under `src/features/<feature>/`
3. Put reusable primitives under `src/components/ui/`
4. Put cross-feature state under `src/store/`
5. Put shared client helpers and API access under `src/lib/`

---

## Directory Layout

```text
src/
├── app/              # Next.js routes, layouts, and API handlers
├── components/ui/    # reusable UI primitives
├── features/         # feature modules and local components/hooks/services
├── hooks/            # cross-feature hooks only
├── lib/              # shared client utilities, API client, design system constants
├── store/            # Zustand stores
├── test/             # test setup and test-only mocks
├── types/            # shared domain types
└── utils/            # low-level utilities
```

---

## Module Organization

### Route layer

`src/app/` should only host route entry files, layout files, and API handlers.

Examples:

- `src/app/(reader)/page.tsx`
- `src/app/(reader)/ReaderApp.tsx`
- `src/app/api/articles/search/route.ts`

Do not grow route files into full feature modules. Move reusable behavior into `src/features/`, `src/store/`, or `src/lib/`.

### Feature layer

Feature code lives in `src/features/<feature>/` and usually keeps related pieces together:

- container components
- form/body components
- custom hooks
- feature-local services
- feature-local types
- colocated tests

Examples:

- `src/features/feeds/FeedDialog.tsx`
- `src/features/feeds/FeedDialogForm.tsx`
- `src/features/feeds/useFeedDialogForm.ts`
- `src/features/feeds/feedDialog.types.ts`
- `src/features/feeds/useFeedDialogForm.test.ts`

### Shared UI layer

`src/components/ui/` is reserved for reusable primitives that are not feature-specific.

Examples:

- `src/components/ui/button.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/switch.tsx`

If a component depends on feed/article/settings business rules, it does not belong here.

### State and shared helpers

- `src/store/` holds cross-feature client state such as reader selection and settings persistence
- `src/lib/` holds API access, utility helpers, and design system constants
- `src/hooks/` is only for hooks shared across multiple features

Examples:

- `src/store/appStore.ts`
- `src/store/settingsStore.ts`
- `src/lib/apiClient.ts`
- `src/lib/designSystem.ts`
- `src/hooks/useTheme.ts`

---

## Naming Conventions

- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utilities and helpers: `camelCase.ts`
- Feature-local type files: `*.types.ts`
- Tests: `*.test.ts` or `*.test.tsx`, next to the source file when possible

Examples:

- `src/features/reader/ReaderLayout.tsx`
- `src/features/articles/useStreamingAiSummary.ts`
- `src/features/feeds/feedDialog.types.ts`
- `src/features/reader/ReaderLayout.test.tsx`

---

## Examples

Use these modules as references when creating new code:

- `src/features/feeds/`: good example of container + form + hook + types split
- `src/features/settings/`: good example of larger feature folders with nested panels
- `src/components/ui/`: good example of reusable primitives separated from business logic

---

## Anti-Patterns

- Do not add feature-specific components under `src/components/ui/`
- Do not move shared domain types into individual component files when they are used across features
- Do not put durable business logic directly in `src/app/(reader)/ReaderApp.tsx` or route files

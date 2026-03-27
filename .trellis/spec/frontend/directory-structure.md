# Directory Structure

> How frontend code is actually organized in FeedFuse.

---

## Overview

The frontend uses the Next.js App Router, but most product code lives outside
`src/app/`. Route files stay thin and hand off to feature modules under
`src/features/`.

Keep these responsibilities separate:

- `src/app/`: route entrypoints, layouts, global CSS, metadata, thin client
  entry shells, and API route handlers
- `src/features/`: product-facing feature modules with colocated components,
  hooks, helpers, services, and tests
- `src/components/ui/`: reusable UI primitives built on Radix + Tailwind
- `src/store/`: shared Zustand stores
- `src/lib/`: shared client-side helpers such as `apiClient`, styling helpers,
  reusable policies, and mapping utilities
- `src/hooks/`: cross-feature hooks that are not owned by a single feature
- `src/types/`: shared domain types used across app, stores, and API mapping
- `src/test/`: shared test setup and mocks

Do not put feature UI directly under `src/app/` unless it is truly route-only.

Two files define the default boot path:

- `src/app/(reader)/page.tsx`: route param normalization only
- `src/app/(reader)/ReaderApp.tsx`: client bootstrapping for theme, hydration,
  snapshot loading, and top-level shells

---

## Directory Layout

```text
src/
├── app/
│   ├── (reader)/
│   ├── api/
│   ├── globals.css
│   └── layout.tsx
├── components/
│   └── ui/
├── features/
│   ├── articles/
│   ├── feeds/
│   ├── reader/
│   ├── settings/
│   ├── toast/
│   └── notifications/
├── hooks/
├── lib/
├── store/
├── test/
├── types/
└── utils/
```

Server-only code lives in `src/server/` and job runners live in `src/worker/`.
Do not mix those files into feature UI folders.

---

## Module Organization

Feature folders are the default unit of organization. A feature usually owns:

- one or more top-level UI components
- feature-specific hooks
- small helper modules
- colocated tests
- optional feature-local `services/` folders when the behavior is still owned by
  that feature

Examples:

- `src/features/feeds/` contains dialog components, form hooks, local types, a
  feature-specific service, and tests
- `src/features/articles/` contains the main article view, rendering helpers,
  streaming hooks, and export helpers
- `src/features/settings/panels/` groups sub-panels under the settings feature

Shared building blocks move out only when they are reused across multiple
features:

- primitives to `src/components/ui/`
- global state to `src/store/`
- app-wide helpers to `src/lib/`
- cross-feature hooks to `src/hooks/`

Do not create a new top-level folder for one feature just to avoid colocating
code. Start inside the owning feature and extract only when reuse is proven.

---

## Route File Responsibilities

Files inside `src/app/` should do only framework-facing work:

- define `page.tsx`, `layout.tsx`, metadata, and route groups
- normalize `searchParams` or route params into domain-safe values
- hand off rendering to feature or app entry components
- keep server/client boundaries explicit with `'use client'`

Examples:

- `src/app/(reader)/page.tsx` converts incoming search params and passes
  `initialSelectedView`
- `src/app/layout.tsx` owns global metadata, global CSS, and the skip link
- `src/app/(reader)/ReaderApp.tsx` is the client entrypoint, but still keeps
  product behavior delegated to `ReaderLayout`, stores, and hooks

Do not move feature-local markup trees, request helpers, or business workflows
into route files.

---

## Naming Conventions

- Use `PascalCase.tsx` for React components:
  `ReaderLayout.tsx`, `FeedDialog.tsx`, `ToastHost.tsx`
- Use `use*.ts` for hooks:
  `useTheme.ts`, `useFeedDialogForm.ts`, `useStreamingAiSummary.ts`
- Use `*.types.ts` for feature-local type-only modules:
  `feedDialog.types.ts`
- Use `*Store.ts` for Zustand stores:
  `appStore.ts`, `settingsStore.ts`, `toastStore.ts`
- Use `*.test.ts` and `*.test.tsx` for behavior tests
- Use `*.contract.test.ts` for source-level contracts that guard tokens or
  structure
- Follow Next.js file conventions inside `src/app/`:
  `page.tsx`, `layout.tsx`, `route.ts`

When a feature needs helper modules, use descriptive names that show ownership:

- `services/` for feature-owned request or validation helpers
- `*.types.ts` for feature-local type modules
- `*.utils.ts` for small pure helpers tied to the feature
- `panels/`, `logs/`, or similar subfolders when the feature has clear
  subdomains

Prefer singular, domain-specific names over generic folders like `common` or
`misc`.

---

## Test Placement

Tests stay close to the code they guard:

- feature behavior tests live beside the feature files:
  `src/features/reader/ReaderLayout.test.tsx`
- store tests live beside the store:
  `src/store/appStore.test.ts`
- shared UI contract tests live beside or near the primitives they protect:
  `src/components/ui/popup-surface.contract.test.ts`
- app-level source contracts can live under `src/app/`:
  `src/app/theme-token-usage.contract.test.ts`

Do not create a separate frontend-only test directory for product code that is
already naturally owned by a feature or shared module.

---

## Examples

- `src/app/(reader)/page.tsx`: route entry that normalizes search params and
  forwards to `ReaderApp`
- `src/app/(reader)/ReaderApp.tsx`: client entrypoint that wires theme,
  hydration, snapshot loading, and top-level shells
- `src/features/feeds/`: good example of colocating component, hook, types,
  service, and tests in one feature
- `src/components/ui/button.tsx`: shared primitive with no product-specific
  behavior
- `src/store/settingsStore.ts`: global state that is shared by multiple
  features and persisted

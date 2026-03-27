# Frontend Development Guidelines

> Project-specific frontend conventions for FeedFuse.

---

## Overview

The frontend is implemented with the Next.js App Router, feature modules under
`src/features/`, shared UI primitives in `src/components/ui/`, and Zustand
stores for shared state.

Write frontend code to match the current layering:

- route files in `src/app/` stay thin and hand off to feature modules
- feature modules own composition, interaction logic, and feature-local helpers
- shared primitives in `src/components/ui/` stay generic and style-system aware
- transport logic flows through `src/lib/apiClient.ts`
- shared app state lives in Zustand stores under `src/store/`

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | File ownership, feature folders, route boundaries | Filled |
| [Component Guidelines](./component-guidelines.md) | Component composition, props, styling, accessibility | Filled |
| [Hook Guidelines](./hook-guidelines.md) | Custom hook ownership, effect cleanup, async workflows | Filled |
| [State Management](./state-management.md) | Local state, Zustand boundaries, URL and persisted state | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Lint, tests, token contracts, review expectations | Filled |
| [Type Safety](./type-safety.md) | Shared types, normalization, transport boundaries | Filled |

---

## Pre-Development Checklist

Read these files before writing frontend code:

- Any new feature UI or route composition:
  [Directory Structure](./directory-structure.md) and
  [Component Guidelines](./component-guidelines.md)
- Any custom hook, effect, async browser workflow, or form logic:
  [Hook Guidelines](./hook-guidelines.md)
- Any shared or persisted state change:
  [State Management](./state-management.md) and
  [Type Safety](./type-safety.md)
- Any change that touches request/response mapping or browser-side validation:
  [Type Safety](./type-safety.md)
- Before finishing frontend work:
  [Quality Guidelines](./quality-guidelines.md)

If the change crosses frontend/backend or request/worker boundaries, also read
[../guides/cross-layer-thinking-guide.md](../guides/cross-layer-thinking-guide.md).

---

## Concrete Examples In This Repo

- Route entry + client handoff: `src/app/(reader)/page.tsx`,
  `src/app/(reader)/ReaderApp.tsx`
- Feature composition and responsive layout:
  `src/features/reader/ReaderLayout.tsx`
- Dialog composition + feature hook split:
  `src/features/feeds/FeedDialog.tsx`,
  `src/features/feeds/useFeedDialogForm.ts`
- Shared state and URL ownership:
  `src/store/appStore.ts`, `src/store/settingsStore.ts`
- Transport envelope parsing and DTO mapping:
  `src/lib/apiClient.ts`
- Source-level UI contracts:
  `src/app/theme-token-usage.contract.test.ts`,
  `src/components/ui/popup-surface.contract.test.ts`

---

**Language**: Keep frontend spec documentation in English so it stays
consistent with the rest of `.trellis/spec/`.

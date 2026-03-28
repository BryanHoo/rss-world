# Quality Guidelines

> Code quality standards for FeedFuse frontend work.

---

## Overview

Frontend changes are expected to preserve behavior, accessibility, and test coverage.

Baseline verification commands:

- `pnpm lint`
- `pnpm type-check`
- `pnpm test`

Current tooling comes from:

- `package.json`
- `eslint.config.js`
- `vitest.config.ts`

---

## Forbidden Patterns

- Do not skip `src/lib/apiClient.ts` and call route URLs ad hoc from random components
- Do not add feature business logic into `src/components/ui/`
- Do not leave async timers, listeners, or streams without cleanup
- Do not add untested behavior changes when the surrounding area already has colocated tests
- Do not introduce parallel data-fetch owners for the same state without a clear reason

---

## Required Patterns

- Match surrounding file formatting and import style
- Add or update colocated tests when behavior changes
- Keep route shells thin and move durable logic into features, hooks, stores, or shared helpers
- Reuse existing design tokens, UI primitives, and store patterns before inventing new ones
- Preserve accessibility wiring for labels, error text, dialog titles, and icon-only actions

Examples:

- `src/features/feeds/FeedDialogForm.tsx`
- `src/features/reader/ReaderLayout.tsx`
- `src/components/ui/ui-smoke.test.tsx`

---

## Testing Requirements

Vitest is split into two projects:

- `node` for server, worker, and route tests
- `jsdom` for React and browser-facing tests

Testing patterns in the repo:

- colocated `*.test.ts` / `*.test.tsx` files
- `@testing-library/react` for component and hook behavior
- `vi.mock(...)` at module boundaries
- focused assertions on user-observable behavior instead of implementation internals

Examples:

- `src/features/reader/GlobalSearchDialog.test.tsx`
- `src/features/articles/useStreamingAiSummary.test.ts`
- `src/app/api/settings/routes.test.ts`
- `src/test/setup.ts`

---

## Code Review Checklist

Before considering a frontend change ready, verify:

1. The file placement matches the structure in `directory-structure.md`
2. Components still use the shared UI and accessibility patterns in `component-guidelines.md`
3. Hooks and state ownership follow `hook-guidelines.md` and `state-management.md`
4. Shared types and runtime validation follow `type-safety.md`
5. `pnpm lint`, `pnpm type-check`, and the relevant tests have been run successfully

# Quality Guidelines

> Code quality standards for frontend development in FeedFuse.

---

## Overview

Frontend work in this repo is guarded by:

- `pnpm lint`
- `pnpm type-check`
- `pnpm test:unit`
- source-level contract tests for tokens and shared UI expectations

The project currently uses ESLint + TypeScript + React Hooks rules. There is no
Prettier configuration in the repo, so avoid style-only churn unless it serves a
real readability purpose.

---

## Forbidden Patterns

- Raw `fetch(...)` or ad-hoc transport handling in components when
  `src/lib/apiClient.ts` should own the request
- Hard-coded palette classes like `text-red-500`, `bg-white`, `shadow-md` in
  product UI that should be using semantic theme tokens
- Persisting secrets or backend-only values into browser storage
- Skipping cleanup for listeners, timers, and streams in effects
- Large refactors that only change quote style or whitespace without improving
  behavior or readability
- Adding untested source-level style or token changes when a contract test would
  catch regressions cheaply

---

## Required Patterns

- Use semantic Tailwind tokens defined in `src/app/globals.css`
- Use `cn(...)` for conditional class names
- Reuse shared class constants from `src/lib/designSystem.ts` when the same
  visual rule appears in multiple places
- Route network requests through `src/lib/apiClient.ts` or store actions
- Keep shared state in Zustand stores and read it with selectors
- Preserve accessibility labels, focus handling, and dialog semantics
- Keep test coverage close to the code being changed
- Add or update source-level contract tests when changing shared visual tokens or
  reusable primitives

Examples:

- `src/app/theme-token-usage.contract.test.ts` protects semantic token usage
- `src/features/toast/ToastHost.tsx` uses semantic colors and a11y roles
- `src/features/feeds/FeedDialog.tsx` wires dialog semantics and focus behavior
- `src/components/ui/popup-surface.contract.test.ts` prevents translucent popup
  regressions across shared primitives

---

## Testing Requirements

Tests are expected to stay close to the code they protect.

Current patterns:

- `*.test.tsx` for React behavior in jsdom
- `*.test.ts` for logic, stores, and request helpers
- `*.contract.test.ts` for source contracts and token/style guarantees

Vitest is split into two projects:

- `node` for server, worker, API route, and utility tests
- `jsdom` for React and browser-facing tests

Key configuration lives in `vitest.config.ts`:

- `src/test/setup.ts` provides browser test setup and polyfills
- `server-only` is aliased to a test mock for frontend-facing tests
- browser-facing tests run in `jsdom`, while backend and route tests stay in the
  `node` project

Before finishing frontend work, run the relevant subset at minimum and prefer
running the full `pnpm test:unit` for cross-cutting changes.

Suggested minimum verification by change type:

- component or hook behavior change:
  `pnpm test:unit -- <related test file>` or the nearest focused test
- shared styling token or UI primitive change:
  run the related `*.contract.test.ts` plus affected behavior tests
- store or request-path change:
  run the related store tests and `pnpm type-check`

---

## Review Expectations

Frontend reviews should check both behavior and ownership:

- does the code stay inside the right layer?
- does request logic stay in `apiClient`, stores, or a feature service?
- does the change preserve semantic tokens and accessibility behavior?
- is there one clear source of truth for shared state?
- does the test match the risk of the change?

---

## Code Review Checklist

- Does the code follow existing folder ownership instead of inventing a new
  structure?
- Are requests going through `apiClient`, store actions, or a clear feature
  service?
- Are theme tokens semantic and compatible with the contract tests?
- Are effects cleaned up correctly?
- Is shared state in the right store, with local state kept local?
- Is there a focused test covering the new behavior or regression?

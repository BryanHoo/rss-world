# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

The current quality baseline is enforced by:

- `pnpm lint`
- `pnpm type-check`
- `pnpm test:unit`

Tooling comes from `package.json`, `eslint.config.js`, Vitest, and Testing Library.
The repo currently enforces correctness and hook rules more strongly than code
formatting, so editors and agents should preserve surrounding file style when
touching existing files.

---

## Forbidden Patterns

- Do not ship behavior changes without updating or adding tests
- Do not call raw `fetch` from arbitrary client modules when `src/lib/apiClient.ts`
  already provides the API boundary
- Do not bypass shared error mapping and notification patterns for user-facing failures
- Do not modify shared constants or config values without searching for all usages first
- Do not add broad ignores or weaken TypeScript strictness to force code through

Examples that define the current quality bar:

- `src/lib/apiClient.ts`
- `src/lib/mapApiErrorToUserMessage.ts`
- `src/components/ui/popup-surface.contract.test.ts`

---

## Required Patterns

- Use `src/lib/apiClient.ts` for client HTTP access
- Keep tests close to the module they protect
- Prefer focused unit tests for stores, hooks, helpers, and route support logic
- Add smoke or contract tests for shared UI primitives when a regression could affect many screens
- Match the surrounding file style if the repo area is not fully normalized

Examples:

- store tests: `src/store/appStore.test.ts`, `src/store/settingsStore.test.ts`
- hook test: `src/hooks/useTheme.test.tsx`
- UI smoke and contract tests:
  `src/components/ui/ui-smoke.test.tsx`,
  `src/components/ui/popup-surface.contract.test.ts`

---

## Testing Requirements

Expect at least one of the following for behavior changes:

- unit test for stores, helpers, or route support logic
- component or hook test with Testing Library
- contract test when shared design-system behavior must stay locked

Current repo patterns:

- tests are usually colocated with the source file
- test files end with `.test.ts` or `.test.tsx`
- network boundaries are mocked explicitly
- store tests often import the store fresh after `vi.resetModules()`

Examples:

- `src/store/appStore.test.ts`
- `src/hooks/useTheme.test.tsx`
- `src/components/ui/ui-smoke.test.tsx`

---

## Code Review Checklist

- Does the change follow the owning directory boundary?
- Does client networking go through `src/lib/apiClient.ts` or an established store action?
- Are shared types reused instead of duplicated?
- Does the change keep accessibility expectations intact for dialogs, buttons, labels, and switches?
- Was `pnpm lint`, `pnpm type-check`, and the relevant `pnpm test:unit` scope run?
- If a shared token, helper, or constant changed, were all affected call sites reviewed?

---

## Good Reference Files

- `package.json`
- `eslint.config.js`
- `src/store/appStore.test.ts`

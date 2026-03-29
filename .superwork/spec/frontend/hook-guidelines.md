# Hook Guidelines

> How hooks are used in this project.

---

## Overview

Hooks in this repo fall into three groups:

- cross-feature browser or rendering hooks in `src/hooks`
- feature-local orchestration hooks inside `src/features/*`
- store hooks exposed by Zustand stores such as `useAppStore`

There is no React Query or SWR layer in the current codebase. Data fetching is
handled by store actions or explicit async logic in hooks and components.

---

## Custom Hook Patterns

Use a custom hook when you need to package stateful behavior, browser lifecycle
logic, or feature-specific async orchestration.

Current examples:

- `src/hooks/useTheme.ts`
  Applies the current theme and listens to system theme changes.
- `src/hooks/useRenderTimeSnapshot.ts`
  Stabilizes a render-time snapshot across server and client rendering.
- `src/features/feeds/useAiDigestDialogForm.ts`
  Owns form state, normalization, async loading, and submit flow for one feature.

Common implementation patterns in this repo:

- Export a named function
- Keep helper functions in the same file if they are hook-specific
- Return typed data and actions instead of unstructured tuples when logic grows
- Use cancellation flags inside async `useEffect` flows when stale completions are possible

---

## Data Fetching

The current project does not use a dedicated server-state library. Follow the
existing split instead:

- Use `src/lib/apiClient.ts` for client-side HTTP calls
- Put shared async state transitions in Zustand stores when multiple components need them
- Keep feature-local async flows inside feature hooks when the state is transient

Examples:

- `src/store/appStore.ts` owns snapshot loading and refresh actions
- `src/store/settingsStore.ts` owns settings hydration and persistence
- `src/features/feeds/useAiDigestDialogForm.ts` loads edit-mode defaults inside the hook

Do not call raw `fetch` from random client hooks when an `apiClient` helper already exists.

---

## Naming Conventions

- Hook file names start with `use`
- Hook names describe behavior, not implementation details
- Cross-feature hooks live in `src/hooks`
- Feature-specific hooks stay inside the owning feature folder

Examples:

- `useTheme`
- `useRenderTimeSnapshot`
- `useAiDigestDialogForm`

If the code is a pure helper with no React state or lifecycle usage, it should not
be a hook.

---

## Common Mistakes

- Do not turn a pure helper into a hook just because it is used by a component
- Do not duplicate API calls across multiple hooks if a store action already owns that flow
- Do not omit stale-request guards in async effects that can race with unmounts or input changes
- Do not put cross-feature hooks inside a feature folder unless the behavior is truly feature-specific

---

## Good Reference Files

- `src/hooks/useTheme.ts`
- `src/hooks/useRenderTimeSnapshot.ts`
- `src/features/feeds/useAiDigestDialogForm.ts`

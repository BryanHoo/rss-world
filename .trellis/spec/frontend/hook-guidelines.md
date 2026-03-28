# Hook Guidelines

> How hooks are used in FeedFuse.

---

## Overview

Custom hooks are used for reusable stateful client behavior, especially when the logic would otherwise bloat a feature component.

Prefer a custom hook when the code includes any combination of:

- async orchestration
- effect cleanup
- validation or derived status
- reusable event handling

---

## Custom Hook Patterns

### Placement

- Put cross-feature hooks in `src/hooks/`
- Put feature-specific hooks next to the feature that owns them

Examples:

- `src/hooks/useTheme.ts` is shared across the app shell
- `src/features/feeds/useFeedDialogForm.ts` is feature-specific and stays with the feed dialog
- `src/features/articles/useStreamingAiSummary.ts` stays inside the articles feature because it is tied to article summary behavior

### Return shape

Hooks usually return an object with named fields and actions instead of tuples.

Examples:

- `useFeedDialogForm` returns state, refs, error strings, and event handlers
- `useStreamingAiSummary` returns `loading`, `session`, `requestSummary`, and `clearTransientState`
- `useSettingsAutosave` returns `{ status }`

### Async safety

Long-lived hooks guard against stale async work with refs, tokens, and cleanup callbacks.

Examples:

- `src/features/articles/useStreamingAiSummary.ts` uses refs for the current article id, request token, timeout, and `EventSource`
- `src/hooks/useTheme.ts` cleans up the `matchMedia` listener
- `src/features/settings/useSettingsAutosave.ts` clears its timer in the effect cleanup

---

## Data Fetching

FeedFuse does not use React Query or SWR in the current frontend.

Current pattern:

1. API calls live in `src/lib/apiClient.ts`
2. Feature hooks or Zustand store actions call the API client
3. The hook/store owns loading flags, transient errors, and local caching behavior

Examples:

- `src/store/appStore.ts`
- `src/store/settingsStore.ts`
- `src/features/articles/useStreamingAiSummary.ts`

For testability, hooks may accept an optional `api` object so tests can inject fakes instead of mocking every dependency globally.

Example:

- `src/features/articles/useStreamingAiSummary.ts`

---

## Naming Conventions

- Hook files must start with `use`
- Hook names should describe the behavior, not the rendering location
- Cross-feature hooks should avoid embedding a single feature name unless they are truly feature-specific

Good examples:

- `useTheme`
- `useFeedDialogForm`
- `useStreamingAiSummary`
- `useSettingsAutosave`

---

## Common Mistakes

- Do not place a one-feature hook under `src/hooks/` just because it starts with `use`
- Do not start API requests directly inside deeply nested presentational components when the logic should be reusable
- Do not forget cleanup for timers, media listeners, or `EventSource`
- Do not return large anonymous tuples that become hard to read at the call site

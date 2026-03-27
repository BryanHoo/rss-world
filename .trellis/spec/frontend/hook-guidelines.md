# Hook Guidelines

> How hooks are used in FeedFuse.

---

## Overview

The project uses plain React hooks plus Zustand selectors. There is no React
Query or SWR layer today. Shared side effects and feature workflows are managed
with custom hooks, store actions, and `src/lib/apiClient.ts`.

Place hooks according to ownership:

- `src/hooks/` for cross-feature hooks
- `src/features/<feature>/` for feature-owned hooks

The default decision is "keep the hook close to the feature." Promote a hook to
`src/hooks/` only after it clearly serves multiple domains.

---

## Custom Hook Patterns

Use a custom hook when the logic is stateful, asynchronous, or hard to read
inline inside a component.

Common patterns in the repo:

- browser/environment synchronization:
  `src/hooks/useTheme.ts`
- form workflow hooks that expose field state and handlers:
  `src/features/feeds/useFeedDialogForm.ts`
- long-running async workflows that keep local state by entity id:
  `src/features/articles/useStreamingAiSummary.ts`
- debounced or delayed save behavior:
  `src/features/settings/useSettingsAutosave.ts`

Prefer returning an explicit object API over tuples when the hook has more than
one or two responsibilities.

Representative patterns:

- `useFeedDialogForm.ts` owns field state, validation state, focus management,
  and submit orchestration for one dialog family
- `useSettingsAutosave.ts` wraps timer-based persistence and exposes a small
  status API
- `useTheme.ts` is cross-feature because it synchronizes document-level theme
  state for the entire app

---

## Data Fetching

Frontend data fetching is mostly imperative.

- Shared request helpers live in `src/lib/apiClient.ts`
- Feature hooks call `apiClient` helpers directly when the workflow is local to
  one component tree
- App-wide server data is usually fetched through Zustand actions in
  `src/store/appStore.ts` and `src/store/settingsStore.ts`

Examples:

- `ReaderApp.tsx` triggers `loadSnapshot` and settings hydration through stores
- `useFeedDialogForm.ts` validates RSS URLs via a feature service and handles API
  field errors
- `useStreamingAiSummary.ts` coordinates enqueue, polling, and SSE lifecycle for
  AI summary generation
- `GlobalSearchDialog.tsx` performs a feature-local imperative request because
  the results are scoped to one dialog instance

Do not introduce ad-hoc `fetch(...)` calls in random components when an
`apiClient` helper or store action should own that request.

Use these ownership rules:

- app-wide snapshot or entity cache changes -> store actions
- feature-local workflow with transient state -> custom hook or feature component
- transport details, envelope parsing, DTO mapping -> `apiClient`

---

## Naming Conventions

- Every custom hook must start with `use`
- Use names that describe the workflow, not the rendering location:
  `useStreamingAiSummary`, not `useArticleViewSummaryThing`
- Keep feature hooks close to the feature they serve unless they are clearly
  reused across domains
- Export hook input/result interfaces when the API is non-trivial

Examples:

- `useTheme`
- `useFeedDialogForm`
- `useSettingsAutosave`
- `useImmersiveTranslation`

---

## Effect and Cleanup Rules

Hooks and effect-heavy components must clean up every resource they create:

- timers via `clearTimeout` / `clearInterval`
- DOM listeners via matching remove calls
- `EventSource` or stream listeners via close/teardown
- `matchMedia` listeners via `removeEventListener`

Examples:

- `useTheme.ts` removes the `matchMedia` listener for auto theme mode
- `ReaderApp.tsx` removes the `visibilitychange` listener
- `GlobalSearchDialog.tsx` clears pending search timers on unmount

If cleanup is easy to forget, keep the resource lifecycle inside one hook rather
than spreading it across multiple components.

---

## Hook vs Store Decision

Use a hook when the state is owned by one subtree or workflow:

- form editing state
- a modal or panel interaction flow
- one async workflow tied to a selected entity

Use a store when the state must be shared or restored globally:

- selected reader view and article
- shared snapshot entities and pagination state
- persisted settings and drafts
- notifications shown independently of one feature subtree

Do not mirror the same async status in both a hook and a store unless each layer
owns a different responsibility and the boundary is explicit.

---

## Common Mistakes

- Leaving timers, `EventSource`, or DOM listeners without cleanup
- Returning unstable anonymous APIs when a stable callback or memoized value is
  needed for effects
- Moving feature-specific hooks into `src/hooks/` too early
- Duplicating request state in both a component and a hook
- Using a hook to hide unrelated concerns instead of separating them into
  smaller hooks or helpers
- Encoding transport parsing rules inside hooks instead of keeping them in
  `apiClient`

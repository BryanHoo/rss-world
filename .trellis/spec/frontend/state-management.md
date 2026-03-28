# State Management

> How client state is managed in FeedFuse.

---

## Overview

FeedFuse splits state by lifespan and ownership:

- local component state for transient UI details
- feature hook state for async workflow state
- Zustand stores for cross-feature client state
- URL state for reader selection that must survive refresh/share/back-forward navigation

There is no dedicated server-state library in the current app.

---

## State Categories

### Local component state

Use `useState`, `useRef`, and effects for state that only matters to one rendered subtree.

Examples:

- `src/features/reader/ReaderLayout.tsx` manages dialog open state, viewport width, and drag state locally
- `src/features/settings/useSettingsAutosave.ts` tracks save status locally inside the hook

### Feature async state

If transient async behavior belongs to one feature, keep it in the feature hook instead of promoting it to a global store.

Example:

- `src/features/articles/useStreamingAiSummary.ts`

### Global client state

Use Zustand when the same state is needed across panes, screens, or feature boundaries.

Current stores:

- `src/store/appStore.ts` for reader selection, feeds, articles, caches, and cross-pane actions
- `src/store/settingsStore.ts` for persisted settings, draft settings, and API key session state

### URL state

Reader selection is mirrored into the URL instead of living only in memory.

Example:

- `src/store/appStore.ts` reads and writes `view` and `article` query params

---

## When to Use Global State

Promote state to Zustand only when at least one of these is true:

- multiple distant components need the same source of truth
- the state must survive surface switches
- the state mirrors URL state
- the state acts as a cache shared by multiple interactions

Keep the state local when it is only about one dialog, one hover state, one sheet, or one render-only concern.

---

## Server State

Remote data is fetched imperatively through `src/lib/apiClient.ts` and then stored in hooks or Zustand.

Current patterns:

- `src/store/appStore.ts` loads and caches reader snapshot data
- `src/store/settingsStore.ts` hydrates settings and API key status
- `src/features/articles/useStreamingAiSummary.ts` manages stream/session state per article

Because there is no React Query cache layer, avoid fetching the same server resource independently in many components. Prefer one owner and pass data down.

---

## Common Mistakes

- Do not put one-dialog open/close flags into global state unless another subtree truly depends on them
- Do not duplicate the same remote state in multiple stores and local hooks without a clear ownership rule
- Do not bypass the store when URL-synced reader selection is involved
- Do not mutate persisted settings shape ad hoc; use the store update paths and validation helpers

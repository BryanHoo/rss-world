# State Management

> How state is managed in this project.

---

## Overview

This project uses Zustand for shared client state and plain React state for local,
ephemeral UI concerns.

There is no separate server-state framework. Server-backed data is fetched through
`src/lib/apiClient.ts` and then stored, cached, or normalized in Zustand stores.

Primary shared stores:

- `src/store/appStore.ts`
- `src/store/settingsStore.ts`

---

## State Categories

### Local UI State

Use component state for transient UI concerns that are owned by one screen or one
component tree.

Examples:

- loading flags and preview state in `src/features/articles/ArticleView.tsx`
- scroll position and preload queues in `src/features/articles/ArticleList.tsx`
- form submission state in `src/features/feeds/useAiDigestDialogForm.ts`

### Global Client State

Use Zustand when multiple parts of the reader need the same state or when actions
must stay stable across features.

Examples from `src/store/appStore.ts`:

- selected view and selected article
- snapshot data and pagination state
- optimistic article actions such as mark-as-read or toggle-star

Examples from `src/store/settingsStore.ts`:

- persisted reader settings
- draft editing state
- session-only API key status

### URL State

Reader selection is synced with URL query params through store-owned helpers in
`src/store/appStore.ts`. Keep this logic centralized instead of duplicating URL
reads and writes across components.

### Server State

Server-backed data is fetched imperatively through store actions or feature-local
flows. There is no global query cache library in use today.

Examples:

- `loadSnapshot` and `loadMoreSnapshot` in `src/store/appStore.ts`
- `hydratePersistedSettings` in `src/store/settingsStore.ts`

---

## When to Use Global State

Promote state to a store when at least one of these is true:

- multiple panes or features consume it
- the state must survive navigation or repeated re-renders
- the state coordinates async writes and optimistic UI
- the state is naturally coupled to existing store actions

Do not promote state just because a component is large.

Good examples:

- reader selection and article snapshot state in `appStore`
- persisted settings and drafts in `settingsStore`

Keep one-off modal toggles, hover state, scroll helpers, and temporary form state
local unless there is a proven sharing requirement.

---

## Server State

Current server-state approach:

- API boundary lives in `src/lib/apiClient.ts`
- Stores own normalization, orchestration, and client cache updates
- Components consume store selectors and trigger store actions

This repo already uses a few useful patterns:

- keep request methods in stores instead of sprinkling them across components
- use store-level caches such as `articleDetailCache` and `articleSnapshotCache`
- use `Promise.allSettled` when partial failure should not break hydration

Examples:

- `src/store/appStore.ts`
- `src/store/settingsStore.ts`
- `src/lib/apiClient.ts`

---

## Common Mistakes

- Do not duplicate server-backed data in both component state and a store unless there is a clear reason
- Do not move ephemeral view-only state into Zustand too early
- Do not bypass store actions with ad hoc network requests from unrelated components
- Do not write URL synchronization logic in multiple components when the store already owns it
- Use direct `useAppStore.setState(...)` sparingly; prefer store actions unless the repo already uses a narrow state sync pattern

---

## Good Reference Files

- `src/store/appStore.ts`
- `src/store/settingsStore.ts`
- `src/features/articles/ArticleList.tsx`

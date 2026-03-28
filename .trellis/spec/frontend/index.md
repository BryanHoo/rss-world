# Frontend Development Guidelines

> Actual frontend conventions for FeedFuse.

---

## Overview

FeedFuse uses Next.js App Router, React 19, strict TypeScript, Tailwind CSS v4, Radix UI primitives, and Zustand for client state.

These documents should describe the codebase as it exists today:

1. Follow established feature folders before introducing new shared abstractions
2. Keep route files thin and move client behavior into `src/features/`, `src/store/`, and `src/lib/`
3. Co-locate tests with the code they verify
4. Prefer explicit runtime normalization and validation at boundaries

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Documented |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | Documented |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks, async client logic, cleanup | Documented |
| [State Management](./state-management.md) | Local state, global state, URL state, remote state | Documented |
| [Quality Guidelines](./quality-guidelines.md) | Linting, testing, review expectations | Documented |
| [Type Safety](./type-safety.md) | Type patterns, validation, shared models | Documented |

---

## Pre-Development Checklist

Read the relevant documents before changing frontend code:

- Any UI component or page change:
  `directory-structure.md`, `component-guidelines.md`, `quality-guidelines.md`
- Any custom hook, async client behavior, or stream/polling logic:
  `hook-guidelines.md`, `state-management.md`, `type-safety.md`
- Any shared state, settings, selection, or cache behavior:
  `state-management.md`, `type-safety.md`, `quality-guidelines.md`
- Any new shared utility, constant, or design token:
  `directory-structure.md`, `component-guidelines.md`, `.trellis/spec/guides/index.md`

If a change spans multiple areas, read all matching documents.

---

## Project Snapshot

Current frontend layout is split by responsibility:

- `src/app/`: route entry points, layout files, and API route handlers
- `src/features/`: product features and their local components/hooks/services/tests
- `src/components/ui/`: reusable UI primitives built on Radix and Tailwind
- `src/store/`: Zustand stores for cross-feature client state
- `src/hooks/`: truly cross-feature hooks only
- `src/lib/`: shared browser-side helpers, API client, design tokens, and utilities
- `src/types/`: shared domain models used across frontend and server code

Representative files:

- `src/app/(reader)/ReaderApp.tsx`
- `src/features/feeds/FeedDialog.tsx`
- `src/store/settingsStore.ts`
- `src/lib/apiClient.ts`

---

## Maintenance Rule

When a new stable pattern appears in more than one place, update these docs in the same task or immediately after the change lands.

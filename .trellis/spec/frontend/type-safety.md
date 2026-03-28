# Type Safety

> Type safety patterns in FeedFuse.

---

## Overview

The frontend runs with strict TypeScript and shared domain models.

Core rules:

1. Shared domain types live in `src/types/`
2. Feature-local types stay near the feature that owns them
3. Runtime validation happens at boundaries, not scattered through rendering code
4. Narrow unions and explicit interfaces are preferred over loose objects

Examples:

- `src/types/index.ts`
- `src/features/feeds/feedDialog.types.ts`
- `src/features/settings/settingsSchema.ts`

---

## Type Organization

### Shared domain types

Put app-wide models in `src/types/index.ts`.

Examples:

- `Feed`
- `Article`
- `PersistedSettings`
- `ViewType`

### Feature-local types

Put local payloads, modes, and helper types next to the feature.

Examples:

- `src/features/feeds/feedDialog.types.ts`
- `src/features/articles/useStreamingAiSummary.ts`

### Component props

Define props inline in the component file unless the same prop type is reused elsewhere.

Examples:

- `src/features/reader/ReaderLayout.tsx`
- `src/features/feeds/AddFeedDialog.tsx`
- `src/components/ui/button.tsx`

---

## Validation

Runtime validation differs by layer.

### Route and server boundaries

Use Zod for request params and payloads in route handlers.

Example:

- `src/app/api/articles/search/route.ts`

### Client settings and draft normalization

For persisted settings and client drafts, the current codebase mostly uses explicit normalization and validation helpers instead of large shared schemas.

Examples:

- `src/features/settings/settingsSchema.ts`
- `src/features/settings/validateSettingsDraft.ts`

Document the actual boundary behavior in code instead of assuming TypeScript alone protects runtime input.

---

## Common Patterns

- Use string literal unions such as `ValidationState` and `ViewType`
- Use typed `Record<string, ...>` maps when indexing by ids
- Prefer helper readers and normalizers for unknown input
- Prefer `import type` for type-only imports

Examples:

- `src/features/feeds/feedDialog.types.ts`
- `src/features/settings/settingsSchema.ts`
- `src/lib/apiClient.ts`

---

## Forbidden Patterns

- Do not introduce `any` unless there is no safer option and the boundary is immediately narrowed
- Do not duplicate shared domain interfaces inside a feature file
- Do not cast server responses directly into app models without normalization or validation
- Do not widen enum-like values to plain `string` when the valid set is known

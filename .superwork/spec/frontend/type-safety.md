# Type Safety

> Type safety patterns in this project.

---

## Overview

The project runs TypeScript in `strict` mode and keeps most shared domain shapes in
`src/types/index.ts`.

Type safety is handled in two layers:

- compile-time safety through TypeScript interfaces, unions, and strict settings
- runtime safety at boundaries through schema validation or normalization helpers

---

## Type Organization

Use these boundaries consistently:

- `src/types/index.ts` for shared domain entities used across multiple modules
- file-local interfaces and types for props, input payloads, and helper return values
- `import type` for type-only imports

Examples:

- shared models in `src/types/index.ts`
- local component props in `src/app/(reader)/ReaderApp.tsx`
- local feature types in `src/features/feeds/useAiDigestDialogForm.ts`

Preferred patterns already present in the repo:

- literal unions for constrained values
- `as const` arrays plus indexed access types for option lists
- typed store interfaces for Zustand state and actions

Example:

- `AI_DIGEST_INTERVAL_OPTIONS_MINUTES` and `AiDigestIntervalMinutes` in
  `src/features/feeds/useAiDigestDialogForm.ts`

---

## Validation

Runtime validation is not delegated to one universal pattern. Follow the boundary
that already exists:

### App Router and Environment Boundaries

Use Zod at request, params, query, or env boundaries.

Examples:

- `src/app/api/reader/snapshot/route.ts`
- `src/app/api/articles/[id]/route.ts`
- `src/server/env.ts`

### Client Persistence and Settings Migration

For persisted settings, the repo currently uses explicit normalization helpers
instead of Zod.

Examples:

- `src/features/settings/settingsSchema.ts`
- `src/features/settings/validateSettingsDraft.ts`

This pattern is useful when reading legacy storage formats or applying defaults.

---

## Common Patterns

- Prefer explicit interfaces over anonymous object shapes once the structure is reused
- Use `Record<string, string>` or similarly specific maps instead of broad `object`
- Model constrained string values as literal unions
- Keep conversion and normalization functions close to the data boundary
- Use typed API envelopes and custom error classes for request layers

Examples:

- `ApiError`, `ApiEnvelope`, and request helpers in `src/lib/apiClient.ts`
- normalization helpers in `src/features/settings/settingsSchema.ts`
- domain unions such as `FeedKind` and `SystemLogLevel` in `src/types/index.ts`

---

## Forbidden Patterns

- Do not introduce `any`
- Avoid broad `as` assertions when a parser, normalizer, or type guard would be clearer
- Do not redefine shared domain types inside feature files if `src/types/index.ts` already owns them
- Do not trust unvalidated external input at route or env boundaries
- Do not pass untyped JSON through the app when a typed envelope already exists

---

## Good Reference Files

- `src/types/index.ts`
- `src/features/settings/settingsSchema.ts`
- `src/lib/apiClient.ts`

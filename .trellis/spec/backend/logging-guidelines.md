# Logging Guidelines

## Logging Goal

Backend logs in this project are persistent product logs, not only console diagnostics.

The main path is:

`route / worker / integration code -> logging helper -> repository -> system_logs`

Examples:

- `src/server/logging/systemLogger.ts`
- `src/server/logging/userOperationLogger.ts`
- `src/server/repositories/systemLogsRepo.ts`

## Write Through Shared Helpers

Use `writeSystemLog()` for general persistent logs.

Required fields:

- `level`
- `category`
- `message`
- `source`

Optional fields:

- `details`
- `context`

`source` should identify the module or request origin in a stable format, for example:

- `app/api/categories`
- a worker module name
- an integration client label

## Respect Logging Settings

`writeSystemLog()` already applies settings-aware filtering:

- skips writes when logging is disabled
- skips writes below `logging.minLevel`
- supports `forceWrite` when a log must bypass the normal filter

Do not duplicate minimum-level checks at every call site.

## User Operation Logging

For user-facing actions, prefer `writeUserOperationStartedLog()`, `writeUserOperationSucceededLog()`, and `writeUserOperationFailedLog()`.

This keeps category, message rendering, and operation metadata aligned with `src/lib/userOperationCatalog.ts`.

Route pattern:

- define `const operationSource = 'app/api/...'`
- log failures in a small helper
- include stable IDs in `context`

Examples:

- `src/app/api/categories/route.ts`
- `src/app/api/feeds/route.ts`

## Context Shape

Use `context` for structured machine-readable details such as:

- entity IDs
- operation stage
- operation outcome
- model name
- duration

Keep `message` human-readable and concise. Put verbose or raw failure text into `details` when needed.

Example:

- `src/server/ai/openaiClient.ts` logs model, URL, method, and duration in `context`

## Levels

Current persisted levels are:

- `info`
- `warning`
- `error`

Choose the lowest level that still matches operational importance.

## Avoid

- Logging only to `console` for behavior that must appear in the in-product logs view.
- Putting large opaque payloads in `message`.
- Inventing category strings ad hoc when an existing catalog entry or category already fits.
- Logging the same failure at multiple layers unless each log serves a distinct purpose.

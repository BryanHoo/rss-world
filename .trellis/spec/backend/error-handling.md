# Error Handling

> How backend validation and error responses are handled in FeedFuse.

---

## Overview

FeedFuse standardizes backend failures around shared error classes and a single JSON envelope.

Core rules:

1. Validate request boundaries early
2. Throw or construct `AppError` variants for expected failures
3. Return `ok(...)` and `fail(...)` instead of building response envelopes ad hoc
4. Translate database or infrastructure errors into stable user-facing errors where possible

---

## API Envelope

All route handlers should use the shared response helpers from `src/server/http/apiResponse.ts`.

Success shape:

- `{ ok: true, data }`

Failure shape:

- `{ ok: false, error: { code, message, fields? } }`

Examples:

- `src/server/http/apiResponse.ts`
- `src/app/api/feeds/route.ts`
- `src/app/api/articles/search/route.ts`

---

## Error Types

Shared expected errors live in `src/server/http/errors.ts`.

Current built-in classes:

- `ValidationError`
- `NotFoundError`
- `ConflictError`

If a route can detect a known bad request or known conflict, prefer these types over throwing generic `Error`.

Examples:

- `src/server/http/errors.ts`
- `src/app/api/feeds/route.ts`

---

## Validation Patterns

Current backend validation pattern:

1. Parse params/body/query with Zod in route handlers
2. Convert Zod issues into `fields` maps
3. Return `fail(new ValidationError(...))`

Examples:

- `src/app/api/articles/search/route.ts`
- `src/app/api/feeds/route.ts`
- `src/app/api/categories/reorder/route.ts`

For non-Zod validation inside backend helpers, return explicit field maps or normalized booleans rather than leaking low-level parser errors to clients.

---

## Error Mapping

Database and infrastructure errors are often mapped into stable application errors before returning to the client or writing logs.

Current patterns:

- map uniqueness and foreign-key violations to `ConflictError` / `ValidationError`
- return a generic `internal_error` envelope for unexpected failures
- preserve structured `fields` for form surfaces that need targeted messages

Examples:

- `src/app/api/feeds/route.ts`
- `src/server/http/apiResponse.ts`
- `src/lib/apiClient.ts`

---

## Anti-Patterns

- Do not return raw Postgres error messages directly to clients
- Do not create route-specific response envelopes that break the shared `ok` / `fail` contract
- Do not throw plain strings for expected control-flow failures
- Do not skip field-level validation details when the frontend needs to mark specific inputs

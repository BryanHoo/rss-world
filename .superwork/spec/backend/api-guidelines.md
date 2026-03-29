# API Guidelines

> How App Router backend routes are implemented in this project.

---

## Overview

Backend HTTP entrypoints use Next App Router route handlers under `src/app/api`.
The current project favors a small set of shared conventions:

- force Node runtime with `runtime = 'nodejs'`
- return a shared `{ ok: true | false }` JSON envelope
- validate params, query, and body with Zod
- delegate business logic to services or repositories
- translate expected errors into `AppError` subclasses

---

## Route Structure

Common route layout:

1. imports
2. `runtime` and `dynamic` exports
3. Zod schemas
4. helper functions for Zod field mapping or database error checks
5. route handler exports

Examples:

- `src/app/api/feeds/route.ts`
- `src/app/api/feeds/[id]/route.ts`
- `src/app/api/reader/snapshot/route.ts`

---

## Validation Patterns

Use Zod at the route boundary.

Current patterns:

- params use a dedicated `paramsSchema`
- bodies use `safeParse`
- invalid input becomes `ValidationError`
- route-specific `zodIssuesToFields` converts Zod issues into field maps

Examples:

- `src/app/api/feeds/route.ts`
- `src/app/api/feeds/[id]/route.ts`
- `src/server/http/idSchemas.ts`

When the same parameter shape is reused, centralize it in `src/server/http`.

---

## Response and Error Envelopes

Use the shared helpers from `src/server/http/apiResponse.ts`:

- `ok(data)`
- `fail(err)`

Use `AppError` subclasses from `src/server/http/errors.ts` for expected failures:

- `ValidationError`
- `NotFoundError`
- `ConflictError`

Benefits of the current approach:

- response shape stays stable for the frontend
- route handlers stay small
- unhandled errors fall back to a generic internal error response

---

## Service and Repository Calls

Routes should call into the server layer instead of re-implementing business logic.

Current routing split:

- pure reads may call repositories directly
- transactional or multi-step mutations usually call services
- logging helpers are often triggered in the route layer around user operations

Examples:

- `src/app/api/feeds/route.ts`
  uses `listFeeds` for reads and `createFeedWithCategoryResolution` for writes
- `src/app/api/feeds/[id]/route.ts`
  uses `updateFeedWithCategoryResolution` and `deleteFeedAndCleanupCategory`

---

## Logging and Failure Handling

The codebase already logs user-facing operations around route mutations.

Preferred pattern:

- create a route-specific `operationSource`
- write success logs after the mutation succeeds
- write failure logs before returning `fail(error)`

Examples:

- `src/app/api/feeds/route.ts`
- `src/app/api/feeds/[id]/route.ts`

---

## Common Mistakes

- Do not return ad hoc JSON shapes instead of `ok(...)` and `fail(...)`
- Do not trust `request.json()` output without Zod validation
- Do not embed transaction logic in route handlers
- Do not leak raw database errors directly to clients
- Do not duplicate route-level helpers if a shared schema or helper already exists

---

## Good Reference Files

- `src/app/api/feeds/route.ts`
- `src/app/api/feeds/[id]/route.ts`
- `src/server/http/apiResponse.ts`
- `src/server/http/errors.ts`

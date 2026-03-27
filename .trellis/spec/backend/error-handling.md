# Error Handling

## Response Contract

Route handlers should return the shared JSON envelope from `src/server/http/apiResponse.ts`:

- success: `{ ok: true, data }`
- failure: `{ ok: false, error }`

Use:

- `ok(data, init?)` for success
- `fail(err)` for failures

Do not hand-roll per-route error response shapes.

## AppError Hierarchy

Use `AppError` subclasses from `src/server/http/errors.ts` for expected failures:

- `ValidationError`
- `NotFoundError`
- `ConflictError`

Each error carries:

- `code`
- `status`
- optional `fields`

Unexpected failures should bubble to `fail(err)`, which serializes them as:

- `code: "internal_error"`
- a generic user-safe message

## Request Validation

Validate request bodies and params at the route boundary.

Current repo patterns:

- `z.object(...).safeParse(json)` for request bodies
- shared ID schemas such as `numericIdSchema` from `src/server/http/idSchemas.ts`
- route-local helpers that convert `ZodError` into `fields`

Examples:

- `src/app/api/categories/route.ts`
- `src/app/api/feeds/route.ts`

When validation fails:

- construct a `ValidationError`
- include field-level messages when available
- return `fail(error)`
- log the failed user operation when the endpoint already tracks operation logs

## Mapping Low-Level Failures

Do not leak raw database or external service failures directly to clients when they represent expected business cases.

Map known low-level failures near the HTTP boundary, for example:

- Postgres unique violations (`code === '23505'`) to `ConflictError`
- Postgres foreign key violations (`code === '23503'`) to `ValidationError`
- missing resources to `NotFoundError`

Examples:

- `src/app/api/categories/route.ts`
- `src/app/api/feeds/route.ts`

Keep the mapping explicit with small type guards such as `isUniqueViolation()` rather than broad string matching scattered across files.

## Message Guidance

- Client-facing messages should be stable and safe to show in the UI.
- `fields` should use request field names, not database column names.
- Defaults for common errors may be Chinese when that is already the user-facing repo convention.

Example:

- `src/server/http/errors.test.ts`

## Logging Failures

If a route writes user-operation logs, record failures before returning the response.

Pattern:

- create a route-local helper like `writeFeedCreateFailure(err)`
- reuse the same `actionKey` and `source`
- log mapped application errors as well as unexpected exceptions

Do not log by throwing and catching the same error multiple times.

## Avoid

- Returning raw `Error.message` from unknown failures.
- Throwing plain strings for expected API failures.
- Performing request-body validation inside repositories.
- Creating a different error envelope per route.

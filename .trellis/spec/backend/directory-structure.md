# Directory Structure

## Primary Backend Layers

### `src/app/api/`

Next.js route handlers are the HTTP entry points.

Use this layer for:

- request parsing and `zod` validation
- URL param validation
- API-safe error mapping
- composing repositories/services into HTTP responses
- writing user-operation logs around request lifecycle events

Examples:

- `src/app/api/categories/route.ts`
- `src/app/api/feeds/route.ts`
- `src/app/api/articles/search/route.ts`

Route handlers in this repo usually export:

- `runtime = 'nodejs'`
- `dynamic = 'force-dynamic'`

### `src/server/http/`

Shared HTTP primitives live here:

- `apiResponse.ts` for `ok` / `fail`
- `errors.ts` for `AppError` subclasses
- `idSchemas.ts` for common parameter validation

Keep request/response helpers here when they are reused by multiple routes.

### `src/server/repositories/`

Repositories own database access and row-shape mapping.

Use this layer for:

- SQL statements
- row-to-TypeScript field aliases
- table-specific persistence logic
- query helpers reused across routes, services, and workers

Do not place request parsing, HTTP response building, or cross-table workflow orchestration here.

### `src/server/services/`

Services coordinate workflows across repositories or manage transactions.

Use this layer when logic:

- touches multiple repositories
- needs explicit `begin` / `commit` / `rollback`
- aggregates row-level results into domain-level state
- is reused by both routes and workers

Examples:

- `src/server/services/feedCategoryLifecycleService.ts`
- `src/server/services/feedRefreshRunService.ts`

### `src/server/db/`

Database bootstrap and schema evolution.

- `pool.ts` owns the singleton `pg` pool
- `migrations/*.sql` are append-only numbered SQL migrations
- `migrations/*.test.ts` assert the migration file content and constraints

### `src/server/logging/`

Persistent backend logging helpers.

- `systemLogger.ts` applies settings-aware filtering
- `userOperationLogger.ts` wraps user-facing action logging

### `src/server/queue/`

Queue contracts, bootstrap, job names, and observability for `pg-boss`.

Keep queue definitions and delivery contracts here, not inside workers.

### `src/server/ai/`, `src/server/rss/`, `src/server/fulltext/`, `src/server/media/`, `src/server/tasks/`, `src/server/opml/`

These directories contain capability-specific backend modules.

Prefer creating a focused subdirectory when the logic depends on one external domain or runtime concern.

### `src/worker/`

Background job execution lives here.

Use workers for:

- feed refresh and article ingestion
- AI summary / translation jobs
- queue consumers
- long-running or scheduled work that should not run inside route handlers

`src/worker/index.ts` is the composition root for worker startup and job registration.

## Placement Rules

- Put SQL in repositories unless the query is a one-off aggregation local to a route and not worth reusing.
- Put multi-step transactional work in services.
- Put generic validation schemas shared across routes in `src/server/http/` or a nearby feature module.
- Put external integration clients next to the domain that owns them, for example `src/server/ai/openaiClient.ts`.
- Put route tests beside the route tree and server tests beside the server module they cover.

## Avoid

- Calling `NextResponse` or returning HTTP responses from repositories/services.
- Duplicating SQL across route handlers and workers.
- Hiding transaction boundaries across multiple layers.
- Mixing queue contract definitions into worker implementation files.

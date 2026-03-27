# Database Guidelines

## Core Stack

The project uses:

- PostgreSQL via `pg`
- a singleton connection pool from `src/server/db/pool.ts`
- raw parameterized SQL in repositories
- append-only SQL migrations in `src/server/db/migrations/`

There is no ORM in the current codebase. Follow the existing `pg` + SQL pattern.

## Pool Usage

- Read the pool through `getPool()` from `src/server/db/pool.ts`.
- Do not create ad-hoc `Pool` instances in routes or workers.
- Environment access for DB bootstrap goes through `getServerEnv()`.

Example:

- `src/server/db/pool.ts`

## Repository Pattern

Repositories accept a `Pool` or `PoolClient`:

```ts
type DbClient = Pool | PoolClient;
```

This is the standard pattern for functions that must work both inside and outside transactions.

Repository responsibilities:

- execute SQL
- alias snake_case columns to camelCase result fields
- keep parameter order explicit
- return typed row objects

Example patterns:

- `src/server/repositories/feedsRepo.ts`
- `src/server/repositories/categoriesRepo.ts`
- `src/server/repositories/systemLogsRepo.ts`

## Query Conventions

- Always use parameterized SQL with `$1`, `$2`, ... placeholders.
- Alias persisted names to TypeScript names in SQL, for example `site_url as "siteUrl"`.
- Keep `returning` clauses aligned with the exported row interface.
- Use explicit ordering when list order matters.
- Normalize nullable DB values to `null`, not `undefined`.

When implementing partial updates:

- build `fields` and `values` arrays explicitly
- return `null` when no update fields were provided if that is the existing module contract
- add `updated_at = now()` in update statements where the table supports it

Examples:

- `updateFeed()` in `src/server/repositories/feedsRepo.ts`
- `updateCategory()` in `src/server/repositories/categoriesRepo.ts`

## Transaction Ownership

Prefer transaction ownership in the service layer when the workflow spans multiple repositories.

Examples:

- `createFeedWithCategoryResolution()` in `src/server/services/feedCategoryLifecycleService.ts`
- `persistAggregate()` in `src/server/services/feedRefreshRunService.ts`

Repository-local transactions are acceptable only when the operation is naturally table-focused and self-contained.

Example:

- `reorderCategories()` in `src/server/repositories/categoriesRepo.ts`

Transaction rules:

- when a service owns the transaction, acquire a client with `pool.connect()`
- if a repository owns a self-contained transaction, keep `begin` / `commit` / `rollback` inside that single repository function
- `begin` once at the transaction boundary
- `rollback` in `catch`
- call `release()` in `finally` only when the code acquired a dedicated client
- do not nest hidden transaction boundaries across service calls

## Migrations

Migration files live in `src/server/db/migrations/` and use numbered prefixes such as `0022_system_logs.sql`.

Rules:

- append a new numbered SQL file instead of editing old migrations
- pair schema changes with migration tests when the repo already does so
- keep migration SQL idempotent where the existing repo expects `if not exists`
- assert important constraints and indexes in tests

Examples:

- `src/server/db/migrations/0022_system_logs.sql`
- `src/server/db/migrations/systemLogsMigration.test.ts`

## Integration Testing

Repository integration tests are allowed and currently guarded by `DATABASE_URL`.

Pattern:

- `describe.skipIf(!databaseUrl)(...)`

Example:

- `src/server/repositories/repositories.integration.test.ts`

Use unit tests by default, and add integration coverage when the behavior depends on actual PostgreSQL semantics, constraints, or migration results.

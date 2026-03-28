# Database Guidelines

> How PostgreSQL access, SQL, and migrations are handled in FeedFuse.

---

## Overview

FeedFuse uses `pg` directly. There is no ORM.

Core rules:

1. Reuse `getPool()` from `src/server/db/pool.ts`
2. Keep query text in repositories unless the query is tightly scoped to one route and not reusable
3. Use services to own multi-step transactions
4. Add migration tests when schema contracts change

---

## Connection and Query Access

- The shared pool is created lazily in `src/server/db/pool.ts`
- Repositories accept `Pool | PoolClient` so they can be reused inside and outside transactions
- Services obtain a `PoolClient` with `pool.connect()` when a transaction is required

Examples:

- `src/server/db/pool.ts`
- `src/server/repositories/feedsRepo.ts`
- `src/server/services/feedCategoryLifecycleService.ts`

---

## Repository Patterns

Repositories usually expose:

- a typed row interface
- one function per query or mutation
- SQL aliases that map snake_case columns into camelCase return fields

Examples:

- `src/server/repositories/feedsRepo.ts`
- `src/server/repositories/categoriesRepo.ts`
- `src/server/repositories/systemLogsRepo.ts`

Use parameterized SQL only. Build dynamic `update` statements by growing field and value arrays rather than interpolating values directly.

Example:

- `src/server/repositories/feedsRepo.ts`

---

## Transactions

Use explicit transactions when an operation spans multiple writes or cleanup steps.

Current pattern:

1. `const client = await pool.connect()`
2. `await client.query('begin')`
3. call repositories with `client`
4. `await client.query('commit')`
5. `await client.query('rollback')` in `catch`
6. `client.release()` in `finally`

Examples:

- `src/server/services/feedCategoryLifecycleService.ts`
- `src/server/services/aiDigestLifecycleService.ts`
- `src/app/api/settings/route.ts`

---

## Migrations

Schema changes live in numbered SQL files under `src/server/db/migrations/`.

Current conventions:

- zero-padded numeric prefixes
- idempotent `create table if not exists` and `create index if not exists`
- explicit `check (...)` constraints for bounded enum-like values
- separate tests that assert the migration file exists and contains key DDL

Examples:

- `src/server/db/migrations/0025_feed_refresh_runs.sql`
- `src/server/db/migrations/feedRefreshRunsMigration.test.ts`

---

## Anti-Patterns

- Do not introduce an ORM-style abstraction on top of existing repository code without a deliberate migration plan
- Do not duplicate the same SQL in routes and repositories
- Do not start transactions in repositories that are also called inside service-owned transactions unless that nesting is intentional
- Do not change schema contracts without adding or updating the migration test that documents the new structure

# Backend Development Guidelines

> Actual backend conventions for FeedFuse.

---

## Overview

FeedFuse backend code is split across Next.js route handlers, `src/server/` modules, PostgreSQL repositories, and PgBoss workers.

These documents should describe the codebase as it exists today:

1. Keep route handlers focused on boundary validation and response mapping
2. Move durable business logic into `src/server/services/`
3. Keep SQL in repositories and schema changes in numbered migrations
4. Use shared error and logging helpers instead of ad-hoc response shapes

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Route, server, queue, and worker organization | Documented |
| [Database Guidelines](./database-guidelines.md) | Pool access, repository patterns, SQL, migrations | Documented |
| [Error Handling](./error-handling.md) | Validation, `AppError`, API envelopes, conflict mapping | Documented |
| [Logging Guidelines](./logging-guidelines.md) | System log and user operation log patterns | Documented |
| [Quality Guidelines](./quality-guidelines.md) | Testing, runtime checks, queue verification | Documented |

---

## Pre-Development Checklist

Read the relevant documents before changing backend code:

- Any API route or request/response contract change:
  `directory-structure.md`, `error-handling.md`, `quality-guidelines.md`
- Any repository, SQL, migration, or transactional change:
  `database-guidelines.md`, `quality-guidelines.md`, `.trellis/spec/guides/index.md`
- Any service-layer orchestration or cross-module backend flow:
  `directory-structure.md`, `database-guidelines.md`, `error-handling.md`
- Any worker, queue, or observability change:
  `directory-structure.md`, `logging-guidelines.md`, `quality-guidelines.md`

If a change spans multiple areas, read all matching documents.

---

## Project Snapshot

Current backend responsibilities are split as follows:

- `src/app/api/`: Next.js route handlers and request boundary validation
- `src/server/http/`: shared API response and error primitives
- `src/server/services/`: transactional orchestration and business workflows
- `src/server/repositories/`: SQL access and row mapping
- `src/server/db/`: pool and migrations
- `src/server/logging/`: system log and user operation log helpers
- `src/server/queue/` and `src/worker/`: queue contracts, bootstrap, and worker handlers

Representative files:

- `src/app/api/feeds/route.ts`
- `src/server/services/feedCategoryLifecycleService.ts`
- `src/server/repositories/feedsRepo.ts`
- `src/server/db/migrations/0025_feed_refresh_runs.sql`
- `src/server/logging/systemLogger.ts`

---

## Maintenance Rule

When a backend pattern becomes stable across multiple routes, services, repositories, or workers, update these docs in the same task or immediately after the change lands.

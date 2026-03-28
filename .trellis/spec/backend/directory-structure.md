# Directory Structure

> How backend code is organized in FeedFuse.

---

## Overview

FeedFuse backend code is layered by responsibility instead of putting all logic into route files.

Use these placement rules:

1. Keep `src/app/api/` focused on HTTP boundary work
2. Put orchestration and transactions in `src/server/services/`
3. Put SQL and row mapping in `src/server/repositories/`
4. Put schema and connection concerns in `src/server/db/`
5. Put queue contracts and worker registration in `src/server/queue/` and `src/worker/`

---

## Directory Layout

```text
src/
├── app/api/              # Next.js route handlers
├── server/http/          # API envelope helpers and error classes
├── server/services/      # business workflows and transactions
├── server/repositories/  # SQL access and row mapping
├── server/db/            # pool and migrations
├── server/logging/       # system log and user operation log helpers
├── server/queue/         # queue contracts, bootstrap, and observability
├── server/rss/           # RSS parsing, safety checks, fetch helpers
├── server/ai/            # backend AI integration logic
└── worker/               # PgBoss worker handlers
```

---

## Layer Responsibilities

### Route layer

Routes validate request input, call services or repositories, map exceptions to shared `fail(...)`, and return `ok(...)`.

Examples:

- `src/app/api/feeds/route.ts`
- `src/app/api/articles/search/route.ts`
- `src/app/api/settings/route.ts`

Do not place large transactions or reusable SQL directly in route files.

### Service layer

Services coordinate multiple repositories or steps and own transaction boundaries when several writes must stay together.

Examples:

- `src/server/services/feedCategoryLifecycleService.ts`
- `src/server/services/feedRefreshRunService.ts`
- `src/server/services/readerSnapshotService.ts`

### Repository layer

Repositories hold SQL and return typed row/domain-shaped results.

Examples:

- `src/server/repositories/feedsRepo.ts`
- `src/server/repositories/categoriesRepo.ts`
- `src/server/repositories/settingsRepo.ts`

### Queue and worker layer

- Queue configuration and send/worker defaults live in `src/server/queue/`
- Job handlers live in `src/worker/`

Examples:

- `src/server/queue/contracts.ts`
- `src/server/queue/bootstrap.ts`
- `src/worker/workerRegistry.ts`

---

## Naming Conventions

- Route handlers: `route.ts` and colocated `route.test.ts` / `routes.test.ts`
- Services: `*Service.ts`
- Repositories: `*Repo.ts`
- Migrations: zero-padded numeric prefix plus descriptive snake_case name
- Workers: descriptive handler names such as `rssScheduler.ts` or `aiDigestGenerate.ts`

Examples:

- `src/server/services/feedCategoryLifecycleService.ts`
- `src/server/repositories/feedsRepo.ts`
- `src/server/db/migrations/0025_feed_refresh_runs.sql`
- `src/worker/articleFilterWorker.ts`

---

## Anti-Patterns

- Do not embed large SQL strings in route files when the query belongs in a repository
- Do not let services become alternate repositories that hide SQL-less wrappers around one query
- Do not spread queue contract values across worker files; keep them centralized in `src/server/queue/contracts.ts`
- Do not bypass shared HTTP helpers with custom `{ ok: ... }` response shapes

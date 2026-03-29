# Directory Structure

> How backend code is organized in this project.

---

## Overview

FeedFuse backend code is split across three main areas:

- `src/app/api` for App Router HTTP entrypoints
- `src/server` for reusable backend implementation
- `src/worker` for asynchronous job execution

The route layer should stay thin. Most business logic belongs in `src/server`,
and long-running or scheduled work belongs in `src/worker`.

---

## Directory Layout

```text
src/
├── app/api/               # Next App Router HTTP handlers and route tests
├── server/
│   ├── ai/                # AI integrations and AI-specific business logic
│   ├── db/                # pool and migrations
│   ├── http/              # shared response/error/schema helpers
│   ├── logging/           # system and user operation logging
│   ├── media/             # image rewriting and proxy guards
│   ├── opml/              # import/export document helpers
│   ├── queue/             # queue contracts, bootstrap, observability
│   ├── repositories/      # SQL persistence modules
│   ├── rss/               # feed fetching, parsing, SSRF protection
│   ├── services/          # orchestration and transactional business logic
│   └── tasks/             # task-specific helpers and error mapping
└── worker/                # PgBoss worker entrypoint and job handlers
```

---

## Ownership Boundaries

### `src/app/api`

Owns:

- request parsing
- route params and body validation
- mapping service/repository results into API envelopes
- translating expected failures into `fail(...)`

Should not own large business workflows if the same logic could be reused.

Examples:

- `src/app/api/feeds/route.ts`
- `src/app/api/feeds/[id]/route.ts`
- `src/app/api/logs/route.ts`

### `src/server/services`

Owns:

- orchestration across repositories
- transaction boundaries
- cross-layer data shaping
- business workflows that do not belong to one repository

Examples:

- `src/server/services/feedCategoryLifecycleService.ts`
- `src/server/services/readerSnapshotService.ts`
- `src/server/services/feedRefreshRunService.ts`

### `src/server/repositories`

Owns:

- SQL
- row mapping
- persistence-oriented input and return types
- focused database operations

Examples:

- `src/server/repositories/feedsRepo.ts`
- `src/server/repositories/articlesRepo.ts`
- `src/server/repositories/settingsRepo.ts`

### `src/server/queue` and `src/worker`

Use `src/server/queue` for queue contracts and shared queue helpers.
Use `src/worker` for actual job handlers and worker startup.

Examples:

- `src/server/queue/contracts.ts`
- `src/server/queue/bootstrap.ts`
- `src/worker/index.ts`
- `src/worker/workerRegistry.ts`

---

## Naming Conventions

- route handlers use `route.ts` and colocated `route.test.ts` or `routes.test.ts`
- repositories use `*Repo.ts`
- services use `*Service.ts`
- queue constants live in `jobs.ts` and `contracts.ts`
- worker handlers use action-oriented names such as `refreshAll.ts` or
  `articleFilterWorker.ts`

Current codebase note:

- backend tests are heavily colocated with the source they protect
- route tests often live beside the directory root route file rather than next to
  every nested file

---

## Anti-Patterns

- Do not put SQL directly in `src/app/api`
- Do not let repositories know about HTTP request or response concerns
- Do not duplicate queue names and worker options outside `src/server/queue`
- Do not move long-running work into route handlers when it already belongs in a worker

---

## Good Reference Files

- `src/app/api/feeds/route.ts`
- `src/server/services/feedCategoryLifecycleService.ts`
- `src/server/repositories/feedsRepo.ts`
- `src/worker/index.ts`

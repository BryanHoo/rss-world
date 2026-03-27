# Backend Development Guidelines

> Project-specific backend conventions for FeedFuse.

---

## Overview

The backend is implemented with Next.js route handlers under `src/app/api/`, server-only modules under `src/server/`, and asynchronous workers under `src/worker/`.

Write backend code to match the existing layering:

- route handlers validate requests, map low-level failures to API-safe errors, and return `{ ok, data | error }`
- repositories own SQL and persistence mapping
- services coordinate transactions or multi-repository workflows
- workers and queues execute background jobs outside request/response paths

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Where routes, repositories, services, workers, and utilities live | Filled |
| [Database Guidelines](./database-guidelines.md) | `pg` usage, migrations, query patterns, transaction ownership | Filled |
| [Error Handling](./error-handling.md) | AppError usage, request validation, API response contracts | Filled |
| [Logging Guidelines](./logging-guidelines.md) | System logs, user operation logs, source/context conventions | Filled |
| [Type Safety](./type-safety.md) | Zod boundaries, DTO shapes, env parsing, nullable handling | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Lint, type-check, test strategy, review expectations | Filled |

---

## Pre-Development Checklist

Read these files before writing backend code:

- Any route or API change: [Error Handling](./error-handling.md) and [Type Safety](./type-safety.md)
- Any repository, SQL, or migration change: [Database Guidelines](./database-guidelines.md)
- Any new logging, observability, or external API integration: [Logging Guidelines](./logging-guidelines.md)
- Any broad backend refactor or new module: [Directory Structure](./directory-structure.md)
- Before finishing work: [Quality Guidelines](./quality-guidelines.md)

If the change crosses backend/frontend or request/worker boundaries, also read [../guides/cross-layer-thinking-guide.md](../guides/cross-layer-thinking-guide.md).

---

## Concrete Examples In This Repo

- Route validation and response envelope: `src/app/api/categories/route.ts`
- Route + service composition: `src/app/api/feeds/route.ts`
- Transactional service orchestration: `src/server/services/feedCategoryLifecycleService.ts`
- Repository SQL mapping: `src/server/repositories/feedsRepo.ts`
- Error types and serialization: `src/server/http/errors.ts`, `src/server/http/apiResponse.ts`
- Logging pipeline: `src/server/logging/systemLogger.ts`, `src/server/logging/userOperationLogger.ts`
- Worker orchestration: `src/worker/index.ts`

---

**Language**: Keep backend spec documentation in English so it stays consistent with the rest of `.trellis/spec/`.

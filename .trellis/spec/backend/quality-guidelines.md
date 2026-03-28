# Quality Guidelines

> Code quality standards for FeedFuse backend work.

---

## Overview

Backend changes are expected to preserve API contracts, database safety, queue behavior, and test coverage.

Baseline verification commands:

- `pnpm lint`
- `pnpm type-check`
- `pnpm test`

Representative backend test areas already in the repo:

- route tests under `src/app/api/`
- repository and service tests under `src/server/`
- queue and worker tests under `src/server/queue/` and `src/worker/`
- migration contract tests under `src/server/db/migrations/`

---

## Required Patterns

- Add or update tests when changing route behavior, SQL behavior, queue contracts, or migrations
- Keep boundary validation and response envelopes consistent with `error-handling.md`
- Keep transaction ownership explicit
- Reuse centralized queue contracts rather than redefining worker settings inline
- Validate new env contracts with `zod` in `src/server/env.ts` or another boundary helper

Examples:

- `src/app/api/settings/routes.test.ts`
- `src/server/queue/contracts.test.ts`
- `src/server/db/migrations/feedRefreshRunsMigration.test.ts`
- `src/server/runtimeDependencies.test.ts`

---

## Testing Requirements

Use colocated tests near the backend code they verify.

Common patterns:

- route tests mock repositories, pool access, or loggers with `vi.mock(...)`
- repository/service tests assert contract behavior instead of snapshotting raw SQL blobs
- migration tests assert that key tables, constraints, and indexes exist in the SQL file
- queue tests verify concurrency, singleton, retry, and dead-letter behavior from the shared contracts

Examples:

- `src/app/api/settings/routes.test.ts`
- `src/server/repositories/categoriesRepo.test.ts`
- `src/server/queue/contracts.test.ts`
- `src/server/db/migrations/feedRefreshRunsMigration.test.ts`
- `src/worker/workerRegistry.test.ts`

---

## Review Checklist

Before considering a backend change ready, verify:

1. Logic is placed in the right layer from `directory-structure.md`
2. SQL, transaction, and migration changes follow `database-guidelines.md`
3. Error mapping and API envelopes follow `error-handling.md`
4. New logs follow `logging-guidelines.md`
5. `pnpm lint`, `pnpm type-check`, and relevant tests have been run successfully

---

## Anti-Patterns

- Do not change queue or worker behavior without updating the shared contract or its tests
- Do not change migrations silently without a contract test
- Do not couple route tests to incidental implementation details when the response contract is what matters
- Do not leave new environment variables or background jobs undocumented in code and unverified by tests

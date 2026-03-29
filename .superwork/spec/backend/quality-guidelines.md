# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

The backend quality baseline is currently enforced by:

- `pnpm lint`
- `pnpm type-check`
- `pnpm test:unit`

Tests are mostly colocated with the source modules they protect. Route, service,
repository, queue, and worker code all have focused Vitest coverage patterns.

---

## Required Patterns

- validate external input at route or env boundaries
- return the shared API envelope from route handlers
- keep SQL in repositories
- keep transactions and multi-repo orchestration in services
- centralize queue policy in `src/server/queue/contracts.ts`

Examples:

- API envelope: `src/server/http/apiResponse.ts`
- route tests: `src/app/api/feeds/routes.test.ts`
- service tests: `src/server/services/aiDigestLifecycleService.test.ts`
- queue tests: `src/server/queue/contracts.test.ts`

---

## Testing Requirements

Expect backend behavior changes to add or update the nearest relevant tests.

Current test styles:

- route tests mock dependencies and assert on JSON envelopes
- service tests mock repositories and transaction boundaries
- repository tests exercise persistence behavior directly
- queue and worker tests lock contract behavior and orchestration

Examples:

- `src/app/api/feeds/routes.test.ts`
- `src/server/services/aiDigestLifecycleService.test.ts`
- `src/server/repositories/feedsRepo.kind.test.ts`
- `src/worker/workerRegistry.test.ts`

---

## Forbidden Patterns

- Do not write SQL directly in route handlers
- Do not bypass shared `ok(...)` and `fail(...)` response helpers
- Do not hardcode queue names or retry policy in multiple places
- Do not silently swallow errors when a route, service, or worker should map or surface them
- Do not skip tests when changing shared contracts across route/service/repository/worker boundaries

---

## Code Review Checklist

- Is validation done at the correct boundary?
- Does the route delegate business logic instead of owning it?
- Does persistence stay in repositories?
- If a transaction is needed, is it owned by a service?
- If queue behavior changed, were `jobs.ts`, `contracts.ts`, send sites, and worker registrations all checked?
- Were relevant route, service, repository, or worker tests updated?

---

## Good Reference Files

- `package.json`
- `src/server/http/apiResponse.ts`
- `src/app/api/feeds/routes.test.ts`
- `src/server/services/aiDigestLifecycleService.test.ts`

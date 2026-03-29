# Service Guidelines

> How business logic and orchestration are implemented in this project.

---

## Overview

Services own workflows that cross repository boundaries, need transactions, or
shape data for route consumers. They should stay independent from HTTP response
formatting and UI concerns.

---

## When To Use a Service

Create or extend a service when the logic:

- spans multiple repositories
- needs an explicit transaction
- resolves cross-layer contracts
- assembles read models for routes or workers

Examples:

- `src/server/services/feedCategoryLifecycleService.ts`
- `src/server/services/readerSnapshotService.ts`
- `src/server/services/aiDigestLifecycleService.ts`

---

## Transaction Pattern

The repo already has a clear transaction pattern:

1. `const client = await pool.connect()`
2. `await client.query('begin')`
3. run repository calls
4. `commit` on success
5. `rollback` on failure
6. `client.release()` in `finally`

Examples:

- `src/server/services/feedCategoryLifecycleService.ts`
- `src/server/services/aiDigestLifecycleService.ts`

Use services, not routes, to own this pattern.

---

## Read-Model and Cross-Layer Shaping

Services are also the place for shaping cross-layer data, especially when a route
needs a composed read model instead of raw table rows.

Examples:

- `src/server/services/readerSnapshotService.ts`
  builds filters, decodes cursors, rewrites image URLs, and assembles a route-ready
  snapshot payload
- `src/server/services/systemLogsService.ts`
  shapes pagination-oriented output instead of exposing raw persistence structures

Validation rule:

- validate external input at the entry boundary
- normalize or reshape internal data in the service layer when multiple
  repositories or helpers are involved

---

## Service Inputs and Outputs

- Use explicit input interfaces for non-trivial service operations
- Return domain-oriented results instead of `NextResponse`
- Keep service return values stable enough that routes and workers do not need to
  know internal repository details

Examples:

- `CreateFeedWithCategoryInput` in
  `src/server/services/feedCategoryLifecycleService.ts`
- `ReaderSnapshot` in `src/server/services/readerSnapshotService.ts`

---

## Common Mistakes

- Do not put SQL directly into services if one repository can own it cleanly
- Do not return HTTP responses from services
- Do not scatter one transactional workflow across multiple route handlers
- Do not validate the same request fields again in multiple layers without a reason

---

## Good Reference Files

- `src/server/services/feedCategoryLifecycleService.ts`
- `src/server/services/readerSnapshotService.ts`
- `src/server/services/aiDigestLifecycleService.ts`

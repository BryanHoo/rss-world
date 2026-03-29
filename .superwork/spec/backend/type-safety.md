# Type Safety

> Type safety patterns in the backend layer.

---

## Overview

Backend code relies on strict TypeScript plus runtime validation at external
boundaries. The codebase uses a mix of:

- Zod for request params, request bodies, and env parsing
- explicit row and service interfaces for internal contracts
- repository-local row types and service-local input/output types

---

## Boundary Validation

Use Zod for data that crosses trust boundaries.

Current examples:

- route params and bodies in `src/app/api/feeds/route.ts`
- numeric ID reuse in `src/server/http/idSchemas.ts`
- environment parsing in `src/server/env.ts`

Preferred pattern:

- validate once at the entry point
- convert Zod issues into a stable field map for the API response
- pass typed data to the deeper layers

---

## Internal Typing

Use explicit backend-facing interfaces for:

- repository rows
- service inputs and outputs
- queue options and worker options

Examples:

- `FeedRow` in `src/server/repositories/feedsRepo.ts`
- `CreateFeedWithCategoryInput` in
  `src/server/services/feedCategoryLifecycleService.ts`
- `QueueCreateOptions` and `WorkerOptions` in `src/server/queue/contracts.ts`

Keep these types close to the module that owns the contract.

---

## Runtime Parsing and Defensive Reads

The repo already uses defensive parsing for data that may be malformed or legacy.

Examples:

- `decodeCursor(...)` in `src/server/services/readerSnapshotService.ts`
- `parseEnv(...)` in `src/server/env.ts`

Use this style when reading opaque serialized data, environment variables, or
untrusted payloads.

---

## Common Mistakes

- Do not trust raw `request.json()` or `process.env`
- Avoid broad `as` assertions for external data when a parser or schema is clearer
- Do not duplicate shared route schemas if `src/server/http` already owns them
- Do not expose raw persistence-only structures to higher layers without checking
  whether a service contract should reshape them

---

## Good Reference Files

- `src/app/api/feeds/route.ts`
- `src/server/http/idSchemas.ts`
- `src/server/env.ts`
- `src/server/services/readerSnapshotService.ts`

# Logging Guidelines

> How backend logging and user operation logging work in FeedFuse.

---

## Overview

FeedFuse writes structured system logs through shared helpers instead of scattering direct insert calls throughout routes and services.

Core rules:

1. Use `writeSystemLog(...)` for structured backend logs
2. Use `writeUserOperation*Log(...)` for user-triggered actions
3. Include `source` and lightweight `context`
4. Let logging settings control whether normal logs are persisted

---

## System Log Pattern

`writeSystemLog(...)` is the central logging helper.

Current behavior:

- reads logging settings from persisted settings unless overridden
- respects `enabled` and `minLevel`
- supports `forceWrite` for important events
- normalizes `details` and `context`

Examples:

- `src/server/logging/systemLogger.ts`
- `src/server/repositories/systemLogsRepo.ts`
- `src/app/api/settings/route.ts`

---

## User Operation Log Pattern

User-triggered actions should use the dedicated helpers in `src/server/logging/userOperationLogger.ts`.

Current helpers:

- `writeUserOperationStartedLog`
- `writeUserOperationSucceededLog`
- `writeUserOperationFailedLog`

These helpers derive category and message text from `src/lib/userOperationCatalog.ts`.

Examples:

- `src/server/logging/userOperationLogger.ts`
- `src/app/api/feeds/route.ts`
- `src/app/api/settings/route.ts`

---

## Logging Content

Preferred fields:

- `source`: stable module identifier such as `app/api/feeds`
- `context`: ids and operation metadata, not huge payload dumps
- `details`: focused error detail or explanation string when needed

Keep log context useful for debugging without storing unnecessary raw request bodies or secrets.

---

## Anti-Patterns

- Do not insert logs directly into repositories when the shared logger already covers the case
- Do not log secrets, API keys, or entire raw payloads unless there is an explicit safe redaction strategy
- Do not create one-off message formats for user operations when the catalog-based helper already exists
- Do not ignore `source`; logs without a clear origin are much less useful

# Async Jobs Guidelines

> How queue contracts, background jobs, and workers are implemented.

---

## Overview

FeedFuse uses PgBoss-backed workers for scheduled and long-running backend work.
Queue definitions and worker behavior are intentionally centralized.

Current ownership split:

- queue names and retry/concurrency policy in `src/server/queue`
- worker startup and handlers in `src/worker`

---

## Queue Contracts

Use `src/server/queue/contracts.ts` as the single source of truth for:

- queue creation options
- worker options
- send-time dedupe/singleton settings

Queue names themselves are centralized in `src/server/queue/jobs.ts`.

Do not hardcode a new job name, retry policy, or concurrency setting in a route or
worker without updating these contract files.

Examples:

- `src/server/queue/contracts.ts`
- `src/server/queue/jobs.ts`
- `src/server/queue/bootstrap.ts`

---

## Worker Registration

Workers are registered through `registerWorkers(...)`, which looks up worker
options from queue contracts.

Patterns to follow:

- define queue policy once in `contracts.ts`
- keep registration generic in `workerRegistry.ts`
- keep job-specific behavior in focused worker modules

Examples:

- `src/worker/workerRegistry.ts`
- `src/worker/index.ts`

---

## Job Handler Patterns

The main worker entrypoint wires shared dependencies and delegates domain logic to
specialized worker helpers.

Current examples:

- `src/worker/index.ts`
- `src/worker/articleFilterWorker.ts`
- `src/worker/refreshAll.ts`
- `src/worker/aiDigestGenerate.ts`

Useful recurring patterns:

- derive queue send options from `getQueueSendOptions(...)`
- keep dedupe logic in queue contracts
- reuse repository and service modules instead of duplicating data access inside workers

---

## Scheduling and Bootstrap

Queue creation is bootstrapped through `bootstrapQueues(...)`.
Worker startup is centralized in `src/worker/index.ts`.

This means structural changes to queue names or contracts must update:

1. `src/server/queue/jobs.ts`
2. `src/server/queue/contracts.ts`
3. any sending call sites
4. any worker registration or handler references

---

## Common Mistakes

- Do not hardcode queue behavior in multiple files
- Do not bypass `getQueueSendOptions(...)` for jobs that already use singleton or retry policy
- Do not put large orchestration logic inside registration helpers
- Do not let route handlers execute long-running work inline if a queue already exists

---

## Good Reference Files

- `src/server/queue/contracts.ts`
- `src/server/queue/bootstrap.ts`
- `src/server/queue/jobs.ts`
- `src/worker/index.ts`
- `src/worker/workerRegistry.ts`

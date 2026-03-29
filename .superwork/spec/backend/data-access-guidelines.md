# Data Access Guidelines

> How repositories and persistence logic are implemented in this project.

---

## Overview

Repositories are the persistence boundary for PostgreSQL access. They should be
small, focused, and SQL-oriented.

This layer typically accepts either a `Pool` or `PoolClient`, runs SQL, and returns
typed rows or primitive results.

---

## Repository Patterns

Common patterns already used in the repo:

- define `type DbClient = Pool | PoolClient` when a function should work both
  inside and outside a transaction
- define repository-local row interfaces such as `FeedRow`
- map snake_case columns into camelCase fields in SQL aliases
- keep repository functions focused on one persistence responsibility

Examples:

- `src/server/repositories/feedsRepo.ts`
- `src/server/repositories/articlesRepo.ts`
- `src/server/repositories/settingsRepo.ts`

---

## SQL Mapping Rules

Prefer SQL aliases to keep row mapping centralized in the query itself.

Example pattern from `src/server/repositories/feedsRepo.ts`:

- `site_url as "siteUrl"`
- `full_text_on_open_enabled as "fullTextOnOpenEnabled"`
- `article_list_display_mode as "articleListDisplayMode"`

This keeps repository callers working with domain-friendly field names without
extra mapper objects scattered around the codebase.

---

## Update Functions

The current repo often builds dynamic update statements by collecting fields and
values incrementally.

Pattern:

- push SQL fragments into a `fields` array
- push values into a `values` array
- return `null` early if there is nothing to update
- append `updated_at = now()`

Reference:

- `src/server/repositories/feedsRepo.ts`

---

## Boundaries

Repositories should know:

- SQL
- table shapes
- persistence-specific row typing

Repositories should not know:

- HTTP request structure
- `NextResponse`
- route-specific logging concerns
- UI-only shapes

If a workflow needs transactions, category resolution, or multiple repo calls, move
that orchestration to `src/server/services`.

---

## Common Mistakes

- Do not duplicate the same SQL fragment across multiple repositories when one
  helper or query owner already exists
- Do not return raw `rows[0]` shapes without a typed contract
- Do not mix route validation logic into repositories
- Do not let repository functions grow into multi-step business workflows

---

## Good Reference Files

- `src/server/repositories/feedsRepo.ts`
- `src/server/repositories/articlesRepo.ts`
- `src/server/repositories/settingsRepo.ts`

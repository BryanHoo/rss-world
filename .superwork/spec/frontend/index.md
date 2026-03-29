# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

These docs capture the current conventions used in FeedFuse. They are based on the
existing codebase, not an idealized architecture. When adding or editing frontend
code, read the relevant files below before implementation.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Filled |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | Filled |
| [Hook Guidelines](./hook-guidelines.md) | Custom hook naming, patterns | Filled |
| [State Management](./state-management.md) | Local state, global state, server state | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | Filled |
| [Type Safety](./type-safety.md) | Type patterns, validation | Filled |

---

## Pre-Development Checklist

Always read these files first for any frontend behavior change:

1. [Directory Structure](./directory-structure.md)
2. [Quality Guidelines](./quality-guidelines.md)
3. [Type Safety](./type-safety.md)

Then read the area-specific guide that matches your task:

- UI or component work:
  [Component Guidelines](./component-guidelines.md)
- Hook or orchestration work:
  [Hook Guidelines](./hook-guidelines.md)
- Store, cache, hydration, or server-state work:
  [State Management](./state-management.md)

If the change touches multiple areas, read all relevant guides instead of choosing one.

---

## How To Use These Docs

- Follow the existing ownership boundaries under `src/`
- Reuse existing patterns before introducing new abstractions
- Match the surrounding file style when a directory is not fully normalized
- Treat the example files in each guide as the primary reference

---

## Scope Notes

These guidelines describe the frontend package as it exists today:

- Next.js App Router entrypoints under `src/app`
- shared UI primitives under `src/components/ui`
- feature-owned product code under `src/features`
- shared client state with Zustand under `src/store`
- strict TypeScript with runtime validation at boundaries

---

**Language**: All documentation in this directory should remain in English.

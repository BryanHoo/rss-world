# Bootstrap: Fill Backend Development Guidelines

## Goal

Document the backend conventions that already exist in this repository and store
them under `.superwork/spec/backend/`.

## Requirements

- Create a backend guideline index with a practical pre-development checklist.
- Document the current backend directory layout and ownership boundaries.
- Document App Router API route conventions and request validation patterns.
- Document service, repository, queue, and worker conventions based on real code.
- Document backend type-safety and runtime validation patterns.
- Document backend quality requirements, testing style, and common anti-patterns.
- Reference real files from `src/app/api`, `src/server`, and `src/worker`.

## Acceptance Criteria

- [ ] `.superwork/spec/backend/index.md` exists and points to the relevant guides.
- [ ] Each backend guide is written in English and based on the existing codebase.
- [ ] Each guide contains concrete examples with real repository file paths.
- [ ] Common mistakes and anti-patterns are documented.
- [ ] Task metadata is updated to reflect completion progress.

## Technical Notes

- Treat `src/app/api` as the HTTP entry boundary.
- Treat `src/server` as the main backend implementation area.
- Include queue and worker patterns where they affect backend architecture.
- Follow the same documentation style used in the completed frontend guideline set.

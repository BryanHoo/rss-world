# Quality Guidelines

## Required Verification Commands

Before claiming backend work is complete, run the project-standard checks from `package.json`:

```bash
pnpm lint
pnpm type-check
pnpm test
```

If the change is large and a narrower test target is justified during iteration, still finish with the standard commands unless the user explicitly narrows verification scope.

## Test Placement and Style

Keep tests close to the code they verify.

Current patterns:

- route tests beside route trees, for example `src/app/api/categories/routes.test.ts`
- repository tests beside repositories
- migration tests beside migration files
- worker / service / logging tests beside the corresponding server modules

## What To Test

### Route handlers

Cover:

- success responses
- request validation failures
- mapped conflict / not-found cases
- logging side effects when the route writes logs

Route tests in this repo usually mock:

- `getPool()`
- repositories
- logging helpers
- side-effectful server modules

### Repositories

Cover:

- SQL-driven behavior that can be unit-tested
- integration behavior when database semantics matter
- migration expectations for schema shape, indexes, and constraints

Examples:

- `src/server/repositories/repositories.integration.test.ts`
- `src/server/db/migrations/systemLogsMigration.test.ts`

### Runtime-sensitive modules

Add focused tests when a module relies on runtime packaging or singleton behavior.

Examples:

- `src/server/db/pool.test.ts`
- `src/server/runtimeDependencies.test.ts`

## Review Expectations

Backend changes should be reviewed for:

- correct layer placement
- request and env validation at boundaries
- SQL parameterization and alias correctness
- transaction ownership
- user-safe error mapping
- logging completeness without duplication
- regression coverage for the changed behavior

## Avoid

- Shipping backend changes without automated coverage for the new or changed path.
- Writing tests that only snapshot opaque payloads without asserting the contract.
- Skipping type-check because unit tests happen to pass.
- Hiding important backend regressions behind overly broad mocks.

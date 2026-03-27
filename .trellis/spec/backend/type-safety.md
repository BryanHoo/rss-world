# Type Safety

## Boundary Validation First

Validate unknown input as early as possible.

Current backend boundary patterns:

- `zod` schemas in route handlers for request bodies
- shared primitive schemas in `src/server/http/idSchemas.ts`
- `parseEnv()` / `getServerEnv()` for environment variables

Examples:

- `src/app/api/categories/route.ts`
- `src/app/api/feeds/route.ts`
- `src/server/env.ts`

Do not pass raw `unknown` request payloads into repositories or services.

## Export Concrete Interfaces

Repositories and services in this repo export explicit interfaces such as:

- `FeedRow`
- `CategoryRow`
- `CreateFeedWithCategoryInput`
- `UpdateFeedWithCategoryInput`

Prefer named exported interfaces or type aliases over anonymous object return contracts when the shape is reused or important to understand.

## Nullable vs Optional

Be explicit about the difference:

- use `undefined` for omitted input fields
- use `null` for persisted empty values or intentional clearing

Current patterns:

- route schemas use `.nullable().optional()` when both states matter
- repositories normalize missing persisted values to `null`
- service helpers normalize user-entered blanks before persistence

Examples:

- `categoryId` / `categoryName` handling in `src/app/api/feeds/route.ts`
- `normalizeCategoryName()` in `src/server/services/feedCategoryLifecycleService.ts`

## Database Type Mapping

Keep repository row interfaces aligned with SQL aliases.

Rules:

- alias snake_case database columns to camelCase result names in SQL
- keep the TypeScript interface and `returning` / `select` clauses synchronized
- convert textual counts to numbers explicitly when needed

Examples:

- `src/server/repositories/feedsRepo.ts`
- `src/server/repositories/systemLogsRepo.ts`

## Environment and Persisted Settings

Environment variables must be parsed through a schema, not read ad hoc from `process.env`.

Persisted settings should be normalized through dedicated helpers before use.

Example patterns:

- `src/server/env.ts`
- `src/features/settings/settingsSchema.ts`
- `src/server/logging/systemLogger.ts`

## Avoid

- `any` for request, env, or persistence boundaries.
- Returning raw database column naming into route responses.
- Encoding “missing” with both `undefined` and `null` in the same contract without a reason.
- Letting route params remain unchecked strings when a shared schema already exists.

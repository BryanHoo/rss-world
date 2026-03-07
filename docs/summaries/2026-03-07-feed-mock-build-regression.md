# Feed mock 构建回归

**Date:** 2026-03-07
**Status:** resolved
**Area:** `build` / `mock` / `types`
**Related:** `c5d8a33`, `docs/summaries/2026-03-07-rss-feed-fetch-error-indicator.md`, `docs/plans/2026-03-07-rss-feed-fetch-error-indicator-implementation-plan.md`

## Symptom

- 运行 `pnpm run build` 在 TypeScript 阶段失败。
- 具体报错：`./src/mock/data.ts:11:3 Type error: ... is missing the following properties from type 'Feed': fetchStatus, fetchError`

## Impact

- 生产构建被阻塞，无法继续发布或用 `build` 作为合并后的最终验收。
- 问题只出现在构建阶段，容易在单测和 lint 都通过时被遗漏。

## Root Cause

- `Feed` 类型在 RSS 拉取异常指示改造中新增了必填字段 `fetchStatus` / `fetchError`，但 `src/mock/data.ts` 里的 `mockFeeds` 仍然是旧结构。
- 这批 mock 数据不经过 `mapFeedDto()` 的兼容回填逻辑，因此直接触发了类型不匹配。

## Fix

- 为 `src/mock/data.ts` 中所有 mock feed 增加 `fetchStatus: null` 和 `fetchError: null` 默认值。
- 保持修复范围只在 mock 数据层，不改生产逻辑、不放宽 `Feed` 类型约束。
- Files:
  - `src/mock/data.ts`

## Verification (Evidence)

- Run: `pnpm run build`
  - Result: pass，完成编译、TypeScript 检查、page data 收集和静态页面生成

## Prevention / Follow-ups

- 以后给 `Feed` 增加必填字段时，除了 API / store / UI 链路，还要同步检查 `src/mock/data.ts` 这类直接声明 `Feed[]` 的 mock 源。
- 如果后续 mock 源继续增多，可考虑抽一个 `createMockFeed()` 工具集中提供默认字段，减少这类漏改。

## Notes

- 这次问题不是运行时 bug，而是合并后才在 `next build` 的类型检查阶段暴露。
- `mapFeedDto()` 已对真实接口的缺失字段做兼容回填，但该兼容策略不会覆盖手写 mock 字面量。

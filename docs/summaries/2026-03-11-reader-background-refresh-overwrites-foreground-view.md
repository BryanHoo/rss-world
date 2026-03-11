# Reader 后台刷新串改前台视图导致中栏空白

**Date:** 2026-03-11
**Status:** resolved
**Area:** reader / appStore snapshot state
**Related:** `docs/plans/2026-03-09-reader-visible-snapshot-refresh.md`, `5fcc507`, `2f29ecb`

## Symptom

- 手动点击“刷新订阅源”后，在刷新轮询仍在进行时切换到另一个订阅源，中栏会显示“这个订阅源还没有文章”。
- 期望是刷新作为后台任务运行，不影响当前前台订阅源的文章展示和交互。

## Impact

- reader 的前台视图会被后台刷新任务污染，用户切换订阅源时可能看到空白列表或错误的空状态。
- 这个问题不只影响手动刷新；任何显式传入 `view` 的后台 `loadSnapshot` 都可能串改当前 `selectedView` 的展示状态。

## Root Cause

- `src/store/appStore.ts` 只有一份全局 `articles`、一份全局 `snapshotLoading` 和一个全局 `snapshotRequestId`。`ArticleList` 的刷新轮询会捕获旧 `selectedView`，持续调用 `loadSnapshot({ view: oldView })`。用户切换到新订阅源后：
  - `setSelectedView` 不会恢复目标 view 之前已经加载过的文章缓存，前台只能等待新的 snapshot 请求返回；
  - 后台旧 view 的 `loadSnapshot` 仍会改写全局 `articles` 和 `snapshotLoading`；
  - 全局 `snapshotRequestId` 还会让后台旧 view 的后续轮询覆盖新 view 的请求序列，导致前台请求被判定为 stale。
- 最终表现就是：前台已经切到 feed B，但 store 仍被 feed A 的后台刷新牵着走，中栏按 feed B 过滤全局 `articles` 时得到空数组。

## Fix

- 为 store 增加按 `view` 维护的 `articleSnapshotCache`，切换视图时优先恢复该 view 最近一次成功加载的文章。
- 将 snapshot 请求序列改为按 `view` 跟踪，而不是共用一个全局 request id，避免后台请求取消或覆盖前台请求。
- 只允许当前前台 `selectedView` 的 `loadSnapshot` 更新全局 `articles` 和 `snapshotLoading`；后台刷新仍可更新 feed/category 元数据与对应 view 缓存。
- Files:
  - `src/store/appStore.ts`
  - `src/store/appStore.test.ts`

## Verification (Evidence)

- Run: `pnpm vitest run src/store/appStore.test.ts -t "restores cached articles immediately when switching back to a previously loaded feed|keeps foreground articles stable when loading a background view snapshot"`
  - Result: RED -> GREEN；新增 2 个回归测试先失败，修复后通过。
- Run: `pnpm vitest run src/store/appStore.test.ts src/features/articles/ArticleList.test.tsx src/app/'(reader)'/ReaderApp.test.tsx`
  - Result: PASS，3 files / 60 tests passed

## Prevention / Follow-ups

- 已添加 store 层回归测试，直接覆盖“视图切换恢复缓存”和“后台 snapshot 不改写前台状态”两条关键约束。
- 后续如果 reader 继续保留“全局 feed/category + 按 view 文章列表”的模型，新增后台同步逻辑时必须显式区分前台状态与后台缓存，不能再让后台任务直接写全局 `articles`。

## Notes

- 这类问题从 UI 表面看像“切换视图时瞬间空白”，但真正的耦合点在 store：单一 request id 和单一文章数组会把彼此独立的 view 请求绑成同一个状态机。

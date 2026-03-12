# Reader 页面激活刷新会清空已打开文章详情并重置滚动

**Date:** 2026-03-12
**Status:** resolved
**Area:** reader / appStore snapshot state
**Related:** `docs/summaries/2026-03-11-reader-background-refresh-overwrites-foreground-view.md`, `main (working tree, uncommitted)`

## Symptom

- 页面从后台重新激活后，reader 会自动刷新 snapshot。
- 如果右栏当前已经打开并滚动到中下部，刷新后正文会回到顶部，看起来像“右栏文章被重新加载了一次”。

## Impact

- 用户阅读长文时切出页面再回来，会丢失右栏阅读位置。
- 这个问题不只影响正文滚动；任何依赖已加载 article detail 的右栏状态，例如 AI 摘要草稿、翻译结果，也有被 snapshot 列表态数据覆盖的风险。

## Root Cause

- `ReaderApp` 的 `visibilitychange` 会调用 `loadSnapshot({ view: currentView })`。`loadSnapshot` 再用 `mapSnapshotArticleItem()` 把当前 view 的 `articles` 整体替换成 snapshot 列表项，而 snapshot 列表项的 `content` 固定为空字符串。结果是：当前已打开文章的正文和详情态字段先被清空，store 随后又因为 `!selectedArticle?.content` 触发一次 `getArticle` 补拉；右栏 DOM 在“正文消失 -> 重新出现”之间高度塌缩，滚动位置因此回到顶部。

## Fix

- 在 `loadSnapshot` 合并 snapshot 文章列表时，按 `view` 查找已有文章缓存，并为同 id 文章保留 detail-only 字段：
  - `content`
  - `aiSummary`
  - `aiSummarySession`
  - `aiTranslationZhHtml`
  - `aiTranslationBilingualHtml`
- 继续让 snapshot 覆盖列表态字段，如 `summary`、`isRead`、`isStarred`，确保左栏和中栏仍按最新 snapshot 刷新。
- 增加 store 层回归测试，锁定“刷新当前 view snapshot 时不允许把已打开文章详情清空，也不允许额外触发 article detail 补拉”。
- Files:
  - `src/store/appStore.ts`
  - `src/store/appStore.test.ts`

## Verification (Evidence)

- Run: `pnpm vitest run src/store/appStore.test.ts -t "keeps selected article detail when refreshing the visible snapshot"`
  - Result: RED -> GREEN；新增回归测试先失败，修复后通过。
- Run: `pnpm vitest run src/store/appStore.test.ts src/app/'(reader)'/ReaderApp.test.tsx src/features/articles/ArticleList.test.tsx`
  - Result: PASS，3 files / 62 tests passed。
- Run: `pnpm exec eslint src/store/appStore.ts src/store/appStore.test.ts`
  - Result: PASS，无 lint 错误。

## Prevention / Follow-ups

- 已添加 store 层回归测试，直接覆盖“visible snapshot 刷新时保留已加载 article detail”的约束。
- 后续 reader 若继续沿用“snapshot 列表态 + article detail 按需补拉”的模型，任何新的自动刷新入口都必须显式区分列表字段与详情字段，不能再整条替换同 id 文章对象。

## Notes

- 这个问题表面像滚动条 bug，但真正的根因在于 store 状态建模：snapshot 列表项不包含详情字段，直接覆盖当前文章对象会破坏右栏的稳定性。

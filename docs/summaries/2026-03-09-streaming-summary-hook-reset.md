# 流式摘要 Hook 因回调身份变化反复重置

**Date:** 2026-03-09
**Status:** resolved
**Area:** reader / streaming ai summary
**Related:** `docs/plans/2026-03-09-ai-summary-sse.md`, `bd7d211`, `0a2f897`

## Symptom

- `src/features/articles/ArticleView.aiSummary.test.tsx` 中“自动模式打开文章后会显示流式摘要草稿并接收 delta”超时 5000ms。
- “重新进入文章时会先显示运行中的摘要草稿并继续接收 SSE”里，`summary.delta` 发出后 UI 仍停留在 `TL;DR`，没有变成 `TL;DR - 第一条`。

## Impact

- `ArticleView` 中的流式 AI 摘要在实际页面上可能被重复 render 打断，导致草稿、完成回调或 SSE 连接表现不稳定。
- 自动摘要打开、恢复运行中会话、失败后重试这些交互都可能出现偶发失效。

## Root Cause

- `useStreamingAiSummary` 的 `connectStream` 依赖了 `input.onCompleted`。`ArticleView` 传入的是内联 `async (articleId) => refreshArticle(articleId)`，所以每次 render 都会生成新函数，导致 `connectStream` 身份变化。hook 的初始化 `useEffect` 又依赖 `connectStream`，结果每次 render 都会重置 session、关闭并重建 stream，最终把正在接收的流式状态打断。

## Fix

- 将 `onCompleted` 保存到 ref 中，让 `connectStream` 和初始化 effect 不再依赖不稳定的回调身份。
- 保留完成时刷新文章详情的行为，但改为通过 `onCompletedRef.current` 调用最新回调。
- 增加保护测试，确认流式摘要主链路不再回退到 `getArticleTasks` 轮询。
- Files:
  - `src/features/articles/useStreamingAiSummary.ts`
  - `src/features/articles/ArticleView.tsx`
  - `src/features/articles/ArticleView.aiSummary.test.tsx`

## Verification (Evidence)

- Run: `pnpm vitest run src/server/db/migrations/articleAiSummaryStreamingMigration.test.ts src/server/repositories/articleAiSummaryRepo.test.ts src/server/ai/streamSummarizeText.test.ts src/worker/aiSummaryStreamWorker.test.ts src/app/api/articles/routes.test.ts src/app/api/articles/'[id]'/ai-summary/stream/route.test.ts src/lib/apiClient.test.ts src/store/appStore.test.ts src/features/articles/useStreamingAiSummary.test.ts src/features/articles/ArticleView.aiSummary.test.tsx src/features/articles/ArticleView.aiTranslate.test.tsx`
  - Result: PASS, 11 files / 117 tests passed

## Prevention / Follow-ups

- 已添加 `ArticleView` 回归测试，覆盖自动打开、恢复运行中 session、失败后重试，以及“不额外轮询 article tasks”。
- 后续在新增流式 hook 时，避免让 stream 生命周期直接依赖调用方传入的内联回调；优先用 ref 或稳定事件包装。

## Notes

- 这类问题在 hook 单测里不一定会暴露，因为测试常传入稳定的 `vi.fn()`，而真实组件更容易传内联闭包。

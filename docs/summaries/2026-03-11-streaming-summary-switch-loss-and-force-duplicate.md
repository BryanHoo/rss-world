# 流式摘要切换文章后丢草稿且强制重试卡死

**Date:** 2026-03-11
**Status:** resolved
**Area:** reader / streaming ai summary
**Related:** `docs/summaries/2026-03-09-streaming-summary-hook-reset.md`, `main (working tree, uncommitted)`

## Symptom

- AI 摘要正在流式输出时，切换到其他文章再切回来，之前已经输出的摘要草稿不显示。
- 回到原文章后再次点击“生成摘要”，UI 进入加载但不会继续输出新的摘要内容。

## Impact

- 阅读器中的 AI 摘要无法在文章切换后恢复正在生成的草稿，用户会误以为摘要进度丢失。
- 对运行中摘要再次点击“生成摘要”可能把后端会话推进到一个不会继续产出的状态，导致前端持续看不到后续输出。

## Root Cause

- 这是两个缺陷叠加：
  - `useStreamingAiSummary` 只保留当前文章的一份本地 session。切到其他文章并发起新的摘要请求后，上一文章的流式 draft 会被新文章状态覆盖；如果服务端当时还没把最新 draft 持久化进 article 详情，切回来就看不到已输出内容。
  - `/api/articles/[id]/ai-summary` 在 `force=true` 时没有优先短路运行中的 summary session。前端再次点击“生成摘要”会尝试新建 session；如果队列因为 singleton 去重返回 duplicate，路由仍可能留下一个新的空 `queued` session，并把旧运行中 session supersede 掉，最终前端只能连到一个不会继续产出的 session。

## Fix

- 将 `useStreamingAiSummary` 的本地状态改为按 `articleId` 缓存，保留每篇文章各自的 `loading / missingApiKey / waitingFulltext / session`。
- 切回存在 `queued/running` session 的文章时，优先恢复该文章的本地 draft，并自动重新建立 SSE 连接继续接收后续事件。
- 调整 `/api/articles/[id]/ai-summary` 的判定顺序：只要已有 `queued/running` session，就直接返回 `already_enqueued` 和现有 `sessionId`，即使请求带了 `force=true` 也不再新建/替换 session。
- 增加回归测试，分别覆盖“切换文章后恢复草稿”和“`force + duplicate` 时复用运行中 session”。
- Files:
  - `src/features/articles/useStreamingAiSummary.ts`
  - `src/features/articles/useStreamingAiSummary.test.ts`
  - `src/app/api/articles/[id]/ai-summary/route.ts`
  - `src/app/api/articles/routes.test.ts`

## Verification (Evidence)

- Run: `pnpm test:unit src/features/articles/useStreamingAiSummary.test.ts -t "preserves draft text for each article when switching away and back"`
  - Result: RED -> GREEN；新增回归测试先失败，修复后通过。
- Run: `pnpm test:unit src/app/api/articles/routes.test.ts -t "POST /:id/ai-summary force=true keeps the running session when enqueue is duplicate"`
  - Result: RED -> GREEN；新增路由回归测试先失败，修复后通过。
- Run: `pnpm test:unit src/features/articles/useStreamingAiSummary.test.ts`
  - Result: PASS，1 file / 3 tests passed。
- Run: `pnpm test:unit src/features/articles/ArticleView.aiSummary.test.ts`
  - Result: PASS，1 file / 15 tests passed；存在既有 `act(...)` warning，但未新增失败。
- Run: `pnpm test:unit src/app/api/articles/routes.test.ts`
  - Result: PASS，1 file / 44 tests passed。
- Run: `pnpm exec eslint src/features/articles/useStreamingAiSummary.ts 'src/app/api/articles/[id]/ai-summary/route.ts' src/features/articles/useStreamingAiSummary.test.ts src/app/api/articles/routes.test.ts`
  - Result: PASS，无 lint 错误。

## Prevention / Follow-ups

- 已添加 hook 层回归测试，锁定“跨文章切换时保留本地 draft”的约束。
- 已添加路由层回归测试，锁定“运行中 session 优先复用，不因 force 点击创建空替身 session”的约束。
- 后续凡是“按实体切换但 hook 常驻”的流式功能，都应默认按实体 id 缓存本地状态，而不是只存一份全局当前值。

## Notes

- 这个问题表面像一个前端显示 bug，实际是“前端本地缓存策略 + 后端 force/duplicate 会话语义”共同造成的。只修一边会留下残缺行为：
  - 只修前端，切回来可能暂时看到旧 draft，但再次强制点击仍可能把运行中 session 打成空壳。
  - 只修后端，强制点击不再卡死，但切换文章后仍会丢失尚未刷回 article 详情的本地 draft。

# 阅读页滚动辅助按钮

**Date:** 2026-03-07
**Status:** resolved
**Area:** reader / articles
**Related:** `docs/plans/2026-03-07-reader-scroll-assist-implementation-plan.md`

## Symptom

- 阅读页桌面端仍然使用右侧目录浮层作为长文辅助入口，交互重心偏向章节跳转，而不是阅读进度与快速回顶。
- 目录面板引入了额外的右侧布局计算与显示条件，不适合本次更轻量的阅读辅助目标。
- 新交互需要与现有浮动标题的显示阈值保持一致，避免同一滚动位置出现两套不同的“已离开标题区”判断。

## Impact

- 长文阅读时，用户缺少固定、低干扰的进度反馈和回到顶部入口。
- `ArticleView` 继续维护目录面板布局会增加无关状态与回归面。

## Root Cause

- 现有阅读辅助能力建立在“目录浮层”抽象上，滚动事实、可见性判断和右侧面板布局都围绕目录跳转设计；要切换到右下角进度圆环 + 回顶按钮，必须把阅读辅助重新收敛为基于滚动容器的单一局部状态，而不是继续复用旧目录 UI 壳层。

## Fix

- 新增 `ArticleScrollAssist`，提供阅读百分比圆环、百分比文本、`回到顶部` 按钮以及 0-100 clamp。
- 在 `ArticleView` 中直接基于 `article-scroll-container` 计算滚动百分比，复用 `FLOATING_TITLE_SCROLL_THRESHOLD_PX` 控制显示时机，并用 `scrollTo({ top: 0, behavior: 'smooth' })` 处理回顶。
- 删除不再使用的 `ArticleOutlineRail` 组件和测试，把 `articleOutline.ts` 收缩为仅保留 heading 提取/marker/active-heading helper。
- Files:
  - `src/features/articles/ArticleScrollAssist.tsx`
  - `src/features/articles/ArticleScrollAssist.test.tsx`
  - `src/features/articles/ArticleView.tsx`
  - `src/features/articles/ArticleView.outline.test.tsx`
  - `src/features/articles/articleOutline.ts`
  - `src/features/articles/articleOutline.test.ts`
  - `src/features/articles/ArticleOutlineRail.tsx`
  - `src/features/articles/ArticleOutlineRail.test.tsx`

## Verification (Evidence)

- Run: `pnpm exec vitest run src/features/articles/ArticleScrollAssist.test.tsx --project=jsdom --no-file-parallelism`
  - Result: `1 passed, 4 passed`
- Run: `pnpm exec vitest run src/features/articles/ArticleView.outline.test.tsx --project=jsdom --no-file-parallelism`
  - Result: `1 passed, 3 passed`
- Run: `pnpm exec vitest run src/features/reader/ReaderLayout.test.tsx -t "floating title"`
  - Result: `1 skipped, 10 skipped`（过滤条件未命中现有测试名）
- Run: `pnpm exec vitest run src/features/reader/ReaderLayout.test.tsx -t "floating article title"`
  - Result: `1 passed | 9 skipped`

## Prevention / Follow-ups

- 已为滚动辅助组件、`ArticleView` 集成行为和保留的 outline helper 添加/更新回归测试，锁定显示时机、百分比计算与回顶交互。
- 后续如果继续扩展阅读辅助交互，优先复用 `article-scroll-container` 的局部滚动事实源，避免重新引入右侧布局测量状态。

## Notes

- 计划中的 `pnpm exec vitest run src/features/reader/ReaderLayout.test.tsx -t "floating title"` 会跳过全部测试，因为现有测试名为 `shows clickable floating article title after scrolling the reader pane`。
- 本次改动不会移除测试环境已有的 ``--localstorage-file`` warning；该 warning 在相关测试中仍会出现，但与本次实现无关。

# 阅读器右侧目录浮层重设计总结

**Date:** 2026-03-07
**Status:** resolved
**Area:** reader / articles
**Related:** `docs/plans/2026-03-07-reader-outline-panel-redesign-design.md`, `docs/plans/2026-03-07-reader-outline-panel-redesign-implementation-plan.md`

## Symptom

- 原有目录依赖正文内 `hover rail` 展开，滚动时像悬浮控件而不是阅读辅助层。
- 目录挂在 `article-scroll-container` 内部，无法稳定停留在正文右侧空白区。
- 目录缺少“短文章隐藏”和“右侧空白不足时隐藏”的显示约束。

## Impact

- 桌面阅读体验不稳定，目录存在感偏强且容易随正文实现细节漂移。
- 三栏布局调整后，目录位置与宽度难以与正文右侧空白保持一致。

## Root Cause

- 目录实现把交互、定位和显示条件耦合在正文滚动层内，导致它既依赖 hover 语义，也无法通过独立测量正文容器与阅读区容器来计算稳定布局。

## Fix

- 将目录显示规则与布局计算提炼为纯 helper，并以最终渲染 DOM 作为 heading 事实源。
- 将 `ArticleOutlineRail` 改为常驻、低存在感的 `nav` 面板，保留当前项轻量高亮与单行截断。
- 在 `ArticleView` 中把目录抽离到滚动容器外，使用 `ResizeObserver` + 局部 state 驱动长文显示、右侧空白自适应和点击跳转。
- Files:
  - `src/features/articles/articleOutline.ts`
  - `src/features/articles/articleOutline.test.ts`
  - `src/features/articles/ArticleOutlineRail.tsx`
  - `src/features/articles/ArticleOutlineRail.test.tsx`
  - `src/features/articles/ArticleView.tsx`
  - `src/features/articles/ArticleView.outline.test.tsx`

## Verification (Evidence)

- Run: `pnpm exec vitest run src/features/articles/articleOutline.test.ts src/features/articles/ArticleOutlineRail.test.tsx src/features/articles/ArticleView.outline.test.tsx --project=jsdom --no-file-parallelism`
  - Result: `3 passed, 15 tests passed`
- Run: `pnpm run test:unit -- src/features/articles/articleOutline.test.ts src/features/articles/ArticleOutlineRail.test.tsx src/features/articles/ArticleView.outline.test.tsx`
  - Result: `112 passed | 1 skipped (113)`

## Prevention / Follow-ups

- 添加 helper、组件、集成三层回归测试，覆盖长文显示、短文隐藏、右侧空白不足隐藏与点击跳转。
- 保持目录状态局部化，不把显示或 active heading 写入全局 store。
- 已知测试环境仍会打印 ``--localstorage-file`` warning，本次改动未引入新 warning。

## Notes

- 计划示例里的 `OUTLINE_PANEL_MAX_WIDTH_PX` 与断言存在冲突；实现按测试期望采用 `220px` 上限。
- 目录显示基于最终渲染 HTML，因此兼容全文抓取和沉浸式翻译后的 heading 变化。

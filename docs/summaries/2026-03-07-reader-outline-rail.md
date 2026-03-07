# 2026-03-07 阅读栏浮动目录

## Context

- Branch: `codex-reader-outline-rail`
- Related plan: `docs/plans/2026-03-07-reader-outline-rail-implementation-plan.md`

## What Shipped

- 在 `src/features/articles/ArticleView.tsx` 的正文滚动容器内添加了一个绝对定位的浮动目录轨道，不改变三栏布局宽度分配。
- 目录轨道默认只展示视口进度和正文 `h1/h2/h3` 分布；鼠标移入后展开为小型目录卡片，鼠标移出后延迟收起，减少从轨道移动到卡片时的闪烁。
- 目录项基于最终渲染后的正文 DOM 提取，并为重复标题生成稳定、唯一的锚点 id。
- 点击目录项会驱动 `article-scroll-container` 平滑滚动到对应 heading，同时正文滚动会同步更新当前章节高亮与视口位置。
- 当正文没有 `h1/h2/h3` 时，整个目录入口不会渲染。

## Why This Interaction

- 选用“窄轨道常驻 + hover 展开目录卡片”，是因为正文右栏已经是剩余空间列；绝对定位浮层比新增常驻目录列更克制，不会继续挤压正文宽度。
- 收起态只表达“读到哪里”和“文章大概分几节”，把默认干扰降到最低；需要跳转时再通过 hover 揭示完整标题，兼顾轻量感和可发现性。
- 点击滚动仍然绑定到现有正文滚动容器，避免引入新的全局状态或多套滚动来源。

## Prior Learnings Applied

- `docs/summaries/2026-03-06-reader-resizable-three-column-layout.md`
  - 延续了“右栏能力优先采用绝对定位浮层，而不是再切分布局宽度”的经验。
- `docs/summaries/2026-03-05-translation-preserve-html-structure.md`
  - 目录提取基于最终渲染 DOM，而不是从文章元数据单独生成，保证全文、沉浸式翻译等场景下结构保持一致。
- `docs/summaries/2026-03-06-middle-column-image-loading.md`
  - 滚动和视口同步维持在局部组件状态中，避免把高频 UI 状态写入全局 store。

## Files

- `src/features/articles/articleOutline.ts`
- `src/features/articles/articleOutline.test.ts`
- `src/features/articles/ArticleOutlineRail.tsx`
- `src/features/articles/ArticleOutlineRail.test.tsx`
- `src/features/articles/ArticleView.tsx`
- `src/features/articles/ArticleView.outline.test.tsx`

## Verification

- Heading 提取与稳定锚点
  - Run: `pnpm exec vitest run src/features/articles/articleOutline.test.ts --project=jsdom --no-file-parallelism`
  - Covers: 仅提取 `h1/h2/h3`、过滤其他 heading、重复标题生成稳定唯一 id。
- Hover 展开与空目录隐藏
  - Run: `pnpm exec vitest run src/features/articles/ArticleOutlineRail.test.tsx --project=jsdom --no-file-parallelism`
  - Covers: 无 heading 时不渲染、hover 后展开目录卡片并显示目录项。
- `ArticleView` 集成、点击跳转、正文重建安全
  - Run: `pnpm exec vitest run src/features/articles/ArticleView.outline.test.tsx --project=jsdom --no-file-parallelism`
  - Covers: 正文含 heading 时渲染轨道、hover 后展示目录项、点击目录项触发滚动、正文 HTML 变化后重建目录。
- 聚焦回归
  - Run: `pnpm exec vitest run src/features/articles/articleOutline.test.ts src/features/articles/ArticleOutlineRail.test.tsx src/features/articles/ArticleView.outline.test.tsx --project=jsdom --no-file-parallelism`
  - Result: `3` 个测试文件、`6` 个测试通过。
- 代码质量
  - Run: `pnpm run lint`
  - Result: PASS。

## Notes

- 测试输出仍会出现仓库既有的 `--localstorage-file` warning；它不影响本次目录功能的测试结果，本次未额外处理。

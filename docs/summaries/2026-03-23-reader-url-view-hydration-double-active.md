---
id: 2026-03-23-reader-url-view-hydration-double-active
date: 2026-03-23
area: reader-navigation
kind: debugging
symptoms:
  - 首次打开带 `?view=` 的阅读页时，“全部文章”和目标 feed 同时高亮
  - 首次异常状态下继续切换 feed 时，“全部文章”高亮会残留
  - 点击一次“全部文章”清掉 query 后，后续切换恢复正常
keywords:
  - reader
  - hydration
  - query-param
  - selectedView
  - all-active
  - aria-current
  - FeedList
  - ArticleList
files:
  - src/app/(reader)/page.tsx
  - src/features/reader/ReaderLayout.tsx
  - src/features/feeds/FeedList.tsx
  - src/features/articles/ArticleList.tsx
  - src/features/reader/ReaderLayout.test.tsx
decision: 只在路由显式提供初始 `view` 时参与 SSR 首屏选择态，否则 SSR/首次客户端渲染先用中性 sentinel，避免把 `all` 错写进 DOM。
related:
---

# Reader URL View Hydration Double Active

## Symptom

- Docker 首启后，如果页面 URL 带 `?view=<feedId>`，首屏会出现“全部文章”和目标 feed 双高亮
- 此时第一次再点别的 feed，URL 会变化，但“全部文章”仍保持高亮
- 先点一次“全部文章”把 URL 清回 `/` 后，后续切换恢复为单高亮

## Impact

- 左侧导航的 `aria-current` 和视觉高亮失真
- 首屏 hydration 会留下错误 DOM，后续第一次切换会沿用这个错误基线
- `ArticleList` 的首屏标题/刷新按钮文案也会跟着产生 hydration mismatch

## Root Cause

- `appStore` 在服务端渲染时拿不到浏览器 URL，首屏 `selectedView` 默认是 `all`
- 客户端模块初始化会从 `window.location.search` 恢复真实 `selectedView`
- 当 URL 带 `?view=` 时，服务端和客户端首屏选择态不同，React hydration 不会自动补丁修正已有属性，导致“全部文章”的 `aria-current` / 高亮类残留
- `FeedList` 和 `ArticleList` 都直接依赖 store 的 `selectedView` 做首屏渲染，因此一个留下双高亮，一个留下 header/按钮文案 mismatch

## Fix

- 在 `src/app/(reader)/page.tsx` 解析 `searchParams.view`，作为显式的 `initialSelectedView`
- 通过 `ReaderApp` / `ReaderLayout` 透传这份初始选择态
- `FeedList` 和 `ArticleList` 只在路由显式提供初始 `view` 时使用它参与 SSR/首次客户端渲染
- 当没有显式路由选择态时，SSR 和首次客户端渲染都先走中性 sentinel，等 layout effect 后再切回 store 的真实 `selectedView`

## Verification

- Run: `pnpm test:unit src/features/reader/ReaderLayout.test.tsx src/app/(reader)/ReaderApp.test.tsx src/features/feeds/FeedList.test.tsx src/features/articles/ArticleList.test.tsx`
  - Result: pass，119 个测试通过
- Run: `pnpm build`
  - Result: pass，Next.js 生产构建成功

## Prevention / Follow-ups

- 对任何依赖 URL 恢复状态的首屏选择态，都不要直接让 SSR 首屏依赖客户端 store 默认值
- 如果 SSR 不能稳定得到该状态，要么由路由显式透传，要么在 SSR/首次客户端渲染阶段统一走中性占位状态
- 保留 `ReaderLayout.test.tsx` 中的 hydration 回归测试，防止 `?view=` 再次带回双高亮

## Notes

- 浏览器自动化复现路径最关键：直接打开 `/?view=1`，会立即看到双高亮；继续点别的 feed 时双高亮会延续
- 单纯在 jsdom 里点击 feed 不足以复现，必须模拟“服务端首屏默认 all + 客户端首屏恢复 URL view”这条路径

# Reader SSR 首帧快照与 useState 字面量窄化

**Date:** 2026-03-11
**Status:** resolved
**Area:** reader / SSR hydration / TypeScript build
**Related:** 无

## Symptom

- 浏览器出现 React hydration mismatch，错误信息包含：
  - `Hydration failed because the server rendered HTML didn't match the client.`
  - React 文案明确指出可能原因包括 `if (typeof window !== 'undefined')` 和 `Date.now() / new Date()`
- `pnpm run build` 在 `Running TypeScript ...` 阶段失败，报错：
  - `Argument of type '(currentWidth: 1024) => number' is not assignable to parameter of type 'SetStateAction<1024>'`

## Impact

- reader 首屏在移动端会先渲染出错误的桌面/非桌面结构，再整树重建，带来布局跳动、额外 CPU 开销和潜在焦点丢失。
- 相对时间与“今天/昨天”分组如果直接依赖首帧 `new Date()`，SSR HTML 与客户端首次渲染会漂移。
- 单测可以全部通过，但 `next build` 仍会在独立 TypeScript 检查阶段失败，容易在临近合并时才暴露。

## Root Cause

- `ReaderLayout`、`ArticleView`、`ArticleList` 在首帧 render 阶段直接读取 `window.innerWidth` 或 `new Date()`，而页面是 SSR/预渲染输出，导致服务器 HTML 与客户端首次 render 使用了不同输入。
- 为了消除 viewport mismatch，把初始 state 改成稳定常量后，如果直接写 `useState(READER_RESIZE_DESKTOP_MIN_WIDTH)` 或 `useState(true)`，TypeScript 会把 state 推断成字面量类型（如 `1024`、`true`）。运行测试时通常不显眼，但 `next build` 的完整类型检查会拒绝后续的 `setState(number | boolean)`。

## Fix

- 从服务端页面入口下发稳定的 `renderedAt`，首帧时间文案统一基于该快照计算，挂载后再增强到客户端当前时间。
- 新增 `useRenderTimeSnapshot`，让 `ArticleList` 和 `ArticleView` 共用同一套首帧时间基准，避免“今天/昨天”和相对时间在 hydrate 时漂移。
- `ReaderLayout` 与 `ArticleView` 的 viewport 相关 state 改为稳定初始值，再在挂载后同步真实窗口宽度，避免 SSR/client 首次 render 分叉。
- 对响应式 state 显式添加泛型，避免字面量类型窄化在 `next build` 阶段触发。
- Files:
  - `src/app/(reader)/page.tsx`
  - `src/app/(reader)/ReaderApp.tsx`
  - `src/hooks/useRenderTimeSnapshot.ts`
  - `src/utils/date.ts`
  - `src/utils/date.test.ts`
  - `src/features/reader/ReaderLayout.tsx`
  - `src/features/reader/ReaderLayout.test.tsx`
  - `src/features/articles/ArticleList.tsx`
  - `src/features/articles/ArticleView.tsx`

## Verification (Evidence)

- Run: `pnpm exec vitest run src/features/reader/ReaderLayout.test.tsx src/utils/date.test.ts src/features/articles/ArticleList.test.tsx src/features/articles/ArticleView.titleLink.test.tsx`
  - Result: PASS，4 files / 57 tests passed；新增 hydration 与时间快照回归测试通过。
- Run: `pnpm test:unit`
  - Result: PASS，130 files passed / 1 skipped，539 tests passed / 4 skipped。
- Run: `pnpm run build`
  - Result: PASS；完成 `Compiled successfully`、`Running TypeScript`、`Generating static pages`，退出码 `0`。

## Prevention / Follow-ups

- 已添加 reader hydration 回归测试，直接检查服务端 HTML hydrate 到移动端时不再出现 mismatch。
- 以后凡是 SSR 页面里的首帧时间文案、相对时间、今天/昨天分组，都应优先使用服务端快照值，而不是在 render 阶段直接 `new Date()`。
- 以后凡是把响应式 state 初始值改成常量字面量时，优先写成 `useState<number>(...)`、`useState<boolean>(...)`，不要依赖默认推断。

## Notes

- 这是一个“测试绿但 build 红”的典型组合问题：Vitest 不一定覆盖 `next build` 的完整类型收窄路径，所以改完渲染逻辑后必须补跑构建。
- `useState` 字面量窄化在布尔值和断点常量上都容易出现，尤其是后续还要通过 `setState` 写入运行时值的场景。

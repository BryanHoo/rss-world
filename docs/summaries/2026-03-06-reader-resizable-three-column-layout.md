# 阅读器三栏可拖拽宽度

**Date:** 2026-03-06
**Status:** resolved
**Area:** reader layout / settings persistence
**Related:** `docs/plans/2026-03-06-reader-resizable-three-column-layout-implementation-plan.md`

## Symptom

- 阅读器左栏和中栏宽度是固定值，桌面三栏无法按用户偏好调整。
- 侧栏收起后重新展开时，左栏无法恢复到用户上次使用的宽度。
- 中栏扩宽时没有保护右栏最小阅读宽度，窄屏场景也不应暴露拖拽交互。

## Impact

- 桌面阅读体验缺少个性化布局能力。
- 高频拖拽交互如果直接写入全局 store，会放大不必要的重渲染风险。
- 历史 `sidebarCollapsed` 语义必须保持不变，不能让远端设置反向覆盖 `appStore`。

## Root Cause

- `ReaderLayout` 依赖固定 Tailwind 宽度类，没有共享的栏宽常量、持久化字段和拖拽状态机。
- `settingsStore` 只有面向通用外观设置的更新入口，没有针对阅读器局部布局偏好的轻量更新接口。

## Fix

- 添加阅读器栏宽常量与 `normalizeReaderPaneWidth`，并在设置归一化阶段为 `leftPaneWidth` / `middlePaneWidth` 提供默认值和边界保护。
- 让 `ReaderLayout` 读取持久化宽度，渲染左右分割线骨架，并在组件内使用局部 state + ref 处理拖拽过程中的实时宽度。
- 为左栏与中栏分别接入 `pointer` 拖拽；仅在桌面阈值以上渲染 handle，中栏拖拽时保留右栏最小宽度。
- 添加 `updateReaderLayoutSettings` 专用入口，仅在 `pointerup` 后落盘，避免高频拖拽持续写入全局 store。
- Files:
  - `src/features/reader/readerLayoutSizing.ts`
  - `src/features/reader/ResizeHandle.tsx`
  - `src/features/reader/ReaderLayout.tsx`
  - `src/features/reader/ReaderLayout.test.tsx`
  - `src/features/settings/settingsSchema.ts`
  - `src/features/settings/settingsSchema.test.ts`
  - `src/store/settingsStore.ts`
  - `src/types/index.ts`

## Verification (Evidence)

- Run: `pnpm exec vitest run src/features/settings/settingsSchema.test.ts -t "adds reader pane width defaults and clamps persisted values"`
  - Result: pass
- Run: `pnpm exec vitest run src/features/reader/ReaderLayout.test.tsx -t "renders persisted pane widths and restores left pane width after re-expanding sidebar"`
  - Result: pass
- Run: `pnpm exec vitest run src/features/reader/ReaderLayout.test.tsx -t "persists left pane width after dragging the left separator"`
  - Result: pass
- Run: `pnpm exec vitest run src/features/reader/ReaderLayout.test.tsx -t "clamps middle pane drag to preserve right pane minimum width|does not render resize handles below desktop breakpoint"`
  - Result: pass
- Run: `pnpm exec vitest run src/features/reader/ReaderLayout.test.tsx`
  - Result: `8` tests passed
- Run: `pnpm exec vitest run 'src/app/(reader)/ReaderApp.test.tsx' -t "does not apply removed sidebarCollapsed setting from persisted settings"`
  - Result: `1` test passed, `3` skipped
- Run: `pnpm run test:unit`
  - Result: `98` files passed, `1` skipped; `371` tests passed, `4` skipped

## Prevention / Follow-ups

- 已补充 `ReaderLayout` 与 `settingsSchema` 回归测试，锁定默认值、拖拽持久化、桌面阈值和历史 `sidebarCollapsed` 边界。
- 后续如果继续扩展阅读器布局交互，优先复用 `readerLayoutSizing` 和局部 state/ref 模式，避免把高频位移直接写入 store。

## Notes

- 全量测试通过，但仓库现有若干测试仍会输出与本次改动无关的 `act(...)` / `fetch failed` warning；未在本次任务中处理。

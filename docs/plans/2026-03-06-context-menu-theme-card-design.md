# 右键菜单主题同步轻量卡片化设计

**Date:** 2026-03-06
**Status:** approved
**Area:** `feeds` / `ui`
**Related:**
- `docs/summaries/2026-03-06-rss-feed-context-menu-redesign.md`
- `docs/summaries/2026-03-06-rss-feed-context-menu-move-category.md`

## 背景

- 当前 RSS 源与分类右键菜单虽然功能完整，但视觉仍偏深色玻璃浮层。
- 页面整体是会跟随主题切换的阅读器布局：浅色主题以轻量卡片和低对比边界为主，深色主题再增强层次。
- 现有右键菜单在浅色主题下仍显得过深、过宽，导致和侧栏、文章列表、设置按钮等区域不属于同一套语言。

## 目标

- 将右键菜单统一为 **跟随浅/深主题切换的轻量卡片风格**。
- 分类菜单与 RSS 源菜单使用 **完全同一套共享菜单系统**。
- 收敛主菜单与子菜单宽度，让菜单从“面板感”回到“上下文卡片感”。
- 保持现有 Radix 交互、键盘导航、禁用态和业务流程不变。

## 非目标

- 不改动 `FeedList` 的数据流、状态管理、API 调用或提示文案语义。
- 不新增新的业务能力。
- 不为其它模块的菜单同步改造视觉，范围仅限当前共享 `ContextMenu` 以及 `FeedList` 的两类右键菜单。

## 设计方向

### 1. 视觉基底

- 主菜单与子菜单都采用 `bg-popover` / `text-popover-foreground` 为核心的主题同步样式。
- 浅色主题：浅底、细边框、柔和阴影、轻度 backdrop blur。
- 深色主题：深底、保留层次与阴影，但不再使用当前厚重的深玻璃质感。
- 分隔线弱化，更多依靠分组节奏与留白建立层级。

### 2. 尺寸与空间

- 收敛共享菜单最小宽度，避免默认打开就是大面板。
- RSS 源菜单宽度略大于分类菜单，但二者属于同一视觉档位。
- 子菜单比主菜单更窄，避免展开后横向体积失控。
- 菜单项横向 padding 收紧，辅助信息不再过度占据右侧空间。

### 3. 菜单项语义

- 继续保留 `ContextMenuItemIcon`、`ContextMenuItemLabel`、`ContextMenuItemHint` 的结构化表达。
- hover / focus 反馈切换为基于 `accent` 的低对比状态，而不是偏发光的高亮块。
- `destructive` 仍保留危险态区分，但改成更克制的主题适配色。
- 当前分类的 `当前` 提示保留，但弱化到更适合紧凑菜单的节奏。

## 组件影响范围

### `src/components/ui/context-menu.tsx`

- 将共享菜单面板从固定深色玻璃风格改为主题同步卡片风格。
- 同步调整 `ContextMenuContent`、`ContextMenuSubContent`、`ContextMenuItem`、`ContextMenuSubTrigger`、`ContextMenuSeparator`。
- 让主菜单和子菜单默认尺寸更精致、更统一。

### `src/features/feeds/FeedList.tsx`

- 为分类右键菜单与 RSS 源右键菜单设置更克制的宽度覆盖。
- 维持已有菜单信息架构，只调整分组节奏与局部宽度。
- 不改事件处理和已有业务逻辑。

### `src/features/feeds/FeedList.test.tsx`

- 保持当前关键交互回归覆盖。
- 视需要新增轻量断言，确保分类菜单与 RSS 菜单在收敛后仍能稳定查询和展开。

## 风险与约束

- 视觉需求以共享组件为主，避免把 className 分散硬编码到业务层。
- 样式收敛不能破坏 `menuitem`、`submenu`、禁用态、键盘导航等可访问性语义。
- 宽度收敛要兼顾中文文案与 `hint`，避免过度挤压导致阅读体验下降。

## 验证策略

- 使用 `src/features/feeds/FeedList.test.tsx` 作为主要回归面，验证：
  - 分类菜单和 RSS 菜单都能正常打开。
  - `移动到分类` 子菜单仍可展开。
  - `当前` / `未分类` 的提示与禁用逻辑不回退。
  - 菜单项仍可通过 `menuitem` 查询。
- 在实现完成后运行针对 `FeedList` 的 Vitest，以及 `pnpm run lint` 作为最终验证。

## 备注

- 当前会话按照 `workflow-using-git-worktrees` 在 `.worktrees/context-menu-theme-card` 中执行。
- 按当前会话约束，本次只写文档与代码，不执行 `git commit`。

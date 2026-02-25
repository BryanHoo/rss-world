# FeedList 订阅源右键管理（编辑/启停/删除）设计

日期：2026-02-25  
状态：已确认（Approved）

## TL;DR

- 在左侧订阅源列表 `FeedList` 的每条订阅源行上提供“右键菜单”入口，支持：编辑 / 启用(停用) / 删除（含二次确认）。
- 编辑范围仅限：`title`、`categoryId`、`enabled`（不支持修改 `url` / `fetchIntervalMinutes`）。
- 使用 shadcn/ui + Radix `ContextMenu` 实现菜单；编辑弹窗使用 `Dialog`，删除确认使用 `AlertDialog`。
- 前端补齐 `patchFeed` / `deleteFeed` API 调用与 `useAppStore` 的局部更新；删除时处理“当前选中源被删”的视图回退。

## 背景

当前应用已有新增订阅源能力（`AddFeedDialog` + `POST /api/feeds`），但缺少在 UI 中对已存在订阅源的编辑与删除入口；同时后端已具备 `PATCH /api/feeds/:id` 与 `DELETE /api/feeds/:id`，可以直接对接。

## 目标

- 用户可在 `FeedList` 通过右键菜单对订阅源进行管理：
  - 编辑：修改 `title`、`categoryId`、`enabled`
  - 启停：快速切换 `enabled`
  - 删除：删除订阅源（含二次确认）
- 删除订阅源后，若当前 `selectedView === feed.id`，视图回退到 `all`，并清空 `selectedArticleId`，避免残留阅读面板状态。
- 交互与视觉风格与现有 shadcn/ui 组件一致，支持深色模式。

## 非目标

- 不新增设置中心 `rss` 分组（入口仅在 `FeedList`）。
- 不支持编辑 `url`（因此不引入“编辑时重新验证 URL”的流程）。
- 不支持编辑 `fetchIntervalMinutes`。
- 不调整后端接口结构（保持现有 `PATCH /api/feeds/:id` 字段范围与返回）。

## 方案（选定）

### 入口与菜单（右键）

- 在 `FeedList` 的订阅源行上监听右键（`ContextMenu`），菜单作用于“被右键的那条 feed”（不要求先选中）。
- 菜单项：
  - `编辑…`：打开 `EditFeedDialog`
  - `启用` / `停用`：直接触发 `patchFeed(feedId, { enabled: !enabled })`
  - `删除…`：打开二次确认 `AlertDialog`
- 当 `feed.enabled === false` 时，订阅源行在列表里弱化展示（例如降低不透明度/增加小标记），让“停用”在信息层级上可见。

### 编辑弹窗（EditFeedDialog）

- 新增组件：`src/features/feeds/EditFeedDialog.tsx`
- 字段：
  - `title`（必填）
  - `categoryId`（可选，选择“未分类”时提交 `null`）
  - `enabled`（开关）
  - `url` 只读展示（不可编辑）
- 保存按钮在提交中禁用；失败时在弹窗底部展示错误并允许重试。

### 删除确认

- 二次确认文案明确提示会影响数据：feeds 删除会级联删除 articles（DB `on delete cascade`）。
- 确认删除后：
  - 从 `feeds` 移除该项
  - 从 `articles` 过滤 `article.feedId === feedId`
  - 处理视图回退（见“数据流与状态更新”）

## 数据流与状态更新

### API Client

- `src/lib/apiClient.ts` 新增：
  - `patchFeed(feedId, { title?, enabled?, categoryId? })`
  - `deleteFeed(feedId)`
- `mapFeedDto(...)` 需要把 `enabled` 写入 `Feed`（后端 `ReaderSnapshotDto.feeds[]` 已包含该字段）。

> 说明：`PATCH /api/feeds/:id` 返回 `FeedRow`，不包含 `unreadCount`；前端更新时保持原有 `unreadCount`（仅更新被 patch 的字段）。

### useAppStore

新增 action（命名可调整，职责如下）：

- `updateFeed(id, patch)`：
  - 调用 `patchFeed`
  - 成功后仅更新 `feeds[]` 中对应项（`title` / `enabled` / `categoryId`）
  - 使用当前 `categories` 重新计算 `feed.category`
  - 保留 `unreadCount`
- `removeFeed(id)`：
  - 调用 `deleteFeed`
  - 成功后从 `feeds` 移除该项并清理相关 `articles`
  - 若 `selectedView === id`，设置 `selectedView = 'all'` 并清空 `selectedArticleId`

删除时若视图回退到 `all`，`ReaderApp` 现有的 `loadSnapshot({ view: selectedView })` effect 会触发一次兜底刷新，确保 UI 与后端最终一致。

## 依赖与组件

- 新增 shadcn/ui 组件文件：`src/components/ui/context-menu.tsx`
- 新增依赖：`@radix-ui/react-context-menu`

## 测试计划

- 新增 `FeedList` 相关单测（React Testing Library + Vitest）覆盖：
  - 右键打开菜单（`编辑…` / `启用/停用` / `删除…` 可见）
  - `编辑…` 保存后列表展示更新
  - `删除…` 确认后从列表移除，并在 `selectedView === feedId` 时回退到 `all`
- 保持现有 `AddFeedDialog.test.tsx` 不受影响（新增/验证流程不变）。

## 验收标准

- 在 `FeedList` 中右键任一订阅源，可完成编辑、启停、删除操作。
- 编辑仅影响 `title` / `categoryId` / `enabled`，不出现 `url` 可编辑入口。
- 删除订阅源后，若当前正在查看该订阅源文章（`selectedView === feedId`），会回到 `all` 且不会残留阅读面板内容。
- 操作失败时有明确错误反馈，且不会导致列表状态与后端永久不一致。

## 影响范围

- 修改：
  - `src/features/feeds/FeedList.tsx`
  - `src/store/appStore.ts`
  - `src/lib/apiClient.ts`
  - `src/types/index.ts`
- 新增：
  - `src/features/feeds/EditFeedDialog.tsx`
  - `src/components/ui/context-menu.tsx`
  -（可选）`src/features/feeds/FeedList.test.tsx`


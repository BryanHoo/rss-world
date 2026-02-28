# 统一前端用户提醒（显式操作）设计

日期：2026-02-28  
状态：已确认（Approved）

## TL;DR

- 当前前端缺少统一提醒机制，成功/失败反馈分散在行内文案、局部状态和 `console.error`，用户感知不一致。
- 选定方案：在 UI 层新增统一通知能力（`NotificationProvider + useNotify`），由显式用户操作统一触发提醒。
- 第一阶段只覆盖显式用户操作，不接入后台轮询与高频静默操作。
- 成功和失败都提示：成功轻量且更快自动消失；失败强调且停留更久。
- 行内提示最小化：仅保留字段级校验，提交/操作结果优先走统一提醒。

## 背景

当前系统中，用户操作结果反馈存在以下问题：

- 许多失败仅在控制台打印，用户无可见提示（例如 store 内 `catch -> console.error`）。
- 部分场景使用行内错误文案，部分场景使用局部状态提示，缺少统一视觉与行为规范。
- 成功反馈覆盖不完整，用户难以确认操作是否生效。

这导致“成功与失败反馈体验不一致”，并增加了后续功能扩展时的维护成本。

## 目标

- 建立统一的前端提醒机制，覆盖第一阶段的显式用户操作。
- 成功与失败均可见，但视觉权重不同（成功轻量、失败强调）。
- 保持可扩展性，为后续接入后台任务提醒预留能力。
- 降低业务组件中重复错误文案拼接逻辑。

## 非目标

- 第一阶段不接入后台轮询/异步任务链路（如全文抓取、AI 摘要轮询结果）。
- 第一阶段不覆盖高频操作（如 `markAsRead` / `toggleStar` / `markAllAsRead`）。
- 不改动后端 API 协议与错误结构，仅在前端统一消费与展示。

## 方案选型

### 备选方案

1) UI 层集中触发（选定）
- 新增通知 Provider 与 Hook，由显式操作入口调用。

2) API 客户端自动错误提醒 + UI 成功提醒
- 在 `apiClient` 层统一弹出错误，成功由 UI 决定。

3) Store 事件总线驱动提醒
- store 发事件，视图统一订阅展示。

### 选定方案与原因

选定 **UI 层集中触发**，原因：

- 与“第一阶段只覆盖显式操作”的范围最一致，不会误伤静默请求。
- 可渐进接入，改动边界清晰，回归风险可控。
- 后续若要扩展到后台任务，可在现有 Provider 能力上增加来源与策略。

## 架构设计

### 核心组件

- `NotificationProvider`
  - 维护通知队列、去重、自动消失、关闭逻辑。
- `NotificationViewport`
  - 负责统一渲染和布局（桌面右上，移动端顶部居中）。
- `useNotify()`
  - 暴露 `success/error/info` 三类调用入口。
- `mapApiErrorToUserMessage(err, action)`
  - 将 `ApiError.code` 与未知异常统一映射为用户文案。

### 挂载位置

- 在 `src/app/(reader)/ReaderApp.tsx` 挂载 `NotificationProvider`，包裹 `ReaderLayout`。
- 不改动 `RootLayout`，避免对非 reader 路由产生额外影响。

## 提醒规范

### 类型与时长

- `success`：轻量，自动消失 `1800ms`
- `error`：强调，自动消失 `4500ms`
- `info`：中性，自动消失 `2500ms`

### 交互规则

- 每条提醒支持手动关闭。
- 鼠标悬停时暂停自动消失倒计时。
- 1.5 秒内同 `type + message` 去重。
- 堆叠上限 3 条；超限时优先淘汰最旧 `success/info`，尽量保留 `error`。

### 文案规范

- 成功：短句结果导向，例如“保存成功”“已删除订阅源”。
- 失败：动作 + 原因（可选），例如“保存失败，请稍后重试”“删除失败：分类已存在”。
- 未知错误统一回退：“操作失败，请稍后重试。”

## 第一阶段接入范围

仅接入显式用户触发动作：

- `AddFeedDialog`：新增订阅源成功/失败
- `EditFeedDialog`：编辑保存成功/失败
- `FeedList`：启用/停用成功/失败，删除成功/失败
- `CategoriesSettingsPanel`：创建/重命名/删除成功/失败
- `SettingsCenterDrawer` 自动保存：失败统一提醒；成功提醒做降噪（仅关键项）

## 行内提示收敛策略

- 保留字段级校验提示（必填、格式、范围）。
- 业务操作结果（保存失败、删除失败、创建成功等）迁移到统一提醒。
- 对已有 `aria-live` 的进度类提示（例如“正在生成摘要”）第一阶段不调整。

## 数据流

1. 用户触发显式操作（点击保存/删除/新增）。
2. 组件调用现有 action 或 API 请求。
3. 成功分支调用 `notify.success(...)`。
4. 失败分支调用 `mapApiErrorToUserMessage(...)` 后 `notify.error(...)`。
5. 状态更新和提醒展示解耦，业务状态仍由原组件/store 负责。

## 错误处理策略

- 优先识别 `ApiError`，按 `code` 做用户可理解文案映射。
- 其他异常统一回退默认错误文案。
- 开发态可保留 `console.error` 便于排查，但不作为用户反馈渠道。

## 测试计划

- 单元测试
  - `NotificationProvider`：队列、去重、超限淘汰、自动消失、悬停暂停。
  - `mapApiErrorToUserMessage`：错误码映射与默认回退。
- 组件测试
  - 各接入场景成功/失败是否触发正确通知。
  - 旧的“提交失败行内提示”是否完成迁移。
- 回归验证
  - 桌面/移动端布局不遮挡关键操作区。
  - 深浅色主题可读性。
  - `aria-live` 与键盘操作无可访问性回退。

## 风险与缓解

- 风险：接入点遗漏导致反馈不一致。
  - 缓解：按“接入清单”逐项验收并补组件测试。
- 风险：成功提醒过多造成噪音。
  - 缓解：限制第一阶段范围 + 成功提醒时长更短 + 去重策略。
- 风险：自动保存类场景频繁提示影响体验。
  - 缓解：仅失败必提示，成功提示仅对关键设置变更触发。

## 验收标准

- 第一阶段范围内的显式用户操作均有统一成功/失败提醒。
- 失败可读且可定位，成功反馈轻量不扰动。
- 行内结果型错误明显减少，仅保留字段级校验。
- 视觉、行为、可访问性在不同页面保持一致。

## 影响范围（实现阶段预期）

- 新增（预期）：
  - `src/features/notifications/NotificationProvider.tsx`
  - `src/features/notifications/NotificationViewport.tsx`
  - `src/features/notifications/useNotify.ts`
  - `src/features/notifications/mapApiErrorToUserMessage.ts`
- 修改（预期）：
  - `src/app/(reader)/ReaderApp.tsx`
  - `src/features/feeds/AddFeedDialog.tsx`
  - `src/features/feeds/EditFeedDialog.tsx`
  - `src/features/feeds/FeedList.tsx`
  - `src/features/settings/panels/CategoriesSettingsPanel.tsx`
  - `src/features/settings/SettingsCenterDrawer.tsx`


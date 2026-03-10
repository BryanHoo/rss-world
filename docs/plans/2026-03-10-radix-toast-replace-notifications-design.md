# 使用 @radix-ui/react-toast 替换现有通知/toast 设计

- 日期：2026-03-10
- 状态：已确认
- 需求：将项目当前自研通知系统（`src/features/notifications/*`）替换为 `@radix-ui/react-toast`，并提供全局 `toast(...)` 调用方式；保留 `apiClient` 失败默认自动弹 toast 的行为，同时尽量保持现有样式 token 与测试断言稳定。

## 背景

截至 2026-03-10，项目存在一套自研通知实现：

- `src/features/notifications/NotificationProvider.tsx`：维护通知栈、去重、自动消失（TTL）、最大堆叠数量与“优先保留 error”策略。
- `src/features/notifications/NotificationViewport.tsx`：在右上角渲染通知列表，采用语义化主题 token（`success/info/error`），并提供关闭按钮。
- `src/features/notifications/useNotify.ts`：业务侧通过 hook 触发 `success/info/error/dismiss`。
- `src/features/notifications/ApiNotificationBridge.tsx`：将 `src/lib/apiClient.ts` 内部的 `notifyApiError(...)` 绑定到 UI 侧 `notify.error(...)`，实现“API 失败默认自动弹全局错误提醒”。

当前通知能力与测试依赖点：

- 业务层广泛调用 `useNotify()`（例如 `src/features/articles/ArticleList.tsx`、`src/features/feeds/FeedList.tsx`、`src/features/settings/SettingsCenterDrawer.tsx`）。
- 单测大量断言 `data-testid="notification-viewport"` 下出现某条提示文案（例如添加订阅源失败、刷新失败等）。
- `src/app/theme-token-usage.contract.test.ts` 对通知 UI 的 token 使用做了契约约束（避免硬编码色阶）。

`docs/summaries/` 当前没有与通知系统迁移相关的经验记录；因此本设计基于现有实现与测试约束制定。

## 目标

- 将通知/toast UI 迁移到 `@radix-ui/react-toast`，提升可访问性与交互一致性，并减少自研 UI 维护成本。
- 将业务侧触发方式从 `useNotify()` 迁移为全局函数调用：`import { toast } ...; toast.success(...)/toast.error(...)/toast.info(...)`。
- 保留 `src/lib/apiClient.ts` 的失败默认通知语义：
  - 请求失败默认触发 `notifyApiError(...)`
  - 允许通过 `notifyOnError: false` 禁用（例如校验类请求避免弹全局 toast）
- 尽量保持现有视觉与测试稳定：
  - 复用 `NOTIFICATION_VIEWPORT_CLASS_NAME`
  - 继续提供 `data-testid="notification-viewport"`
  - 延续语义化 token（`border-success/25`、`bg-info/10`、`text-error-foreground` 等）

## 非目标

- 不做跨标签页（multi-tab）同步。
- 不做 toast 持久化（刷新后不保留历史）。
- 不在 server components / Node 端触发 toast（`toast(...)` 仅在浏览器侧使用）。
- 不在本设计阶段实现任何代码改动（实现另行计划）。

## 备选方案

### 方案 1（推荐）：Radix Toast + Zustand store + 全局 `toast(...)`

做法：

- 使用 `zustand` 的 store 作为全局队列与行为层（去重、限栈、dismiss、更新）。
- 导出全局函数 `toast(...)`，调用方直接写入 store，不依赖 React hook。
- 在 UI 侧提供唯一挂载点 `ToastHost`：
  - 使用 `@radix-ui/react-toast` 渲染 store 中的队列
  - 在 `useEffect` 中注册 `setApiErrorNotifier((message) => toast.error(message))`，卸载时 `clearApiErrorNotifier()`

优点：

- 业务调用简单，满足“全局函数”目标。
- Provider 未挂载时也不会丢消息（toast 先进入 store，Host 挂载后统一渲染）。
- 易测试：store 行为可单测；UI 测试仅需渲染一次 Host。

缺点：

- 需要维护 store + Host 的胶水层代码。

### 方案 2：Radix Toast + `window` 事件总线（`CustomEvent`）

优点：

- 实现概念简单，不引入 store。

缺点：

- Provider 未挂载时事件会丢（需额外缓冲队列）。
- 测试时序更脆弱，长期维护成本更高。

### 方案 3：仅替换 UI（保留 `NotificationProvider/useNotify`）

优点：

- 业务改动最小。

缺点：

- 与“改为全局函数调用”的既定目标冲突；最终仍需二次迁移。

## 推荐方案

采用方案 1：Radix Toast + Zustand store + 全局 `toast(...)`。

理由：

- 与目标完全一致（全局函数 + `apiClient` 默认自动弹）。
- 保持测试可控：通过 `data-testid="notification-viewport"` 继续承载现有断言模式。
- 将复杂行为集中在 store，UI 层主要负责可访问性与交互呈现。

## 已确认设计

### 架构与挂载点

新增模块（建议落位）：

- `src/features/toast/toast.ts`：对外 API（`toast(...)`/`toast.success`/`toast.error`/`toast.info`/`toast.dismiss`）。
- `src/features/toast/toastStore.ts`：队列与行为（去重、限栈、TTL、更新、dismiss）。
- `src/features/toast/ToastHost.tsx`：唯一 UI 挂载点（Radix Provider/Viewport/Root 渲染 + API 错误桥接）。

应用侧挂载：

- 在 `src/app/(reader)/ReaderApp.tsx` 内挂载一次 `<ToastHost />`，覆盖 reader 内所有交互与全局 API 失败提示。

迁移后弃用/移除：

- `src/features/notifications/NotificationProvider.tsx`
- `src/features/notifications/NotificationViewport.tsx`
- `src/features/notifications/useNotify.ts`
- `src/features/notifications/ApiNotificationBridge.tsx`

### 对外 API 形状

- `toast(options)`：创建 toast，返回 `id: string`
- `toast.success(message, options?)`
- `toast.info(message, options?)`
- `toast.error(message, options?)`
- `toast.dismiss(id?)`：关闭指定或全部

`options` 建议字段：

- `id?: string`：用于同一 toast 更新（存在则更新，不新增）
- `dedupeKey?: string`：去重键（默认 `${tone}:${message}`）
- `durationMs?: number`：覆盖默认时长

### 队列与行为规则（默认值）

默认沿用现有通知语义，并允许通过 `options` 覆盖：

- `MAX_STACK = 3`
- `DEDUPE_WINDOW_MS = 1500`
- `TTL_BY_TONE`：
  - `success: 1800ms`
  - `info: 2500ms`
  - `error: 4500ms`

去重：

- 在 `DEDUPE_WINDOW_MS` 内相同 `dedupeKey` 的 toast 默认忽略重复触发，避免刷屏。

限栈：

- 超过 `MAX_STACK` 时优先移除最早的非 `error`；若全为 `error` 再移除最早的 `error`。

更新：

- `toast({ id, ... })` 若命中已有 `id`，视为更新（用于“同一条 toast 更新状态”的场景）。

### 样式与契约

- `Toast.Viewport` 继续复用 `NOTIFICATION_VIEWPORT_CLASS_NAME`，并保留 `data-testid="notification-viewport"`，尽量保持现有单测断言稳定。
- 单条 toast 的 tone 样式沿用现有语义化 token（示例）：
  - `success: border-success/25 bg-success/12 text-success-foreground`
  - `info: border-info/20 bg-info/10 text-info-foreground`
  - `error: border-error/25 bg-error/12 text-error-foreground`
- 动画：基于 Radix 的 `data-state`/`data-swipe` 与 `tailwindcss-animate` 实现轻量进出场，并支持 `prefers-reduced-motion` 降级。

### 可访问性（A11y）

- 在 `Toast.Provider` 设置合适的 `label`（例如“通知”），以便读屏器理解区域语义。
- `error` toast 采用更强的提醒语义（与现有 `role="alert"` 预期一致），`success/info` 保持温和提示。
- Close 按钮保留 `aria-label`（例如“关闭提醒”）与键盘可聚焦样式。

### 与 `apiClient` 的失败默认提示桥接

- 在 `ToastHost` 内注册：
  - `setApiErrorNotifier((message) => toast.error(message))`
  - 卸载时 `clearApiErrorNotifier()`
- `src/lib/apiClient.ts` 保持现有语义：`notifyOnError !== false` 时仍触发 `notifyApiError(...)`，从而默认弹 toast；校验类请求可继续使用 `notifyOnError: false` 避免打扰。

## 风险与规避

- Radix toast 的自动关闭与单测 fake timers 可能存在耦合：
  - 规避：把去重/限栈/更新等纯逻辑放在 `toastStore` 单测；UI 测试主要验证“出现/可关闭/容器存在”，避免对精确计时过度断言。
- Provider 未挂载时触发 toast：
  - 方案 1 通过 store 队列避免丢失。
- 误在 server 环境调用 toast：
  - `toast.ts` 明确为 client-only，尽早暴露误用。

## 验收标准

- 行为：
  - `toast.success/info/error` 可显示、可手动关闭、按 tone 自动消失。
  - 同 `dedupeKey` 在 `DEDUPE_WINDOW_MS` 内不刷屏。
  - 最多堆叠 3 条，优先保留 `error`。
  - `apiClient` 失败默认自动弹 toast；`notifyOnError: false` 时不弹。
- 样式与契约：
  - 继续使用语义化主题 token；`theme-token-usage.contract.test.ts` 保持约束覆盖。
  - `data-testid="notification-viewport"` 继续存在，现有测试断言迁移成本可控。


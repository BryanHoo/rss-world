# 设置中心重构设计（右栏顶部设置入口）

- 日期：2026-02-23
- 状态：已评审通过
- 适用范围：FeedFuse Reader（右栏顶部 `open-settings` 入口）

## 1. 背景与目标

当前设置弹窗偏“阅读样式调节器”，仅覆盖 `theme/fontSize/fontFamily/lineHeight`。随着 AI 能力与更多全局配置增长，需要将其升级为“经典设置中心”骨架，便于持续扩展。

本次为设计阶段，目标是定义：

1. MVP 设置项边界（含后续预留）
2. 统一信息架构与 key 规范
3. 状态管理与保存策略（含敏感字段处理）
4. 错误处理、测试与迁移策略

## 2. 已确认约束

1. 本期采用 `MVP + 未来预留`。
2. AI 设置范围为“开关 + `provider/model` 层”。
3. `provider` 默认 `openai-compatible`。
4. 前端本期不做 AI 真实对接，仅做配置管理。
5. `apiKey` 可输入，但不持久化（会话级）。
6. MVP 分组包含：`外观与阅读`、`AI`、`快捷键`、`RSS 源管理（CRUD）`。
7. RSS CRUD 字段采用轻量版：`name/url/folder/enabled`。

## 3. 方案对比

### 方案 A：单层列表扩展法

在现有 `UserSettings` 上继续平铺新增字段，并扩展当前 `SettingsModal`。

- 优点：改动最小、速度快
- 缺点：可维护性差，后续扩展成本高

### 方案 B：分组命名空间法（采纳）

引入 `SettingsSchema`，按分组管理设置项，并区分 `persisted` 与 `sessionOnly`。

- 优点：结构清晰、易扩展、便于测试与迁移
- 缺点：需要一次结构整理

### 方案 C：插件注册法

以 registry 方式描述设置项元数据并驱动渲染。

- 优点：长期扩展性最好
- 缺点：MVP 阶段过重

结论：采纳方案 B。

## 4. 信息架构（MVP）

> 只定义结构，不在本设计中规定具体 UI 呈现样式细节。

设置中心包含 4 个分组：

1. `appearance`（外观与阅读）
2. `ai`（AI 设置）
3. `shortcuts`（快捷键）
4. `rss`（RSS 源管理）

## 5. 组件与状态流设计

### 5.1 组件分层

1. `SettingsCenterModal`
- 替代现有 `SettingsModal` 的容器职责
- 负责打开/关闭、分组切换、保存/取消入口

2. 分组面板
- `AppearanceSettingsPanel`
- `AISettingsPanel`
- `ShortcutsSettingsPanel`
- `RssSourcesSettingsPanel`

3. 纯函数层
- `validateSettingsDraft(draft)`
- `normalizeSettings(input)`

### 5.2 Store 结构

- `persistedSettings`：持久化配置
- `sessionSettings`：会话配置（例如 `ai.apiKey`）
- `draft`：弹窗编辑草稿
- `actions`：`loadDraft`、`updateDraft(path, value)`、`saveDraft`、`discardDraft`、`resetGroup`

### 5.3 状态流

1. 打开弹窗：从运行态复制到 `draft`
2. 编辑过程中：仅更新 `draft`
3. 点击保存：校验通过后写入 `persistedSettings/sessionSettings`
4. 点击取消或关闭：丢弃 `draft`
5. `apiKey`：仅写入 `sessionSettings`，不进入持久化

## 6. 设置项清单与 key 规范（MVP）

### 6.1 `appearance`（persisted）

- `appearance.theme`: `'light' | 'dark' | 'auto'`
- `appearance.fontSize`: `'small' | 'medium' | 'large'`
- `appearance.fontFamily`: `'sans' | 'serif'`
- `appearance.lineHeight`: `'compact' | 'normal' | 'relaxed'`

### 6.2 `ai`

persisted:

- `ai.summaryEnabled`: `boolean`
- `ai.translateEnabled`: `boolean`
- `ai.autoSummarize`: `boolean`
- `ai.provider`: `'openai-compatible'`（默认，可扩展字符串）
- `ai.model`: `string`
- `ai.apiBaseUrl`: `string`（可空）

sessionOnly:

- `ai.apiKey`: `string`（可输入，不持久化）

### 6.3 `shortcuts`（persisted）

- `shortcuts.enabled`: `boolean`
- `shortcuts.bindings.nextArticle`: `string`（默认 `j`）
- `shortcuts.bindings.prevArticle`: `string`（默认 `k`）
- `shortcuts.bindings.toggleStar`: `string`（默认 `s`）
- `shortcuts.bindings.markRead`: `string`（默认 `m`）
- `shortcuts.bindings.openOriginal`: `string`（默认 `v`）

### 6.4 `rss`（persisted）

- `rss.sources`: `Array<RssSourceSetting>`

`RssSourceSetting`:

- `id: string`
- `name: string`
- `url: string`
- `folder: string | null`
- `enabled: boolean`

## 7. 校验与错误处理

1. 保存前统一执行 `validateSettingsDraft(draft)`。
2. 校验失败返回字段级错误（如 `rss.sources[2].url`），并阻止保存。
3. `rss.url` 必须是合法 `http/https` URL。
4. `name/url` 必填。
5. 快捷键绑定不可重复；冲突时阻止保存。
6. `ai.apiBaseUrl` 非空时必须是合法 URL。
7. 本期不包含后端请求错误处理（无真实对接）。

## 8. 迁移策略

通过 `normalizeSettings` 兼容旧设置结构：

1. 旧 `UserSettings` 平面字段映射到 `appearance.*`。
2. 新增分组缺失字段自动补默认值。
3. 未识别字段忽略，不阻塞启动。

## 9. 测试策略（MVP）

1. `settingsStore` 单测
- `draft` 生命周期：`load/update/save/discard`
- `apiKey` 不持久化断言
- 默认值与迁移映射断言

2. 校验函数单测
- URL 非法
- 必填缺失
- 快捷键冲突
- `ai.apiBaseUrl` 合法性

3. 组件集成测试（最小回归）
- `open-settings` 入口可打开设置中心
- 保存 `appearance` 后阅读区效果仍生效
- `rss` 的新增/编辑/删除/启停状态流正确

## 10. 未来预留（本次不实现）

1. `ai` 高级参数：`temperature/maxTokens/systemPrompt/fallback`
2. `rss` 高级配置：鉴权、headers、自定义解析
3. 远程同步：后端接入后替换本地保存策略

## 11. 非目标

1. 本次不实现具体 UI 展示样式细节。
2. 本次不实现 AI 实际调用链路。
3. 本次不实现 RSS 高级网络配置。


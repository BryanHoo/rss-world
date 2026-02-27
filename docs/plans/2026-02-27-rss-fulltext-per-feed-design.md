# RSS 全文抓取开关：改为按订阅源（feed）配置 设计

日期：2026-02-27  
状态：已确认（Approved）

## TL;DR

- 将“打开文章时抓取全文”的开关从全局 `persistedSettings.rss.fullTextOnOpenEnabled` 移除，改为 **每个订阅源（`feeds` 表）** 单独配置。
- 数据库存储新增字段：`feeds.full_text_on_open_enabled boolean not null default false`，不从旧全局设置迁移（所有现存 feed 默认关闭）。
- Feed 管理入口提供配置：
  - `AddFeedDialog` 添加时可选择是否开启（默认关闭）
  - `EditFeedDialog` 可随时开/关
- `POST /api/articles/:id/fulltext` 的入队 gating 从“读取 UI 全局开关”改为“读取该文章所属 feed 的开关”，其余保护条件保持不变（无 link / 已有全文 / RSS 已足够完整等）。
- 全文抓取链路（worker 抓取 + Readability 抽取 + `sanitizeContent` 清洗 + 前端轮询刷新显示）保持不变，仅调整“是否触发”的配置来源与 UI。

## 背景

当前全文抓取开关位于全局设置 `persistedSettings.rss.fullTextOnOpenEnabled`（存储在 `app_settings.ui_settings`，经 `/api/settings` 读写）。这会让“抓取全文”成为全局行为，无法按订阅源做精细控制。

本设计将“抓取全文”改为订阅源级配置：每个 `feed` 自己决定是否在用户打开文章时触发全文抓取。

## 目标

- “抓取全文”不再作为全局配置项，而是按订阅源（feed）配置。
- 默认更保守：现存 feed 全部关闭，不迁移旧全局值。
- 保持现有全文抓取体验与安全基线不变：
  - SSRF 防护仍使用 `isSafeExternalUrl`
  - 抽取后仍通过 `sanitizeContent` 清洗
  - 入队仍使用 singleton 去重
- 保持现有按需抓取策略：仅用户打开文章时触发，不在 ingest 时额外抓网页。

## 非目标

- 不实现“全局默认 + 单源覆盖”的双层配置模型。
- 不提供批量启用/按分类启用等功能（后续如需要可在 feed 管理里扩展）。
- 不改变 Readability 抽取、worker 执行、全文字段存储结构。

## 设计

### 数据模型（DB）

在 `feeds` 表新增字段：

- `full_text_on_open_enabled boolean not null default false`

迁移文件：

- 新增 `src/server/db/migrations/0005_feed_fulltext_on_open.sql`
- 新增对应 migration 测试：`src/server/db/migrations/feedFulltextOnOpenMigration.test.ts`

迁移策略：

- 不从 `app_settings.ui_settings` 的旧字段迁移；新列默认值保证现存 feed 全部为 `false`。

### 后端数据层（repositories / snapshot）

`src/server/repositories/feedsRepo.ts`：

- `FeedRow` 增加 `fullTextOnOpenEnabled: boolean`
- `listFeeds` / `createFeed` / `updateFeed` 的 SQL 增加：
  - `full_text_on_open_enabled as "fullTextOnOpenEnabled"`
- `createFeed(...)` 入参增加 `fullTextOnOpenEnabled?: boolean`（默认 `false`）
- `updateFeed(...)` 支持 patch `fullTextOnOpenEnabled?: boolean`

`src/server/services/readerSnapshotService.ts`：

- `ReaderSnapshotFeed` 增加 `fullTextOnOpenEnabled: boolean`
- snapshot 的 `feeds[]` 透传该字段到前端

### API 变更

#### `POST /api/feeds`

请求体扩展：

- 新增可选：`fullTextOnOpenEnabled?: boolean`（默认 `false`）

返回体：

- feed DTO 增加 `fullTextOnOpenEnabled`

#### `PATCH /api/feeds/:id`

请求体扩展：

- 新增可选：`fullTextOnOpenEnabled?: boolean`

返回体：

- feed DTO 增加 `fullTextOnOpenEnabled`

#### `GET /api/reader/snapshot`

返回体扩展：

- `feeds[]` 增加 `fullTextOnOpenEnabled`

#### `POST /api/articles/:id/fulltext`（入队 gating）

将 gating 从 `ui_settings.rss.fullTextOnOpenEnabled` 改为“读取该文章所属 feed 的开关”：

- 若 `feed.fullTextOnOpenEnabled !== true`：返回 `{ enqueued: false }`
- 其余保护条件保持现状：
  - 文章无 `link` / 已有 `contentFullHtml` / `rssContentLooksFull(...) === true` → `{ enqueued: false }`
  - 否则 enqueue `JOB_ARTICLE_FULLTEXT_FETCH`（singleton 去重保持不变）

说明：

- worker `fetchFulltextAndStore(...)` 不读取开关；因此必须在 enqueue 前（API route / 前端）拦截。

### 前端改动（UI / Store / gating）

#### 类型与映射

- `src/types/index.ts`：`Feed` 增加 `fullTextOnOpenEnabled: boolean`
- `src/lib/apiClient.ts`：
  - `ReaderSnapshotDto.feeds[]` / `FeedRowDto` 增加 `fullTextOnOpenEnabled`
  - `mapFeedDto(...)` 注入 `fullTextOnOpenEnabled`

#### `AddFeedDialog`

`src/features/feeds/AddFeedDialog.tsx`：

- 新增“打开文章时抓取全文”字段（默认关闭）
- `onSubmit` payload 增加 `fullTextOnOpenEnabled`

`src/features/feeds/FeedList.tsx`：

- 调用 `addFeed(...)` 时透传 `fullTextOnOpenEnabled`，最终写入 `POST /api/feeds`

#### `EditFeedDialog`

`src/features/feeds/EditFeedDialog.tsx`：

- 新增“打开文章时抓取全文”字段，初始值来自 `feed.fullTextOnOpenEnabled`
- `onSubmit` payload 增加 `fullTextOnOpenEnabled`

`src/features/feeds/FeedList.tsx`：

- 调用 `updateFeed(...)` 时透传 `fullTextOnOpenEnabled`，最终写入 `PATCH /api/feeds/:id`

#### `ArticleView`（触发全文抓取）

`src/features/articles/ArticleView.tsx`：

- 将 gating 从 `useSettingsStore(...persistedSettings.rss.fullTextOnOpenEnabled)` 替换为：
  - `const feedFullTextOnOpenEnabled = feed?.fullTextOnOpenEnabled ?? false`
- effect 依赖项随之调整（避免读取旧全局设置）

#### `SettingsCenter`（移除全局开关）

`src/features/settings/panels/RssSettingsPanel.tsx`：

- 移除“打开文章时抓取全文”全局开关 UI（避免继续存在全局配置）
- （可选）保留一句说明：全文抓取需在订阅源编辑中逐个设置

`src/features/settings/settingsSchema.ts` / `src/types/index.ts`：

- 移除 `rss.fullTextOnOpenEnabled` 字段（作为历史遗留不再参与 normalize 与存储结构）

兼容说明：

- DB `app_settings.ui_settings` 中可能仍残留旧字段，但将被忽略；后续 `PUT /api/settings` 保存时也不会再输出该字段。

## 测试与验收

### 测试

- migrations：新增 `feedFulltextOnOpenMigration.test.ts` 覆盖新增列
- 后端：
  - `src/app/api/feeds/routes.test.ts`：覆盖 `POST/PATCH` 支持 `fullTextOnOpenEnabled`
  - `src/app/api/articles/routes.test.ts`：将 “disabled” 分支改为依赖 feed 级开关
- 前端：
  - `src/features/feeds/AddFeedDialog.test.tsx`：stub 响应补齐 `fullTextOnOpenEnabled`；覆盖默认值与提交字段
  - `src/features/feeds/FeedList.test.tsx`：feeds fixture 与 `PATCH` stub 返回补齐 `fullTextOnOpenEnabled`
  - `src/features/settings/SettingsCenterModal.test.tsx` / `src/features/settings/settingsSchema.test.ts` / `src/store/settingsStore.test.ts`：移除或调整旧全局开关相关断言

### 验收标准

- 添加订阅源时可设置该 feed 的 `fullTextOnOpenEnabled`（默认关闭）。
- 编辑订阅源时可切换该 feed 的 `fullTextOnOpenEnabled`。
- 打开文章时：
  - 所属 feed 关闭：不触发全文抓取（`POST /api/articles/:id/fulltext` 返回 `{ enqueued: false }`，前端无 loading）
  - 所属 feed 开启：满足条件时入队并最终展示全文，体验与当前一致

## 回滚方案

- 如需立即禁用：将所有 `feeds.full_text_on_open_enabled` 批量置为 `false`（不影响已抓取全文的存量数据）。
- 回滚代码时：移除 per-feed 字段读写与 UI 入口，恢复旧 gating（若仍保留旧全局字段）。


# RSS 源 URL 可编辑 + 地址变更后强制重取名称 + 基于原站链接获取 Icon 设计

日期：2026-03-01  
状态：已确认（Approved）

## TL;DR

- 新增与编辑 RSS 源都支持修改 `url`，且都必须先通过 URL 校验才能保存。
- 每次 URL 变更并校验成功后，名称都会刷新为校验返回的最新 `title`（返回非空时覆盖当前名称）。
- 左侧订阅源 icon 不再由 `feed.url`（中转地址）推导，改为使用 RSS channel 的原站链接 `feed.link`：后端存储 `site_url/icon_url`，前端直接渲染 `iconUrl`。

## 背景

当前实现存在三处与目标不一致：

1. `EditFeedDialog` 中 `URL` 为只读，无法编辑 RSS 地址。
2. 新增流程仅在“名称为空”时才自动填充，不满足“每次改地址后都重取名称”。
3. 左侧 icon 由 `feed.url` 推导，遇到 RSS 中转地址时图标不准确。

## 目标

1. 新增、编辑均可修改 RSS 地址。
2. 新增、编辑均要求 URL 校验成功后才可保存。
3. 每次 URL 校验成功后，名称按最新抓取结果刷新（`title` 非空即覆盖）。
4. icon 获取改为基于 RSS channel 原站链接（`feed.link`），不再基于中转 RSS 地址。

## 非目标

1. 不改 worker 抓取主链路（本期不在抓取后异步回填标题/站点元数据）。
2. 不引入新的 icon 服务供应商（沿用现有 `google s2` URL 生成方式）。
3. 不调整分类、全文开关、AI 摘要开关等现有业务规则。

## 方案总览（选定）

采用“校验即产出站点元数据，保存时同步写入”的方案：

1. 扩展 `GET /api/rss/validate` 返回 `siteUrl`（来自解析后的 `feed.link`）。
2. 新增/编辑弹窗在校验成功后缓存 `validatedTitle/validatedSiteUrl`。
3. 提交保存时将 `title/url/siteUrl` 一并写入，后端统一推导并保存 `iconUrl`。
4. 列表 icon 改为优先使用持久化的 `feed.iconUrl`。

## 详细设计

### 1) 校验接口与元数据

- `src/app/api/rss/validate/route.ts`
  - 成功返回结构从 `{ ok, kind, title }` 扩展为 `{ ok, kind, title, siteUrl }`。
  - `siteUrl` 来源：`rss-parser` 返回的 `feed.link`，并做 `http/https` 规范化。
  - `feed.link` 缺失或非安全 URL 时，`siteUrl` 为空（不阻塞校验成功）。

- `src/features/feeds/services/rssValidationService.ts`
  - `RssValidationResult` 类型增加 `siteUrl?: string`。

### 2) 新增弹窗行为（Add）

- `src/features/feeds/AddFeedDialog.tsx`
  - 保持 URL `onBlur` 自动校验。
  - 校验成功后：
    - 若返回 `title` 非空，始终覆盖当前名称（满足“无论有没有名称都重取”）。
    - 缓存 `validatedSiteUrl`。
  - 提交 payload 增加 `siteUrl`。
  - 保存门禁保持严格：`validationState === 'verified' && lastVerifiedUrl === trimmedUrl`。

### 3) 编辑弹窗行为（Edit）

- `src/features/feeds/EditFeedDialog.tsx`
  - `URL` 从只读改为可编辑输入。
  - 新增与 Add 对齐的校验状态机（`idle/validating/verified/failed`）。
  - URL 发生变化时重置校验状态，直到重新校验成功才可保存。
  - 校验成功后同样覆盖名称并缓存 `validatedSiteUrl`。
  - 提交 payload 增加 `url/siteUrl`。

### 4) Feed API 与 Repo

- `src/app/api/feeds/route.ts`（POST）
  - body schema 增加 `siteUrl`。
  - 创建时写入 `site_url`，并由服务层/路由层统一生成 `icon_url`。

- `src/app/api/feeds/[id]/route.ts`（PATCH）
  - body schema 增加 `url/siteUrl`。
  - 支持编辑时更新 RSS URL 与站点元数据。

- `src/server/repositories/feedsRepo.ts`
  - `updateFeed` 增加 `url?: string`。
  - 保留 `siteUrl/iconUrl` 更新能力，供 PATCH 使用。

- 统一函数（新增）
  - 例如 `deriveFeedIconUrl(siteUrl: string | null): string | null`。
  - 规则：`siteUrl` 存在则生成 `https://www.google.com/s2/favicons?...domain_url=<origin>`，否则 `null`。

### 5) 列表 icon 渲染

- `src/features/feeds/FeedList.tsx`
  - 移除 `getFeedFaviconUrl(feed.url)` 的主路径依赖。
  - 改为使用持久化字段：`feed.iconUrl`（通过 DTO 映射到前端可用字段）。
  - `iconUrl` 为空或加载失败时展示 fallback 占位。

## 数据流

1. 用户输入 URL（新增或编辑）
2. `onBlur` 调用 `/api/rss/validate?url=...`
3. 校验成功返回 `title/siteUrl`
4. 前端覆盖名称并缓存 `siteUrl`
5. 提交 `POST /api/feeds` 或 `PATCH /api/feeds/:id`
6. 后端写入 `url/title/site_url/icon_url`
7. 列表刷新后直接使用 `iconUrl` 展示图标

## 错误处理

1. 校验失败：显示错误、禁止保存。
2. URL 已变更但未复验：禁止保存。
3. URL 冲突（`feeds_url_unique`）：返回 `conflict`，前端提示“订阅源已存在”。
4. `siteUrl` 无法提取：允许保存，但 `iconUrl = null` 并显示占位图标。

## 测试计划

1. `src/features/feeds/AddFeedDialog.test.tsx`
   - 验证成功时名称会被返回 title 覆盖（即使已有内容）。
   - 提交 payload 包含 `siteUrl`。
2. `src/features/feeds/FeedList.test.tsx`（含 Edit 场景）
   - 编辑可修改 URL。
   - URL 改动后必须重新验证才可保存。
   - 校验成功后名称被覆盖。
3. `src/app/api/rss/validate/route` 相关测试
   - 成功返回 `siteUrl`。
   - `feed.link` 缺失/非法时 `siteUrl` 为空。
4. `src/app/api/feeds/routes.test.ts`
   - POST/PATCH 支持 `url/siteUrl` 读写并返回正确数据。
   - PATCH URL 重复返回 `conflict`。
5. `src/server/repositories/feedsRepo*` 测试
   - `updateFeed` 支持更新 `url/siteUrl/iconUrl`。

## 验收标准

1. 新增与编辑都可以修改 RSS URL。
2. 新增与编辑都必须 URL 校验成功后才能保存。
3. 每次 URL 校验成功后，名称都会刷新为最新返回 title（非空时覆盖）。
4. 左侧 icon 基于 `feed.link` 对应站点，而非 RSS 中转地址。
5. 相关单测通过。

## 影响范围

- 前端：
  - `src/features/feeds/AddFeedDialog.tsx`
  - `src/features/feeds/EditFeedDialog.tsx`
  - `src/features/feeds/FeedList.tsx`
  - `src/features/feeds/services/rssValidationService.ts`
  - `src/lib/apiClient.ts`
  - `src/types/index.ts`（如需暴露 `iconUrl/siteUrl`）
- API：
  - `src/app/api/rss/validate/route.ts`
  - `src/app/api/feeds/route.ts`
  - `src/app/api/feeds/[id]/route.ts`
- 后端仓储：
  - `src/server/repositories/feedsRepo.ts`
- 测试：
  - `src/features/feeds/*.test.tsx`
  - `src/app/api/feeds/routes.test.ts`
  - `src/app/api/rss/validate/*test*`
  - `src/server/repositories/feedsRepo*test*`

## 参考

- `docs/plans/2026-02-28-add-feed-url-first-auto-title-design.md`
- `docs/plans/2026-02-25-feeds-manage-design.md`

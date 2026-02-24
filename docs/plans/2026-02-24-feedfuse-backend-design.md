# FeedFuse 后端设计（单用户 + Docker 自托管）

日期：2026-02-24  
状态：已确认（Approved）  

## TL;DR

- 采用 **Next.js Route Handlers** 作为内置 API：`src/app/api/**/route.ts`（Node.js runtime）
- 使用 **Postgres** 作为唯一基础依赖（存储业务数据 + 作为任务队列的后端）
- 采用独立 **worker 进程**：负责 RSS 定时抓取/解析入库、AI 摘要异步处理
- 前端现状使用 `createMockProvider()`；后端提供 `GET /api/reader/snapshot` 以“快照式”返回对齐 `ReaderSnapshot`，便于渐进替换

## 背景与目标

### 当前前端已实现/依赖的能力（后端需支持）

- 三栏阅读器：订阅源列表 / 文章列表 / 阅读面板
- 视图：`all` / `unread` / `starred` / 按 feed 过滤
- 交互：
  - 选中文章后 2s 自动标记已读（幂等）
  - “标记全部为已读”（可按 feed）
  - 收藏切换（幂等）
  - 新增 RSS 源（含 URL 验证；目前为 mock）
  - 分类管理（删除分类时自动归并“未分类”）
- 设置（当前在 `localStorage`）：
  - `appearance`：主题/字体等（纯前端）
  - `ai`：`model` / `apiBaseUrl`（持久化），`apiKey`（仅 session，不进 `localStorage`）

### 目标（MVP）

- 真实持久化：feeds / categories / articles / read/star 状态
- worker 具备可恢复的后台抓取能力：定时、重试、并发控制、幂等去重
- 为后续 AI 摘要预留完整数据链路（不强制立刻上线 UI 功能）

### 非目标（本次不做）

- 多用户/登录/权限（单用户自用，无需鉴权）
- 全文搜索、复杂推荐、协作
- 离线模式与跨设备同步策略优化

## 总体架构

### 进程/服务

- `web`：Next.js（UI + API Route Handlers），对外暴露 `:3000`
- `db`：Postgres
- `worker`：独立 Node 进程
  - RSS 定时任务：enqueue 抓取任务、解析入库
  - AI 摘要：异步生成与写回

### 代码分层（建议）

为避免 Route Handlers 膨胀，采用分层（参考 `nodejs-backend-patterns`）：

- `src/app/api/**/route.ts`：HTTP 参数校验、调用 service、返回 DTO
- `src/server/**`（建议新增）：
  - `src/server/db/*`：连接池、查询封装
  - `src/server/repositories/*`：数据访问（SQL）
  - `src/server/services/*`：业务逻辑（快照拼装、标记已读/收藏、feed CRUD）
  - `src/server/rss/*`：抓取/解析/净化逻辑（供 worker 调用）
  - `src/server/queue/*`：队列抽象（供 web/worker 共用）
  - `src/server/errors/*`：错误类型与映射（统一返回格式）

> Next.js 最佳实践：API 统一放在 `src/app/api`，避免与页面路由冲突；Route Handlers 选择 Node.js runtime。

## 数据模型（Postgres）

约定：主键均为 `uuid`；时间为 `timestamptz`；`unreadCount` 由聚合查询计算（初期不做缓存）。

### `categories`

- `id uuid primary key default gen_random_uuid()`
- `name text not null`
- `position int not null default 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

索引/约束：

- `unique (lower(name))`：避免同名分类（大小写不敏感）

说明：

- “未分类”不强制入库；feed 的 `category_id is null` 视为未分类，前端可使用 sentinel（如 `cat-uncategorized`）做分组展示。

### `feeds`

- `id uuid primary key default gen_random_uuid()`
- `title text not null`
- `url text not null`（feed URL）
- `site_url text null`（可选：站点 URL）
- `icon_url text null`（可选：图标）
- `enabled boolean not null default true`
- `category_id uuid null references categories(id) on delete set null`
- `fetch_interval_minutes int not null default 30`
- `etag text null`
- `last_modified text null`
- `last_fetched_at timestamptz null`
- `last_fetch_status int null`
- `last_fetch_error text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

索引/约束：

- `unique (url)`
- index：`(enabled)`、`(category_id)`

### `articles`

- `id uuid primary key default gen_random_uuid()`
- `feed_id uuid not null references feeds(id) on delete cascade`
- `dedupe_key text not null`（去重 key，由 worker 生成）
- `title text not null`
- `link text null`
- `author text null`
- `published_at timestamptz null`
- `content_html text null`（净化后的 HTML）
- `summary text null`（RSS 自带摘要）
- `fetched_at timestamptz not null default now()`
- `is_read boolean not null default false`
- `read_at timestamptz null`
- `is_starred boolean not null default false`
- `starred_at timestamptz null`
- `ai_summary text null`
- `ai_summary_model text null`
- `ai_summarized_at timestamptz null`

去重策略：

- `unique (feed_id, dedupe_key)`
- `dedupe_key` 优先级建议：
  1) `guid:<guid>`
  2) `link:<normalized_link>`
  3) `hash:<sha256(title + published_at + link)>`

索引建议：

- `(feed_id, published_at desc, id desc)`
- `(is_read, published_at desc, id desc)`
- `(is_starred, published_at desc, id desc)`

### `app_settings`（单用户单行）

用途：存储后端/worker 需要的“业务设置”，避免继续依赖浏览器 `localStorage`。

字段建议（可按需扩展）：

- `id int primary key default 1 check (id = 1)`
- `ai_summary_enabled boolean not null default false`
- `ai_translate_enabled boolean not null default false`
- `ai_auto_summarize boolean not null default false`
- `ai_model text not null default ''`
- `ai_api_base_url text not null default ''`
- `rss_user_agent text not null default 'FeedFuse/1.0'`
- `rss_timeout_ms int not null default 10000`
- `updated_at timestamptz not null default now()`

密钥策略：

- `ai_api_key` **不入库**，由部署环境提供（例如 `AI_API_KEY`），worker 读取使用。

## API 设计（Next.js Route Handlers）

### 统一返回格式

- 成功：`{ ok: true, data: ... }`
- 失败：`{ ok: false, error: { code: string, message: string, fields?: Record<string, string> } }`

建议错误码：

- `validation_error`（400）
- `not_found`（404）
- `conflict`（409，例如 feed URL 重复）
- `upstream_error`（502，例如 RSS 上游异常）
- `internal_error`（500）

参数校验：

- Route Handlers 内用 `zod` 校验 query/body；错误映射到 `fields`

### 读取：快照（对齐当前 UI）

`GET /api/reader/snapshot?view=all|unread|starred|<feedId>&limit=50&cursor=<opaque>`

返回：

- `data.categories: Array<{ id: string, name: string }>`
- `data.feeds: Array<{ id: string, title: string, url: string, icon?: string | null, unreadCount: number, categoryId: string | null, category?: string | null }>`
- `data.articles.items: Array<{ id: string, feedId: string, title: string, summary: string, author?: string | null, publishedAt: string | null, link?: string | null, isRead: boolean, isStarred: boolean }>`
- `data.articles.nextCursor: string | null`

说明：

- 初期以“快照式”满足前端状态初始化；后续可拆为独立分页接口以减少 payload。
- 排序：`published_at desc nulls last, id desc`（稳定分页）

### 文章

- `GET /api/articles?view=...&limit=50&cursor=...`（可选：后续从 snapshot 拆出）
- `GET /api/articles/:id`（返回 `content_html`、`ai_summary` 等）
- `PATCH /api/articles/:id` body：`{ isRead?: boolean, isStarred?: boolean }`（幂等）
- `POST /api/articles/mark-all-read` body：`{ feedId?: string }`

### 订阅源（feeds）

- `GET /api/feeds`
- `POST /api/feeds` body：`{ title: string, url: string, categoryId: string | null, icon?: string | null }`
  - 创建成功后 enqueue `feed.fetch`（立即抓取一次）
- `PATCH /api/feeds/:id`（启停/改分类/改标题/改抓取频率等）
- `DELETE /api/feeds/:id`
- `POST /api/feeds/:id/refresh`（手动触发抓取）

### RSS 校验（替换前端 mock）

`GET /api/rss/validate?url=...`

返回对齐前端 `RssValidationResult`：

- 成功：`{ ok: true, kind: 'rss' | 'atom', title?: string }`
- 失败：`{ ok: false, errorCode: 'invalid_url' | 'unauthorized' | 'timeout' | 'not_feed' | 'network_error', message?: string }`

### 分类（categories）

- `GET /api/categories`
- `POST /api/categories` body：`{ name: string }`
- `PATCH /api/categories/:id` body：`{ name: string }`
- `DELETE /api/categories/:id`（依赖 `feeds.category_id on delete set null` 自动归并未分类）

### 设置与健康检查

- `GET /api/settings` / `PATCH /api/settings`
- `GET /api/health`（DB/队列连通性）

## worker 设计

### 队列选择

使用 Postgres 作为队列后端，二选一：

- `pg-boss`（实现简单、易上手）
- `graphile-worker`（生态成熟，任务模型清晰）

实现阶段选定其一，并在 `src/server/queue/*` 做最薄封装以便替换。

### Job 类型（建议）

- `feed.fetch`：抓取并入库某个 feed（payload：`{ feedId: string }`）
- `feed.refresh_all`：扫描 enabled feeds 并 enqueue `feed.fetch`（由定时器触发）
- `ai.summarize_article`：为文章生成摘要（payload：`{ articleId: string }`）

### 定时策略

- worker 内部定时（适用于单机 Docker）：每 `N` 分钟 enqueue `feed.refresh_all`
- `feed.fetch` 内根据 `feeds.fetch_interval_minutes` + `last_fetched_at` 决定是否跳过

### 抓取与解析（关键点）

- HTTP：
  - 仅允许 `http:` / `https:`；设置 timeout；设置 `User-Agent`
  - 使用 `etag` / `last_modified` 做条件请求（304 不更新）
  - 对临时错误（5xx、超时）进行有限重试与 backoff
- SSRF 防护（即便单用户也建议做）：
  - 禁止 `file:`/`ftp:` 等协议
  - DNS 解析后拒绝内网/本机网段（`127.0.0.0/8`、`10.0.0.0/8`、`172.16.0.0/12`、`192.168.0.0/16`、`::1`、`fc00::/7` 等）
- 解析：
  - 识别 RSS/Atom
  - 生成 `dedupe_key`；对 `unique (feed_id, dedupe_key)` 冲突视为幂等成功
- 内容净化（必须）：
  - 入库前对 `content_html` 做 sanitize（移除脚本/事件属性/危险 URL scheme），避免前端 `dangerouslySetInnerHTML` 引入 XSS

### AI 摘要

- 触发条件：
  - `app_settings.ai_summary_enabled = true` 且有 `AI_API_KEY`（环境变量）
  - `app_settings.ai_auto_summarize = true` 时，新文章入库后自动 enqueue `ai.summarize_article`
- 结果写回：
  - 写 `articles.ai_summary`、`articles.ai_summary_model`、`articles.ai_summarized_at`
- 限流/成本：
  - worker 控制并发；可加每日配额（后续）

## 安全与可靠性

- XSS：强制 sanitize RSS 内容；前端只展示净化后的 `content_html`
- SSRF：校验 URL 协议、禁止内网地址
- 幂等：`feed.fetch` 通过 `unique (feed_id, dedupe_key)` 与 job 去重（如队列支持）避免重复入库
- 回滚/重试：失败记录到 `feeds.last_fetch_error`；worker 记录任务失败原因

## 可观测性

- `web` 与 `worker` 使用结构化日志（建议 `pino`）
- `GET /api/health` 提供最小健康检查

## 部署（Docker 自托管）

目标形态：

- `docker compose up` 启动 `db` + `web` + `worker`
- 环境变量建议：
  - `DATABASE_URL`
  - `AI_API_KEY`（可选）
  - `AI_API_BASE_URL` / `AI_MODEL`（也可仅通过 `app_settings` 配置）

## 前端对接迁移（建议分阶段）

1) 新增 `GET /api/reader/snapshot`，前端 app 初始化改为从 API 拉取（保留 mock fallback 便于开发）
2) 替换 `markAsRead` / `markAllAsRead` / `toggleStar` 为 API 调用（前端可做 optimistic 更新）
3) 替换新增源：`AddFeedDialog` 的校验改为 `GET /api/rss/validate`，提交改为 `POST /api/feeds`
4) 接入 worker：抓取入库后，前端通过轮询 snapshot 或增量接口刷新（后续再做 SSE/WebSocket）

## 未决项（实现前需要定）

- 任务队列库选择：`pg-boss` vs `graphile-worker`
- RSS/Atom 解析库选择与 HTML sanitize 方案
- DB migration 工具选择（如 `drizzle`/`prisma`/纯 SQL）
- cursor 格式（`nextCursor` 的编码方式与字段）


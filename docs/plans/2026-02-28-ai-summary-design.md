# AI 摘要：按订阅源开关 + worker 生成 设计

日期：2026-02-28  
状态：已确认（Approved）

## TL;DR

- 为每个 RSS 源（feed）增加开关 `aiSummaryOnOpenEnabled`：
  - 开启：点开文章自动生成 AI 摘要；若该 feed 开启全文抓取，则**优先等全文**再摘要
  - 关闭：文章页显示 `AI摘要` 按钮，用户点击后生成；若全文抓取进行中则按钮禁用；若全文失败/超时则允许回退 RSS 内容生成摘要
- 摘要生成采用 **pg-boss job + worker**：`JOB_AI_SUMMARIZE = 'ai.summarize_article'`（幂等 + 可重试等待全文）
- AI 配置来源：
  - `ai_api_key`：后端从 DB 读取（不下发前端）
  - `model` / `apiBaseUrl`：从 `app_settings.ui_settings` 读取并 normalize（空值使用默认：`gpt-4o-mini`、`https://api.openai.com/v1`）
- 文章摘要字段复用既有 DB 列：`articles.ai_summary / ai_summary_model / ai_summarized_at`

## 背景

FeedFuse 当前已有：

- 文章页入口按钮（`AI摘要`），但尚未实现（仅提示“即将上线”）
- 文章表 `articles` 已预留 AI 摘要字段（`ai_summary` 等）
- 队列 job 常量已预留 `ai.summarize_article`，但 worker 目前未消费
- AI 相关配置已具备最小闭环：
  - API Key 存储在后端 DB（`/api/settings/ai/api-key`）
  - `model` / `apiBaseUrl` 存储在 `ui_settings`（`/api/settings`）

目标是在不泄露 `ai_api_key`、不阻塞主请求线程的前提下，实现可控、可回退的 AI 摘要。

## 目标

- 支持按订阅源（feed）配置 AI 摘要触发方式（自动/手动）。
- 摘要输出固定为中文。
- 当启用全文抓取时，摘要优先基于 `contentFullHtml` 生成；全文失败/超时时允许回退 RSS 内容生成（手动按钮场景）。
- 可靠与幂等：
  - 重复打开/重复点击不重复生成（job singleton + “已有摘要则跳过”）
  - 可重试等待全文写回（有限重试，避免无穷循环）
- 成本可控：worker 并发受控、输入长度限制、失败可诊断。

## 非目标

- 不实现按分类批量开关、全局默认 + 覆盖等更复杂策略。
- 不实现“翻译”能力（只做摘要）。
- 不做用户多租户/权限体系（当前单用户自托管假设）。
- 不在本设计中引入 OpenAI SDK；使用 `fetch` 调用 OpenAI 兼容 HTTP API。

## 设计

### 1) 数据模型（DB）

在 `feeds` 表新增字段：

- `ai_summary_on_open_enabled boolean not null default false`

迁移：

- 新增 `src/server/db/migrations/0007_feed_ai_summary_on_open.sql`
- 新增对应 migration test（命名参照现有 migrations 测试约定）

`articles` 表字段复用（已存在）：

- `ai_summary text null`
- `ai_summary_model text null`
- `ai_summarized_at timestamptz null`

### 2) 后端数据层（repositories / snapshot）

#### `feedsRepo`

- `FeedRow` 增加 `aiSummaryOnOpenEnabled: boolean`
- `listFeeds` / `createFeed` / `updateFeed` SQL 透传：
  - `ai_summary_on_open_enabled as "aiSummaryOnOpenEnabled"`
- `createFeed(...)` 入参增加 `aiSummaryOnOpenEnabled?: boolean`（默认 `false`）
- `updateFeed(...)` 支持 patch `aiSummaryOnOpenEnabled?: boolean`

#### `readerSnapshotService`

`ReaderSnapshotFeed` 增加：

- `aiSummaryOnOpenEnabled: boolean`

并在 `GET /api/reader/snapshot` 下发到前端，供 `ArticleView` 决策触发方式。

#### `articlesRepo`

扩展 `getArticleById(...)` 返回字段，增加：

- `aiSummary`（来自 `ai_summary`）
- `aiSummaryModel`（来自 `ai_summary_model`）
- `aiSummarizedAt`（来自 `ai_summarized_at`）

（同时用于前端轮询拿到摘要并展示。）

### 3) AI 配置来源与默认值

#### API Key

从 DB 读取：

- `app_settings.ai_api_key`（已有 migration 与 repo 方法）
- **不向前端明文回传**

#### `model` / `apiBaseUrl`

从 UI 设置读取：

- `getUiSettings()` → `normalizePersistedSettings()` → `persisted.ai.model / persisted.ai.apiBaseUrl`

默认值策略（当 UI 未配置或为空字符串时）：

- `model`：`gpt-4o-mini`
- `apiBaseUrl`：`https://api.openai.com/v1`

说明：

- 当前 DB 也存在 `app_settings.ai_model / ai_api_base_url`，但本设计以 `ui_settings` 为来源，避免“前端写 ui_settings、worker 读 app_settings”造成配置不同步。

### 4) API 变更

#### Feed API（新增字段）

- `POST /api/feeds` body 增加可选：`aiSummaryOnOpenEnabled?: boolean`（默认 `false`）
- `PATCH /api/feeds/:id` body 增加可选：`aiSummaryOnOpenEnabled?: boolean`
- `GET /api/feeds` / `GET /api/reader/snapshot` 返回的 feed DTO 增加：`aiSummaryOnOpenEnabled`

#### Article API（返回摘要字段）

- `GET /api/articles/:id` 返回体增加：
  - `aiSummary: string | null`
  - `aiSummaryModel: string | null`
  - `aiSummarizedAt: string | null`

#### 入队：生成摘要（新增）

新增 route：

- `POST /api/articles/:id/ai-summary`

行为：

- 若文章不存在：返回 `not_found`
- 若已存在 `ai_summary`：返回 `{ enqueued: false, reason: 'already_summarized' }`
- 若 DB 中 `ai_api_key` 为空：返回 `{ enqueued: false, reason: 'missing_api_key' }`
- 否则 enqueue `JOB_AI_SUMMARIZE`，options：
  - `singletonKey = articleId`
  - `singletonSeconds = 600`
  - `retryLimit = 8`
  - `retryDelay = 30`
- 若已在队列中（pg-boss 返回空 jobId 或等价行为）：返回 `{ enqueued: false, reason: 'already_enqueued' }`

### 5) worker：摘要生成 job

在 `src/worker/index.ts` 增加：

- `boss.createQueue(JOB_AI_SUMMARIZE)`
- `boss.work(JOB_AI_SUMMARIZE, ...)` 生成摘要并写回 DB

#### 输入选择（全文优先 + 回退）

对 `articleId`：

1) 若 `ai_summary` 已有值：直接结束（幂等）
2) 读取文章内容：
   - 若 `contentFullHtml` 非空：使用全文
   - 否则：
     - 若该 feed 开启 `fullTextOnOpenEnabled = true` 且 `contentFullError` 为空：认为全文仍在抓取，抛出“可重试错误”让 job 重试等待
     - 其他情况：回退 RSS 内容（`contentHtml` 优先，其次 `summary`）
3) 将 HTML 转为纯文本（最小清洗 + 空白归一），并限制最大输入长度（例如 8k~12k 字符）

#### 模型调用（OpenAI 兼容）

- `POST ${apiBaseUrl}/chat/completions`（`apiBaseUrl` 去掉末尾 `/`）
- header：
  - `Authorization: Bearer ${aiApiKey}`
  - `Content-Type: application/json`
- 约束：
  - 输出中文
  - TL;DR + 要点列表（3~7 条）
  - 信息不足时明确不确定，不编造
- 建议参数（可调）：
  - `temperature: 0.2`
  - `max_tokens: 300~500`

#### 写回

写入：

- `articles.ai_summary`
- `articles.ai_summary_model`
- `articles.ai_summarized_at = now()`

并发/成本：

- `boss.work` 限制并发（例如 `teamSize: 2~4`）

### 6) 前端：Feed 开关 + ArticleView 触发与禁用规则

#### Feed 管理 UI

在：

- `AddFeedDialog`：新增“打开文章时自动生成 AI 摘要”（默认关闭）
- `EditFeedDialog`：可随时开/关

并在 `POST /api/feeds`、`PATCH /api/feeds/:id` 透传字段 `aiSummaryOnOpenEnabled`。

#### `ArticleView` 行为

自动模式（`feed.aiSummaryOnOpenEnabled = true`）：

- 选中文章时自动调用 `POST /api/articles/:id/ai-summary`
- 若 `feed.fullTextOnOpenEnabled = true`：
  - 仍走现有全文入队与轮询（`POST /api/articles/:id/fulltext`）
  - 摘要 job 会优先等待全文写回后再生成
- UI 增加摘要展示区域：
  - 未就绪：显示“生成中…”
  - 就绪：展示 `aiSummary`

手动模式（`feed.aiSummaryOnOpenEnabled = false`）：

- 显示 `AI摘要` 按钮
- 按钮禁用规则（按确认需求）：
  - 若 `feed.fullTextOnOpenEnabled = true` 且 `contentFullHtml` 为空 且 `contentFullError` 为空 → 禁用
  - 其他情况 → 可用（包括全文失败/超时回退 RSS 内容生成）
- 点击按钮调用 `POST /api/articles/:id/ai-summary`，并轮询 `GET /api/articles/:id` 直到 `aiSummary` 出现或超时提示

### 7) 测试与验收

#### 迁移测试

- 新增 migration test 覆盖 `feeds.ai_summary_on_open_enabled` 列存在与默认值。

#### API / repo 单元测试

- `src/app/api/feeds/routes.test.ts`：覆盖 `aiSummaryOnOpenEnabled` 的 `POST/PATCH` 行为
- `src/app/api/reader/snapshot/route.test.ts`：feeds fixture 补齐字段并断言下发
- `src/app/api/articles/routes.test.ts`：
  - 新增 `POST /:id/ai-summary` 的测试（missing key / already summarized / enqueue ok / already enqueued）
  - `GET /:id` DTO 覆盖 `aiSummary*` 字段
- `articlesRepo`：新增/更新测试覆盖 `ai_summary` 字段读写

#### 验收标准

- Feed 级开关可在新增/编辑时配置，并正确持久化/下发。
- 开启自动摘要：
  - 打开文章会自动生成摘要并展示
  - 若开启全文抓取，摘要最终基于全文（全文成功时）
- 关闭自动摘要：
  - 按钮存在
  - 全文抓取进行中按钮禁用
  - 全文失败/超时按钮可点并能生成摘要（回退 RSS）
- 重复打开/重复点击不会重复生成（幂等 OK）
- 摘要输出为中文


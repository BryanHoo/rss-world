# 设计文档：文章异步任务（全文/AI 摘要/AI 翻译）状态、轮询与错误反馈重构

日期：2026-03-04  
状态：已评审通过（待实现）

## 背景

当前文章相关的异步能力包括：

- 全文抓取：`POST /api/articles/:id/fulltext` 入队 `JOB_ARTICLE_FULLTEXT_FETCH`
- AI 摘要：`POST /api/articles/:id/ai-summary` 入队 `JOB_AI_SUMMARIZE`
- AI 翻译：`POST /api/articles/:id/ai-translate` 入队 `JOB_AI_TRANSLATE`

后端采用 `pg-boss` + `src/worker/index.ts` 消费任务，route 侧只负责校验与入队。

前端在 `src/features/articles/ArticleView.tsx` 中，为等待这些任务完成，会执行最多 30 次、每秒一次的 `refreshArticle(articleId)` 轮询；而 `refreshArticle` 会调用 `GET /api/articles/:id`。

目前 `GET /api/articles/:id` 返回整条 `ArticleRow`（包含 `content_full_html`、`ai_translation_*`、`ai_summary` 等大字段），因此会出现：

- 点击一次 AI 摘要/翻译后，会持续请求一个“大聚合接口”，网络开销与服务端负担都偏大；
- UI 层的“超时”与任务真实状态脱节（任务可能仍在队列中或执行中）；
- AI 摘要/翻译失败时缺乏持久化错误反馈（只能 `console.error` 或显示“超时”），无法在刷新后复现与重试。

## 目标（Goals）

- 将“任务状态”从 `GET /api/articles/:id` 剥离，新增轻量任务状态接口，等待异步结果时只轮询小 payload。
- 持久化异步任务状态与错误（特别是 AI 摘要/翻译），可在文章页长期可见，并提供“重试”。
- 幂等：重复点击不会重复入队；自动摘要也不会造成重复压力。
- 前端轮询具备退避（backoff）与可取消（切换文章/卸载），且不把 UI 超时当作任务失败。
- 保持现有 API envelope：`{ ok: true, data } | { ok: false, error }`（`src/server/http/apiResponse.ts`）。
- 保持产品取舍：
  - 采用轻量轮询（不引入 SSE/WebSocket）。
  - 当 `fullTextOnOpenEnabled === true` 且全文未就绪时：`ai-summary` / `ai-translate` 返回 `reason: 'fulltext_pending'`，只提示等待，不自动串联后续任务。
- 仅 FeedFuse Web 前端消费相关接口，允许在保持语义前提下调整 contract。

## 非目标（Non-goals）

- 不引入 SSE/WebSocket 推送机制。
- 不在本阶段拆分 `GET /api/articles/:id` 为多接口（可作为后续性能优化）。
- 不替换队列实现（仍使用 `pg-boss`），不调整 AI prompt/模型逻辑。
- 不对 RSS 拉取调度策略做大改（现有 worker schedule 与 `feeds` 持久化抓取结果保持）。

## 现状与主要问题（Problem Statement）

1) **大接口被当成任务轮询接口**

- 任务完成与否目前通过 `GET /api/articles/:id` 轮询来判断。
- 该接口 payload 较大，且轮询频率固定（1Hz）导致明显的重复请求。

2) **异步任务状态缺乏权威来源**

- UI“超时”来自前端固定 30 秒等待，不代表任务失败。
- 对于排队较长、执行较慢的情况，用户会得到不准确反馈。

3) **异步错误无法统一反馈到前端（特别是 AI）**

- 全文抓取通过 `articles.content_full_error` 可持久化失败原因。
- AI 摘要/翻译失败目前不会写入文章或独立状态表，用户缺少稳定错误码与可重试入口。

## 方案概述（Recommended Approach）

引入“业务侧任务表 + 轻量状态接口”的模式：

- 新增业务表 `article_tasks`，用于记录每篇文章每类任务的：`status`、`job_id`、时间戳、`error_code`/`error_message`、`attempts`。
- 新增轻量接口 `GET /api/articles/:id/tasks`，前端等待异步结果时轮询该接口。
- 保持现有 enqueue endpoints（`/fulltext`、`/ai-summary`、`/ai-translate`），但入队成功时同步写入 `article_tasks`，并在 worker 中持续更新状态。
- 前端在任务 `succeeded` 后仅刷新一次 `GET /api/articles/:id` 拉取最终内容（避免大 payload 轮询）。

## 数据模型：`article_tasks`

### 表结构（建议）

- `id`：uuid 主键
- `article_id`：uuid 外键 → `articles(id)`（`on delete cascade`）
- `type`：text（任务类型）
  - `fulltext` / `ai_summary` / `ai_translate`
- `status`：text（任务状态）
  - `idle` / `queued` / `running` / `succeeded` / `failed`
  - 说明：`idle` 可由“无记录”隐式表示；但 API 返回时应补齐为 `idle`。
- `job_id`：text nullable（`pg-boss` job id）
- `requested_at` / `started_at` / `finished_at`：timestamptz nullable
- `attempts`：int not null default 0（业务侧失败/重试次数）
- `error_code`：text nullable（稳定错误码）
- `error_message`：text nullable（短错误信息，禁止堆栈泄露）
- `created_at` / `updated_at`：timestamptz（由 SQL update 显式维护 `updated_at = now()`）

### 约束与索引

- 唯一约束：`unique(article_id, type)`，保证幂等（同一文章同一任务类型最多一条）。
- 索引建议：`(article_id)`、`(status, updated_at)`。

### 状态机

- `queued`：用户触发入队后写入（清空 `error_*`）。
- `running`：worker 开始处理时写入。
- `succeeded`：worker 成功写回 `articles` 后写入。
- `failed`：worker 捕获错误后写入（递增 `attempts`，写 `error_code/error_message`）。

## API 设计

### 1) 轻量任务状态

- `GET /api/articles/:id/tasks`
  - 返回该文章 3 类任务的轻量状态（固定 shape，前端无需额外 join）：

示例（概念）：

```json
{
  "fulltext": { "type": "fulltext", "status": "running" },
  "ai_summary": { "type": "ai_summary", "status": "idle" },
  "ai_translate": { "type": "ai_translate", "status": "failed", "errorCode": "ai_rate_limited" }
}
```

> 说明：实际仍封装为 `ok(data)` envelope。

### 2) 入队接口（保持现有语义）

- `POST /api/articles/:id/fulltext`
- `POST /api/articles/:id/ai-summary`
- `POST /api/articles/:id/ai-translate`

建议统一响应结构：

- 入队成功：`{ enqueued: true, jobId, task }`
- 未入队：`{ enqueued: false, reason, task? }`

#### `reason`（同步拒绝/不入队）

用于表达“未满足条件，因此没有产生异步任务”，例如：

- `missing_api_key`
- `body_translate_disabled`
- `already_summarized` / `already_translated` / `already_fulltext`
- `fulltext_pending`（产品选择：只提示等待，不自动串联）
- `already_enqueued`（如果 singleton 拦截，可返回该 reason 并附带当前 `task.status`）

### 3) 重试

- 推荐复用原 enqueue 接口作为重试入口（点击“重试”即再次 `POST /ai-summary` 等）。
- 可选：增加显式 retry endpoint（非必需）
  - `POST /api/articles/:id/tasks/:type/retry`

## 后端实现要点

### Repository 分层

新增 `src/server/repositories/articleTasksRepo.ts`（示例职责）：

- `getArticleTasksByArticleId(pool, articleId)`
- `upsertTaskQueued(pool, { articleId, type, jobId? })`
- `setTaskRunning(...)` / `setTaskSucceeded(...)` / `setTaskFailed(...)`

### enqueue routes 写入任务状态

以 `POST /api/articles/:id/ai-summary` 为例：

- 保持现有校验：`missing_api_key`、`already_summarized`、`fulltext_pending` 等不入队返回。
- 需要入队时：
  - `upsertTaskQueued(..., jobId = null)`
  - `enqueue(JOB_AI_SUMMARIZE, { articleId }, ...)` → 得到 `jobId`
  - `upsertTaskQueued(..., jobId)`（或 `update job_id`）

### worker 更新状态与持久化错误

在 `src/worker/index.ts` 的每个 `boss.work(JOB_...)` 处理循环中：

- 开始：`setTaskRunning(articleId, type, jobId?)`
- 成功：先写回 `articles`（如 `setArticleAiSummary`），再 `setTaskSucceeded(...)`
- 失败：
  - 映射成稳定 `{ errorCode, errorMessage }`
  - `setTaskFailed(...)`
  - 继续 `throw` 以便 `pg-boss` 记录失败（与业务表同时存在，便于排障）

### 错误码映射（统一）

新增一个集中错误映射模块（例如 `src/server/tasks/errorMapping.ts`），将 `unknown err` 映射到稳定错误码：

- AI：`ai_timeout` / `ai_rate_limited` / `ai_bad_response` / `ai_provider_error` / `ai_invalid_config`
- Fulltext：`fetch_timeout` / `fetch_http_error` / `fetch_non_html` / `ssrf_blocked` / `parse_failed`
- 兜底：`unknown_error`

`error_message` 必须是短且安全的文案（禁止堆栈泄露、禁止包含敏感信息）。

## 前端实现要点

### 轮询策略：从 `GET /api/articles/:id` 转为 `GET /api/articles/:id/tasks`

- 新增 API client：`getArticleTasks(articleId)`。
- 统一轮询器（hook/工具均可）：
  - 退避：`500ms → 1s → 2s → 3s → 5s（上限）`
  - 总等待时长：例如 60s，仅作为 UI 提示阈值（不代表失败）
  - 可取消：切换文章/组件卸载立即停止
- 当任务进入 `succeeded`：调用一次 `refreshArticle(articleId)` 拉回最终内容后停止轮询。
- 当任务进入 `failed`：停止轮询，在文章页展示持久化错误 + “重试”。

### `fulltext_pending`（产品选择 B）

当用户点“AI摘要/翻译”但 `reason: 'fulltext_pending'`：

- 不启动该 AI 任务轮询（因为未入队）。
- 文章页显示明确提示：“正在抓取全文，完成后重试”。
- 同时继续展示 fulltext 任务的状态（来自 tasks）。

### 状态展示

- 文章已有结果（`article.aiSummary` / `article.aiTranslation*` / `article.contentFullHtml`）优先展示内容。
- 否则按 tasks 状态展示：`queued/running` loading，`failed` 错误块（含重试）。
- toast/notification 用于瞬时反馈（“已加入队列”/“全文未就绪”），持久化错误用 inline block。

## 测试与验收

### 后端测试建议

- `GET /api/articles/:id/tasks`：无记录返回 `idle`，有记录返回正确映射。
- enqueue routes：
  - `missing_api_key` / `fulltext_pending` 不写 queued、不 enqueue。
  - 入队成功写入 queued + jobId。
- errorMapping：不同错误输入映射到稳定 `error_code`。

### 前端测试建议

- 点击 `AI摘要`：不再触发 1Hz 的 `GET /api/articles/:id` 轮询；改为轮询 `GET /api/articles/:id/tasks`。
- tasks `succeeded` 后只刷新一次文章详情。
- tasks `failed` 后展示持久化错误与“重试”。
- `fulltext_pending` 显示提示且不启动 AI 轮询。

### 验收标准（Acceptance Criteria）

- 点击一次 `AI摘要/翻译/全文` 后：
  - 轮询发生在 `GET /api/articles/:id/tasks`（小 payload）；
  - `GET /api/articles/:id` 不再以 1Hz 重复请求（仅在成功后刷新一次）。
- AI 摘要/翻译失败会写入 `article_tasks`，刷新页面后仍可见，并可重试。
- UI 超时仅作为“仍在处理中”的提示，不会与 `failed` 混淆。
- `pnpm run test:unit` 通过。

## 分阶段落地建议（可选）

- Phase 1（本设计范围）：落地 `article_tasks` + `/tasks` API + front-end 轮询替换 + AI 错误持久化。
- Phase 2（性能优化，可选）：如有需要，将 `GET /api/articles/:id` 拆分为元数据与正文接口，进一步降低单次 payload。
- Phase 3（可选）：将 feed refresh/rss fetch 纳入类似任务体系（或新增 `feed_tasks`），用于前端展示刷新进度与错误聚合。

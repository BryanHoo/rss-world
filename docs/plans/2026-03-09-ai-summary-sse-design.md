# AI 摘要 SSE 设计

- 日期：2026-03-09
- 状态：已确认
- 需求：AI 摘要改为和翻译一样使用 SSE，在文章详情中边生成边显示；支持自动触发、半成品持久化、后台继续运行，以及重新打开文章后自动恢复实时流

## 背景

当前 AI 摘要链路以入队加轮询为主：[`src/app/api/articles/[id]/ai-summary/route.ts`](../../src/app/api/articles/[id]/ai-summary/route.ts) 只负责校验与入队，[`src/worker/index.ts`](../../src/worker/index.ts) 中的 `ai_summary` worker 调用 [`src/server/ai/summarizeText.ts`](../../src/server/ai/summarizeText.ts) 一次性生成最终文本，再写回 `articles.ai_summary`。前端 [`src/features/articles/ArticleView.tsx`](../../src/features/articles/ArticleView.tsx) 通过 `pollWithBackoff(getArticleTasks)` 等待任务状态完成，成功后再调用 [`src/store/appStore.ts`](../../src/store/appStore.ts) 中的 `refreshArticle` 更新文章详情。

与之相对，正文翻译已经具备完整的 SSE 基础设施：[`src/app/api/articles/[id]/ai-translate/route.ts`](../../src/app/api/articles/[id]/ai-translate/route.ts) 负责创建翻译 session，[`src/worker/immersiveTranslateWorker.ts`](../../src/worker/immersiveTranslateWorker.ts) 持续写入翻译事件，[`src/app/api/articles/[id]/ai-translate/stream/route.ts`](../../src/app/api/articles/[id]/ai-translate/stream/route.ts) 通过 SSE 回放事件，前端 [`src/features/articles/useImmersiveTranslation.ts`](../../src/features/articles/useImmersiveTranslation.ts) 先拉 snapshot 再接流。

本次需求不是单纯把摘要的轮询状态改成 SSE 推送，而是要求：

- 打开文章后自动启动摘要生成，并实时看到文本增量
- 半成品可以持久化保存
- 页面关闭、切换文章或刷新后，后台任务继续完成
- 重新打开文章时，页面能恢复到当前草稿并继续实时更新
- 已有正式摘要时重新生成，旧摘要立即退出主展示位

截至 2026-03-09，仓库中没有 `docs/summaries/` 目录可供复用历史经验，因此本设计仅基于当前摘要、翻译、worker 和 reader 现状制定。

## 目标

- 将 AI 摘要改造成“后台流式生成 + SSE 实时展示”的链路。
- 让文章详情页在摘要运行中显示持久化草稿，而不是只显示 loading。
- 支持 `aiSummaryOnOpenEnabled` 自动触发后立即进入流式展示。
- 支持页面重进或刷新后自动恢复到当前摘要会话并重新连接 SSE。
- 只有摘要成功完成时才覆盖正式 `article.aiSummary`。

## 非目标

- 不实现模型侧 token 级断点续传。
- 不修改文章列表等非详情页面去显示半成品摘要。
- 不让 `article_tasks` 承载摘要正文或草稿，只保留任务状态职责。
- 不复用翻译的 segment 结构去表达摘要文本增量。
- 不重做摘要卡片视觉设计，仅在现有位置增强状态与流式展示。

## 备选方案

### 方案 1：持久化摘要 session + event log + 后台流式 worker

新增摘要专用 session 与事件表；worker 通过 OpenAI 流式接口边生成边写草稿和事件；前端先读 snapshot，再通过 SSE 回放事件并接收后续增量。

优点：

- 同时满足“边生成边显示”“后台继续”“断线恢复”“半成品持久化”。
- 与现有翻译 SSE 架构最一致，职责边界清晰。
- 支持 `Last-Event-ID` 重放和跨页面恢复。

缺点：

- 需要新增持久化结构、SSE 路由和前端 hook，改动面最大。

### 方案 2：只持久化摘要 session，不记录事件日志

只保存当前草稿和状态，SSE 路由定时读取 session 并按 diff 推送给前端。

优点：

- 表结构更少，实现初期更轻。

缺点：

- 重连恢复和增量去重更脆弱。
- 需要在 SSE 层自行处理文本 diff，不如事件回放稳定。
- 无法自然复用翻译现有的“snapshot + event replay”模式。

### 方案 3：请求内直连模型流并直接推前端

由 API 路由直接向模型发起流式请求，再把响应透传为 SSE 给前端。

优点：

- 初始改动最少，能很快看到流式效果。

缺点：

- 浏览器断开时任务通常也会受影响，不满足后台继续运行。
- 重进页面无法恢复已生成草稿，只能重新生成或另造后台链路。
- 最终会演化成两套摘要通路，维护成本更高。

## 推荐方案

采用方案 1：持久化摘要 session + event log + 后台流式 worker。

理由：

- 完整满足“实时展示、后台运行、断线恢复、半成品持久化”的组合要求。
- 设计形态与现有翻译 SSE 最接近，团队更容易复用既有心智模型。
- 允许正式摘要与运行中草稿并存，避免把半成品误投影到非详情页面。

## 已确认设计

### 架构与职责边界

保留现有 [`src/app/api/articles/[id]/ai-summary/route.ts`](../../src/app/api/articles/[id]/ai-summary/route.ts) 作为摘要请求入口，但职责从“入队后靠轮询等待最终结果”扩展为“创建或重置摘要 session，并将任务交给后台 worker”。`force` 重跑时，该接口必须创建新的活动 session，并让旧正式摘要立即退出详情页主展示位。

新增摘要专用 snapshot 与 stream 接口：

- `GET /api/articles/:id/ai-summary`：返回当前活动或最近相关的摘要 session 快照
- `GET /api/articles/:id/ai-summary/stream`：通过 SSE 回放并推送活动 session 的摘要事件

新增后台流式 worker，替换当前一次性 `summarizeText()` 的使用方式。worker 负责消费 OpenAI 的流式响应、更新草稿、写事件、收敛 session 最终状态，并在成功完成时同步正式 `articles.ai_summary`。

前端从 [`src/features/articles/ArticleView.tsx`](../../src/features/articles/ArticleView.tsx) 中抽离摘要逻辑为独立 hook，形态接近 [`src/features/articles/useImmersiveTranslation.ts`](../../src/features/articles/useImmersiveTranslation.ts)。详情页不再以 `pollWithBackoff(getArticleTasks)` 作为摘要主链路，而是改为“文章详情快照 + 摘要 snapshot + SSE”组合。

### 数据模型

不复用翻译的 `article_translation_*` 表，而是新增摘要专用持久化结构：

#### `article_ai_summary_sessions`

建议字段：

- `id`
- `article_id`
- `source_text_hash`
- `status`，建议值为 `queued | running | succeeded | failed | canceled`
- `draft_text`
- `final_text`
- `model`
- `job_id`
- `error_code`
- `error_message`
- `started_at`
- `finished_at`
- `updated_at`
- `superseded_by_session_id`
- `last_stream_offset`

字段语义：

- `draft_text` 保存当前累计草稿，支持页面恢复和失败后保留半成品。
- `final_text` 保存本次会话最终摘要，避免和草稿混淆。
- `superseded_by_session_id` 用于“重新生成”时标记旧会话已被替代。
- `last_stream_offset` 用于标记累计流式进度，便于服务端与前端恢复增量边界。

#### `article_ai_summary_events`

建议字段：

- `event_id`
- `session_id`
- `event_type`
- `payload`
- `created_at`

建议事件类型：

- `session.started`
- `summary.delta`
- `summary.snapshot`
- `session.completed`
- `session.failed`
- `session.canceled`

这里同时保留 `summary.delta` 与 `summary.snapshot`：

- `summary.delta` 提供实时增量显示
- `summary.snapshot` 在重连和纠偏时提供完整草稿校准

不建议把每个 token 都持久化为单独事件；应按时间或字符数做节流聚合，减少事件膨胀。

### 活动会话与正式摘要规则

同一篇文章同一时刻只允许一个活动摘要会话。活动会话定义为 `queued` 或 `running`，且未被新的 session 标记为 superseded。

当用户在已有正式摘要的情况下点击“生成摘要”时：

1. 创建新的摘要 session
2. 旧运行中 session 标记为 `canceled` 或被 superseded
3. 详情页立即切换到新 session 视图
4. 旧正式 `article.aiSummary` 不再作为主展示内容

正式 `articles.ai_summary` 的规则保持严格：

- 流式生成过程中只更新 `article_ai_summary_sessions.draft_text`
- 生成成功时先写 `final_text`
- 只有成功完成时才覆盖 `articles.ai_summary`

这样可以保证列表页、快照页等非详情场景只读正式摘要，不会读到半成品。

### 接口与数据流

建议保持与翻译相似的“enqueue + snapshot + stream”模式：

1. 详情页打开文章，读取 [`src/app/api/articles/[id]/route.ts`](../../src/app/api/articles/[id]/route.ts) 返回的文章详情。
2. 如果详情中存在活动 `aiSummarySession`，前端立即显示 `draftText`，随后拉 `GET /ai-summary` snapshot 并建立 SSE。
3. 如果 feed 开启 `aiSummaryOnOpenEnabled` 且当前没有活动或已完成的新摘要，前端自动调用 `POST /ai-summary` 创建会话并进入同一条恢复链路。
4. SSE 持续推送 `summary.delta` / `summary.snapshot` / `session.completed` / `session.failed`。
5. 完成后前端调用 `refreshArticle(articleId)`，将正式 `article.aiSummary` 与摘要 session 状态重新对齐。

建议为文章详情接口补充轻量摘要快照，例如 `aiSummarySession`：

- `id`
- `status`
- `draftText`
- `finalText`
- `errorCode`
- `errorMessage`
- `startedAt`
- `finishedAt`
- `updatedAt`

这样 [`src/store/appStore.ts`](../../src/store/appStore.ts) 中的 `refreshArticle` 可以一次性刷新文章正式摘要与当前摘要会话，而不需要把摘要会话完全拆成独立 store。

### 前端展示策略

建议新增类似 `useStreamingAiSummary(articleId)` 的 hook，负责：

- 发起 `POST /ai-summary`
- 拉取摘要 snapshot
- 管理 `EventSource`
- 合并 `summary.delta` 与 `summary.snapshot`
- 在完成、失败、缺少 API key、等待全文等状态间切换

详情页展示优先级固定如下：

1. 如果有活动摘要 session，显示该 session 的 `draftText` 或 `finalText`
2. 否则如果存在正式 `article.aiSummary`，显示正式摘要
3. 否则显示空态、缺少 API key、等待全文或失败提示

UI 保持当前摘要卡片位置和大部分样式，仅增强状态表达：

- `running`：显示摘要卡片和实时草稿，头部提示“正在生成摘要”
- `succeeded`：显示可展开的最终摘要
- `failed`：若已有草稿则继续显示草稿并给出重试；若没有草稿则显示错误卡片

流式展示不应增加复杂的逐字动画，只需稳定追加文本，保证阅读体验平稳。

### 恢复、重连与后台继续

页面关闭、切换文章或刷新时，不应影响后台 worker 继续运行。前端重新进入文章详情时应执行：

1. 读取文章详情中的 `aiSummarySession`
2. 若状态为 `queued` 或 `running`，立即显示持久化草稿
3. 拉取一次摘要 snapshot 校正本地草稿
4. 建立 SSE 继续接收增量

建议使用“snapshot 兜底 + SSE 增量”的恢复策略，而不是只依赖 EventSource 自动重连。原因是摘要是单长文本，丢失单个增量就会导致本地拼接漂移；重连后先用 snapshot 校正更稳妥。

需要明确的恢复边界：

- 支持用户体验恢复：页面重进后看到最新草稿并继续接流
- 支持后台任务恢复：页面断开不影响 worker 跑完
- 不做模型 token 级断点续传：失败后的重试创建新的 session，从原始文章内容重新生成

### 错误处理

以下错误语义需要区分：

- `missing_api_key`：维持现有提示，不创建流式展示
- `fulltext_pending`：维持现有提示，不进入摘要流式态
- 模型流式失败：session 标记 `failed`，保留 `draft_text` 和错误信息
- 用户重跑：旧 session 标记 `canceled` 或 superseded，前端切换到新 session
- worker 异常退出：最终应收敛为 `failed`，并保留已写入草稿

`article_tasks.ai_summary` 仍用于任务状态和错误聚合，但不再承载摘要主展示逻辑。

### 测试要求

测试应覆盖 API、worker、前端 hook 与回归四层：

#### API 与仓储

- 验证 `POST /api/articles/:id/ai-summary` 在 `missing_api_key`、`fulltext_pending`、`already_enqueued`、`force`、`already_summarized + force` 下的行为
- 验证 `GET /api/articles/:id/ai-summary` 返回活动或最近摘要 session 快照
- 验证 `GET /api/articles/:id/ai-summary/stream` 能回放事件并支持 `Last-Event-ID`
- 验证摘要 session 与事件仓储的读写、活动会话选择、supersede 逻辑

#### Worker

- 验证流式增量会更新 `draft_text` 并写入 `summary.delta` / `summary.snapshot`
- 验证成功完成时写 `final_text` 并覆盖 `articles.ai_summary`
- 验证失败时保留草稿、记录错误并将状态置为 `failed`
- 验证重跑时旧 session 被 supersede，新 session 成为活动会话

#### 前端

- 验证 `aiSummaryOnOpenEnabled` 时打开文章会自动进入流式摘要
- 验证已有正式摘要时点击“生成摘要”，旧摘要立即隐藏并切到新会话
- 验证页面重进时会恢复草稿并继续消费 SSE
- 验证失败时显示错误并保留已有草稿，可继续重试

#### 回归

- 确认文章列表和 snapshot 继续只依赖正式 `article.aiSummary`
- 确认 `refreshArticle()` 能同步更新正式摘要与摘要会话
- 确认现有正文翻译 SSE 行为不受影响

## 成功标准

- 打开开启 `aiSummaryOnOpenEnabled` 的文章时，摘要会自动开始，且卡片实时显示生成内容
- 切换文章、刷新页面或重新进入后，能恢复到最新草稿并继续实时更新
- 页面断开不影响后台摘要任务完成
- 生成完成后，正式 `article.aiSummary` 被新结果覆盖
- 已有摘要时点击“生成摘要”，旧摘要立即隐藏并切换到新的流式生成
- 失败时保留半成品并允许重试

## 参考实现入口

- [`src/app/api/articles/[id]/ai-summary/route.ts`](../../src/app/api/articles/[id]/ai-summary/route.ts)
- [`src/app/api/articles/[id]/route.ts`](../../src/app/api/articles/[id]/route.ts)
- [`src/app/api/articles/[id]/ai-translate/route.ts`](../../src/app/api/articles/[id]/ai-translate/route.ts)
- [`src/app/api/articles/[id]/ai-translate/stream/route.ts`](../../src/app/api/articles/[id]/ai-translate/stream/route.ts)
- [`src/features/articles/ArticleView.tsx`](../../src/features/articles/ArticleView.tsx)
- [`src/features/articles/useImmersiveTranslation.ts`](../../src/features/articles/useImmersiveTranslation.ts)
- [`src/store/appStore.ts`](../../src/store/appStore.ts)
- [`src/server/ai/summarizeText.ts`](../../src/server/ai/summarizeText.ts)
- [`src/server/repositories/articlesRepo.ts`](../../src/server/repositories/articlesRepo.ts)
- [`src/server/repositories/articleTranslationRepo.ts`](../../src/server/repositories/articleTranslationRepo.ts)
- [`src/worker/index.ts`](../../src/worker/index.ts)
- [`src/worker/immersiveTranslateWorker.ts`](../../src/worker/immersiveTranslateWorker.ts)

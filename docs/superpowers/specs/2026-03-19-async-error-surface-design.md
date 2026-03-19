# 异步任务原始错误透出设计

## 背景

当前 FeedFuse 的异步错误链路会在 worker 或任务状态层先把异常映射成中文友好文案，再落到数据库并返回前端：

- `AI 摘要` 通过 `article_tasks` 与 `article_ai_summary_sessions` 记录失败状态；
- `AI 翻译` 通过 `article_tasks`、`article_translation_sessions`、`article_translation_segments` 记录失败状态；
- `RSS` 拉取通过 `feeds.last_fetch_error` 记录失败原因。

现状问题是：

- 第三方 AI provider 的原始报错在映射后被覆盖，前端只能看到“AI 配置无效”“请求太频繁了”等泛化信息；
- RSS 拉取失败只保留中文概述，用户与开发者都无法从 UI 确认真实失败原因；
- 右栏文章视图缺少统一的失败展示区，摘要与翻译错误散落在各自状态里，无法集中表达“这篇文章的异步处理失败了什么”。

本次设计的目标不是重做错误平台，而是在不推翻现有异步任务模型的前提下，把“可直接帮助用户定位问题的原始错误”稳定保留下来，并展示到正确位置。

## 目标

- 为 `AI 摘要`、`AI 翻译`、`RSS 拉取` 补充脱敏后的原始错误存储；
- 保留现有 `errorCode` 与中文 `errorMessage`，不破坏既有状态判断与默认文案；
- 在文章右栏新增独立错误卡片，用于展示 `AI 摘要` 与 `AI 翻译` 的失败原因；
- RSS 源拉取失败时，继续使用现有 hover tooltip，但内容改为优先展示原始错误；
- 对原始错误做最小清洗：脱敏、规整空白、长度截断，避免把敏感信息直接暴露到前端。

## 非目标

- 不引入新的统一错误中心、错误日志后台或任务审计页面；
- 不记录完整 `stack trace`；
- 不改变现有任务状态机（`queued/running/succeeded/failed`）；
- 不新增浏览器测试；
- 不修改错误展示的整体视觉语言，只在现有阅读器与 tooltip 基础上增强内容。

## 现状

### AI 摘要

`src/worker/aiSummaryStreamWorker.ts` 在失败时调用 `mapTaskError()`，把异常映射为 `errorCode + errorMessage`，随后写入：

- `article_tasks`
- `article_ai_summary_sessions`
- `article_ai_summary_events`

其中返回前端的 `article.aiSummarySession.errorMessage` 与 `/api/articles/[id]/tasks` 的 `tasks.ai_summary.errorMessage` 都只包含友好文案，不含 provider 原始报错。

### AI 翻译

`src/worker/articleTaskStatus.ts` 与 `src/worker/immersiveTranslateWorker.ts` 都会调用 `mapTaskError()`。翻译 segment 失败后，`article_translation_segments.error_message` 与事件 payload 只记录映射文案；文章级 `/api/articles/[id]/tasks` 也只能看到泛化错误。

这导致前端右栏虽然能知道“翻译失败了”，但不知道失败到底是 `401 invalid api key`、`429 rate limit` 还是具体 provider 返回的结构错误。

### RSS 拉取

`src/worker/index.ts` 中 `fetchAndIngestFeed()` 会使用 `mapFeedFetchError()` 把异常转换成中文描述，并将结果写入 `feeds.last_fetch_error`。因此 feed 列表中的 hover tooltip 目前只会显示概述，不会显示源站返回的真实错误信息。

## 设计方案

### 1. 保留双轨错误信息

所有相关异步错误统一保留三类信息：

- `errorCode`：机器可判定的错误码；
- `errorMessage`：中文友好文案，保持现有职责；
- `rawErrorMessage`：脱敏、截断后的原始错误文本。

其中：

- `errorCode` 用于前端逻辑判断和兼容既有分支；
- `errorMessage` 继续作为默认兜底文案；
- `rawErrorMessage` 用于把真实失败原因展示给用户。

这意味着现有 “友好映射” 不再覆盖原始错误，而是变成一层附加信息。

### 2. 数据模型扩展

在现有表结构上做最小增量：

#### `article_tasks`

- 新增 `raw_error_message text null`

用途：

- 为 `AI 摘要` / `AI 翻译` / `全文抓取` 的通用任务状态保留原始错误；
- `GET /api/articles/[id]/tasks` 可直接透出文章级失败原文。

#### `article_ai_summary_sessions`

- 新增 `raw_error_message text null`

用途：

- 流式摘要 UI 当前依赖 session 快照；
- 当摘要在 session 内失败时，右栏可以直接从 `article.aiSummarySession` 读取原始错误。

#### `article_translation_sessions`

- 新增 `raw_error_message text null`

用途：

- 为翻译会话级失败保留汇总原始错误；
- 右栏总错误卡片可优先使用 session 级原始错误。

#### `article_translation_segments`

- 新增 `raw_error_message text null`

用途：

- 保留每个 segment 的真实失败原因；
- 后续如果前端继续展示分段失败信息，可避免信息丢失。

#### `feeds`

- 新增 `last_fetch_raw_error text null`

用途：

- 供 RSS 源 hover tooltip 展示脱敏后的真实拉取错误；
- 保持现有 `last_fetch_error` 作为友好概述。

### 3. 原始错误规范化

新增统一的原始错误提取与清洗逻辑，供 `mapTaskError()`、`mapFeedFetchError()` 及 digest 错误映射复用。

建议输出结构：

- `errorCode`
- `errorMessage`
- `rawErrorMessage`

`rawErrorMessage` 的处理规则：

- 从 `Error.message` 或字符串异常中提取，不读取 `stack`；
- 合并连续空白为单空格；
- 脱敏常见敏感值：
  - `Authorization: Bearer ...`
  - `Bearer ...`
  - `api_key=...`
  - 明显过长的 token / secret / signature 字串
- 长度截断，建议上限 `800` 字符；
- 没有可靠原文时返回 `null`。

设计原则：

- 保留 provider 原文语义，尽量不再重写；
- 绝不把完整密钥、签名、认证头直接送到前端；
- 不依赖某一家 provider 的固定报错格式。

### 4. 后端写入策略

#### `mapTaskError()`

从只返回：

- `errorCode`
- `errorMessage`

升级为返回：

- `errorCode`
- `errorMessage`
- `rawErrorMessage`

适用范围：

- `fulltext`
- `ai_summary`
- `ai_translate`

#### `mapFeedFetchError()`

同样升级为返回双轨错误信息：

- `errorCode`
- `errorMessage`
- `rawErrorMessage`

RSS 抓取链路在 `recordFeedFetchResult()` 时同时写入：

- `lastFetchError`
- `lastFetchRawError`

#### `mapDigestError()`

虽然本次 UI 需求未直接要求 AI digest 展示原始错误，但为保持错误模型一致，应同步升级为返回 `rawErrorMessage`，并写入对应 run 记录。这能避免系统内又出现一套只保留友好文案的分支。

### 5. API 透出

以下接口 DTO 补充 `rawErrorMessage`：

#### `/api/articles/[id]/tasks`

返回的 `fulltext`、`ai_summary`、`ai_translate` 任务对象新增：

- `rawErrorMessage: string | null`

#### `/api/articles/[id]`

`aiSummarySession` 快照新增：

- `rawErrorMessage: string | null`

#### `/api/articles/[id]/ai-translate`

- `session` 新增 `rawErrorMessage: string | null`
- `segments[]` 新增 `rawErrorMessage: string | null`

#### Reader snapshot / feeds DTO

feed DTO 新增：

- `lastFetchRawError: string | null`

现有前端字段 `fetchError` 继续保留，新增与之对应的原始错误字段，例如 `fetchRawError`。

### 6. 前端展示

#### 6.1 文章右栏错误卡片

在 `src/features/articles/ArticleView.tsx` 中新增独立错误卡片，位置放在 AI 摘要区域与正文区域之间，视觉风格复用当前状态卡片语言。

触发条件：

- `aiSummarySession.status === 'failed'`，或
- `tasks.ai_summary.status === 'failed'`，或
- `tasks.ai_translate.status === 'failed'`

卡片内容：

- 标题：`处理失败`
- 摘要错误区块：
  - 优先显示 `aiSummarySession.rawErrorMessage`
  - 其次显示 `tasks.ai_summary.rawErrorMessage`
  - 最后退回友好文案
- 翻译错误区块：
  - 优先显示 `tasks.ai_translate.rawErrorMessage`
  - 若后续前端读取翻译 session，则可优先取 session 级原始错误
  - 最后退回友好文案

交互要求：

- 保留现有翻译失败时的 `重试` 按钮；
- 不把错误卡片与“加载中 / 缺少 API key / fulltext pending”状态混在同一块；
- 若摘要和翻译同时失败，在同一卡片内分两组展示，避免堆叠多个重复容器。

#### 6.2 RSS 失败 tooltip

保留现有 hover tooltip 交互，只替换内容选择策略：

- 优先展示 `lastFetchRawError`
- 若为空，则回退 `lastFetchError`

这样既能兼容旧数据，也不会为 RSS 列表引入额外视觉噪音。

## 数据流

### AI 摘要 / AI 翻译

1. 第三方 provider 抛出原始异常；
2. worker 捕获异常并调用统一错误规范化；
3. 生成：
   - `errorCode`
   - `errorMessage`
   - `rawErrorMessage`
4. 写入对应 task / session / segment；
5. API DTO 透出原始错误；
6. 右栏错误卡片优先展示 `rawErrorMessage`。

### RSS 拉取

1. 抓取或解析阶段抛出原始异常；
2. `mapFeedFetchError()` 生成友好文案与原始错误；
3. `feeds` 同时记录：
   - `lastFetchError`
   - `lastFetchRawError`
4. feed 列表 tooltip 优先展示 `lastFetchRawError`。

## 边界条件

- 原始错误为 `null` 时，前端必须回退到 `errorMessage`；
- 迁移前旧数据没有 `raw_error_message` 时，不影响现有 UI；
- provider 报错过长时，只展示截断后的前缀，避免 tooltip 或卡片失控；
- 对于包含敏感信息的异常文本，脱敏必须发生在落库前，而不是只在前端显示时处理；
- 不把 `stack`、内部文件路径或完整请求头作为 `rawErrorMessage` 返回；
- 事件表若继续写失败 payload，可选择同步写入 `rawErrorMessage`，但事件不是本次前端渲染的唯一数据源。

## 测试策略

遵循 TDD，先补测试，再实现。

### 后端单元测试

- `errorMapping` / `feedFetchErrorMapping`
  - 保留常见 provider 原文
  - 脱敏 bearer token / api key
  - 正确截断超长文本
  - 无法提取原文时返回 `null`

### worker / repository 测试

- AI 摘要失败时：
  - `article_tasks.raw_error_message` 被写入
  - `article_ai_summary_sessions.raw_error_message` 被写入
- AI 翻译失败时：
  - `article_tasks.raw_error_message` 被写入
  - `article_translation_sessions.raw_error_message` 被写入
  - `article_translation_segments.raw_error_message` 被写入
- RSS 拉取失败时：
  - `feeds.last_fetch_raw_error` 被写入

### API 测试

- `/api/articles/[id]/tasks` 返回 `rawErrorMessage`
- `/api/articles/[id]` 的 `aiSummarySession` 返回 `rawErrorMessage`
- `/api/articles/[id]/ai-translate` 的 `session` 与 `segments` 返回 `rawErrorMessage`
- feed / snapshot DTO 返回 `lastFetchRawError`

### 前端测试

- 文章右栏在摘要失败、翻译失败、两者同时失败时正确渲染错误卡片；
- 错误卡片优先展示 `rawErrorMessage`，缺失时退回 `errorMessage`；
- RSS hover tooltip 优先展示 `lastFetchRawError`。

## 验证

按项目约束，最终实现完成后必须运行：

```bash
pnpm build
```

本次设计阶段不自动做浏览器测试；若后续需要浏览器验证，应先征得用户同意。

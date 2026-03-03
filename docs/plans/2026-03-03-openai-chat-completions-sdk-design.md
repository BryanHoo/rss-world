# 设计文档：AI 摘要/翻译迁移到 OpenAI 官方 SDK（chat.completions）

日期：2026-03-03  
状态：已评审通过（待实现）

## 背景

当前 `AI 摘要` 与 `AI 翻译`（标题翻译、正文双语翻译）在后端/worker 侧均通过手写 `fetch` 调用 `POST ${apiBaseUrl}/chat/completions` 来实现：

- `src/server/ai/summarizeText.ts`
- `src/server/ai/translateTitle.ts`
- `src/server/ai/translateHtml.ts`（当前有测试覆盖，未必在主流程中使用）
- `src/server/ai/bilingualHtmlTranslator.ts`

目标是统一改为使用 OpenAI 官方 npm 包 `openai`，并通过 `chat.completions` 发起请求，不再在业务代码中手工拼接请求与解析 HTTP 状态码。

## 目标（Goals）

- 使用 OpenAI 官方包 `openai`（OpenAI Node SDK）。
- 使用 `chat.completions`（不切换 `responses`）。
- 业务代码不再手写 `fetch(`${baseUrl}/chat/completions`, ...)` 构建请求。
- `apiBaseUrl` 继续可配置：不校验、不强制补全 `/v1`；行为与现有一致（仅去掉末尾 `/`）。
- SDK 错误直接抛出原始错误（不包装成自定义 `... API failed: ...`）。
- 重试策略调整：
  - OpenAI SDK：使用默认重试策略。
  - pg-boss job：不使用 pg-boss 重试；对 AI 相关入队显式设置 `retryLimit: 0`（并移除 `retryDelay/retryBackoff`）确保不重试。
- 当 `fullTextOnOpenEnabled === true` 且全文尚未抓取完成时，`ai-summary` 路由返回 `fulltext_pending`，避免入队后在 worker 里失败。

## 非目标（Non-goals）

- 不改动 prompts 文案、temperature、批处理策略、HTML 结构处理与双语重建逻辑。
- 不引入流式输出、不引入工具调用（tool calls）。
- 不改动 settings 结构、数据库 schema、队列体系结构（只调整入队参数与调用方式）。

## 现状与调用链（简述）

- `src/app/api/articles/[id]/ai-summary/route.ts` 入队 `JOB_AI_SUMMARIZE` → `src/worker/index.ts` 执行 `summarizeText(...)`
- `src/app/api/articles/[id]/ai-translate/route.ts` 入队 `JOB_AI_TRANSLATE` → `src/worker/index.ts` 执行 `extractTranslatableSegments` + `translateSegmentsInBatches(...)` + `reconstructBilingualHtml(...)`
- `src/worker/index.ts` 在抓取新文章时（feed fetch）入队 `JOB_AI_TRANSLATE_TITLE` → 执行 `translateTitle(...)`

## 方案选择

采用「公共 OpenAI client 工厂」方案：

- 新增 `src/server/ai/openaiClient.ts`：
  - `normalizeBaseUrl(value: string): string`：仅去掉末尾 `/`
  - `createOpenAIClient({ apiBaseUrl, apiKey })`：返回 `new OpenAI({ apiKey, baseURL })`
- 各 AI 函数中不再直接调用 `fetch`，而是调用 SDK：
  - `client.chat.completions.create({ model, temperature, messages })`

理由：

- 避免重复实现 baseURL normalize / client 初始化；
- 后续如果需要统一加 headers / telemetry / timeout 等，有集中入口；
- 改动范围小，且符合“不要使用 fetch 构建”的要求。

## 关键设计细节

### 1) `apiBaseUrl` 处理（保持现有语义）

- 仅做末尾 `/` 去除（例如 `https://api.openai.com/v1/` → `https://api.openai.com/v1`）。
- 不校验是否包含 `/v1`，也不自动补全。
- 最终请求由 SDK 生成，目标路径仍为：`<apiBaseUrl>/chat/completions`。

### 2) 错误处理

- OpenAI SDK 抛出的错误直接向上抛出（不做 `status + body` 拼接包装）。
- 仍保留“返回内容不符合预期”的校验错误：
  - `choices[0].message.content` 缺失/非字符串/空字符串；
  - 双语批量翻译返回不是合法 JSON 数组，或长度不一致，或元素不是字符串；
  - 双语重建输出为空等。

### 3) 重试策略

- OpenAI SDK：使用默认重试策略（不显式设置 `maxRetries`）。
- pg-boss job：不使用 pg-boss 重试机制：
  - AI 摘要与正文翻译入队显式设置 `retryLimit: 0`（移除 `retryDelay`）；
  - 标题翻译入队显式设置 `retryLimit: 0`（移除 `retryDelay/retryBackoff`）；
  - 失败时不会由 pg-boss 自动重试，用户可通过重新触发 API（摘要/正文翻译）再次入队；标题翻译为自动流程，失败将记录到文章字段中用于排查。

### 4) `ai-summary` 的 `fulltext_pending` 路由拦截

当前 worker 在 `JOB_AI_SUMMARIZE` 中会在以下场景 `throw new Error('Fulltext pending')`：

- `fullTextOnOpenEnabled === true`
- 且 `article.contentFullHtml` 为空、`article.contentFullError` 为空

由于 pg-boss 不重试，为避免产生无意义的失败 job，路由侧增加同等判断：

- 在 `src/app/api/articles/[id]/ai-summary/route.ts` 中读取 `getFeedFullTextOnOpenEnabled(pool, article.feedId)`；
- 若处于 pending 状态，返回 `ok({ enqueued: false, reason: 'fulltext_pending' })`，不入队。

## 影响范围（文件级）

### 新增

- `src/server/ai/openaiClient.ts`：OpenAI SDK client 工厂与 baseURL normalize。

### 修改（SDK 迁移）

- `src/server/ai/summarizeText.ts`
- `src/server/ai/translateHtml.ts`
- `src/server/ai/translateTitle.ts`
- `src/server/ai/bilingualHtmlTranslator.ts`

### 修改（pg-boss 入队不重试 + fulltext gating）

- `src/app/api/articles/[id]/ai-summary/route.ts`：新增 `fulltext_pending` 拦截；移除入队重试参数
- `src/app/api/articles/[id]/ai-translate/route.ts`：移除入队重试参数
- `src/worker/index.ts`：标题翻译入队移除重试参数

### 测试调整

- `src/server/ai/*.test.ts`：
  - 继续通过 `vi.stubGlobal('fetch', ...)` stub OpenAI SDK 的底层请求；
  - 断言从“精确 URL + method”调整为更稳健的断言（兼容 SDK 传入 `Request` 的形式），并继续验证请求最终落到 `.../chat/completions`。
- `src/app/api/articles/routes.test.ts`：
  - 更新对 `enqueueMock` 参数的断言（不再包含 `retryLimit/retryDelay`）；
  - 为 `ai-summary` 新增/更新 `fulltext_pending` 场景测试。

## 依赖变更

- `package.json`：添加 `openai` 到 `dependencies`。

## 验收标准（Acceptance Criteria）

- `src/server/ai/*` 中不再出现 `fetch(`${baseUrl}/chat/completions`...)` 这类手写拼接实现。
- `pnpm run test:unit` 通过。
- `ai-summary` 在全文未就绪时返回 `reason: 'fulltext_pending'`，且不入队。
- 现有摘要/翻译功能在配置 `apiBaseUrl`（包含或不包含末尾 `/`）时行为与此前一致。

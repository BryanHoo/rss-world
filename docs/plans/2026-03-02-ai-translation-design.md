# AI 翻译功能设计（正文原文/译文切换，固定翻译中文）

日期：2026-03-02  
状态：已评审通过（待实施计划）

## 1. 背景与目标

目前仅支持 AI 摘要（`/api/articles/:id/ai-summary` 入队，`src/worker/index.ts` 消费并写回 `articles.ai_summary`）。文章页已存在“翻译”按钮，但未接入任何后端/队列/存储。

目标：实现文章正文 AI 翻译为中文（`zh-CN`），并满足：

- 交互：正文支持“原文/译文”一键切换
- 标题：保持原文，不随切换翻译
- 持久化：翻译结果落库缓存，跨设备可复用
- 全文优先：若 feed 开启 `fullTextOnOpenEnabled` 且全文尚未抓取完成，则翻译需等待全文完成后再执行
- 保留结构：尽量保留原文 HTML 的排版、链接、图片等结构

## 2. 方案选择

已选择方案：模型输入文章 HTML，输出中文 HTML（整体翻译后回写）。

原因：

- 实现与现有 AI 摘要的“入队 + worker 写回”链路一致
- 可最大程度保留段落语境（相对逐节点翻译更自然）
- 通过二次 `sanitizeContent` 控制输出安全与标签白名单

风险与约束：

- 模型可能改动结构/属性；需通过 prompt 强约束，并对输出二次清洗与校验
- 长文可能超长；需做分块策略与重试兜底

## 3. 数据模型设计

### 3.1 数据库（`articles`）

新增迁移（例如：`src/server/db/migrations/0009_article_ai_translation.sql`）：

- `ai_translation_zh_html text null`
- `ai_translation_model text null`
- `ai_translated_at timestamptz null`

### 3.2 Repository（`articlesRepo`）

`getArticleById` 与 `ArticleRow` 增加字段：

- `aiTranslationZhHtml: string | null`
- `aiTranslationModel: string | null`
- `aiTranslatedAt: string | null`

新增写回方法：

- `setArticleAiTranslationZh(pool, id, { aiTranslationZhHtml, aiTranslationModel })`

## 4. 队列与 Worker

### 4.1 Job 定义

在 `src/server/queue/jobs.ts` 新增：

- `JOB_AI_TRANSLATE = 'ai.translate_article_zh'`

### 4.2 Worker 消费逻辑（`src/worker/index.ts`）

- `createQueue(JOB_AI_TRANSLATE)` 并 `boss.work(JOB_AI_TRANSLATE, ...)`
- 处理规则：
  - 若文章已存在 `ai_translation_zh_html`，跳过
  - 若缺少 `ai_api_key`，跳过
  - 若 `fullTextOnOpenEnabled === true` 且 `contentFullHtml` 为空且 `contentFullError` 为空：`throw new Error('Fulltext pending')`（依赖 job retry 延后执行）
  - 翻译源优先 `contentFullHtml`，否则 `contentHtml`；均为空则跳过
  - 读取 UI settings：复用 `persistedSettings.ai.model` / `persistedSettings.ai.apiBaseUrl`（与 AI 摘要一致）
  - 调用 `translateHtml(...)` 得到中文 HTML
  - 对输出再跑 `sanitizeContent(translated, { baseUrl })`，为空则视为失败并抛错
  - 落库：`setArticleAiTranslationZh(...)`

## 5. API 设计

新增路由：`POST /api/articles/:id/ai-translate`（例如：`src/app/api/articles/[id]/ai-translate/route.ts`）

行为对齐 `/ai-summary`：

- params 校验失败：`validation_error`
- 文章不存在：`not_found`
- 缺少 API Key：`{ enqueued: false, reason: 'missing_api_key' }`
- 全文 pending：`{ enqueued: false, reason: 'fulltext_pending' }`
- 已翻译：`{ enqueued: false, reason: 'already_translated' }`
- 否则入队：`enqueue(JOB_AI_TRANSLATE, { articleId }, { singletonKey: articleId, singletonSeconds: 600, retryLimit: 8, retryDelay: 30 })`
- 已入队：`{ enqueued: false, reason: 'already_enqueued' }`（复用现有 enqueue 失败约定）

## 6. 前端交互与数据流

### 6.1 客户端 API

在 `src/lib/apiClient.ts` 新增：

- `enqueueArticleAiTranslate(articleId)`

### 6.2 DTO/映射/Store

- `ArticleDto` 增加 `aiTranslationZhHtml/aiTranslationModel/aiTranslatedAt`
- 前端 `Article` 增加 `aiTranslationZhHtml?: string`
- `mapArticleDto` 映射该字段
- `refreshArticle` 返回值增加 `hasAiTranslation`，用于轮询停止条件

### 6.3 ArticleView（`src/features/articles/ArticleView.tsx`）

- 按钮：
  - 原文视图：显示 `翻译`
  - 译文视图：显示 `原文`
- 首次翻译：
  - 调用 `enqueueArticleAiTranslate`
  - 对 `missing_api_key` / `fulltext_pending` / `already_translated` / `already_enqueued` 分别提示与处理
  - 入队后轮询 `refreshArticle` 直到 `hasAiTranslation === true` 或超时
- `fulltext_pending`：
  - 等待 `hasFulltext || hasFulltextError` 后自动重试一次入队

正文渲染：

- 原文：`article.content`
- 译文：`article.aiTranslationZhHtml`

## 7. LLM Prompt 与输出校验

新增 `src/server/ai/translateHtml.ts`：

- 调用 `${apiBaseUrl}/chat/completions`
- `temperature: 0.2`
- `system` prompt 强约束：
  - 目标语言中文（`zh-CN`）
  - 只翻译可见文本
  - 保持 HTML 结构不变
  - 严禁改动 URL/属性值（尤其 `href/src/srcset`）
  - 只输出 HTML 字符串，不要解释文字/代码块
- 响应解析：要求 `choices[0].message.content` 为非空字符串，否则抛错

## 8. 兼容、错误处理与非目标

- 翻译按钮不接入 `persistedSettings.ai.translateEnabled` 开关（本次始终可用）
- 长文处理：设置 `MAX_TRANSLATION_SOURCE_LENGTH`；超长时按 HTML 分块翻译并拼接，失败交由 job retry
- 失败提示：缺 key / 等待全文 / 翻译中 / 超时可重试

本次不做：

- 目标语言选择（固定 `zh-CN`）
- 翻译标题

## 9. 测试设计

- `src/server/ai/translateHtml.test.ts`：响应解析、缺字段异常
- `src/app/api/articles/routes.test.ts`：覆盖 `POST /:id/ai-translate`（not_found、missing_api_key、already_translated、fulltext_pending、enqueued）
- `src/features/articles/ArticleView.*.test.tsx`：
  - 原文/译文切换按钮文案与渲染
  - 翻译中状态与轮询结束
  - 全文 pending 时禁用/等待逻辑

## 10. 验收标准

满足以下即视为完成：

1. 点击“翻译”可生成并展示中文译文，且可在“原文/译文”间切换
2. 译文落库缓存，刷新页面或跨设备仍可直接查看
3. 开启全文抓取时，翻译会等待全文完成后再执行
4. 缺少 API Key、超时等失败场景可被正确提示并允许重试
5. 新增与变更测试通过


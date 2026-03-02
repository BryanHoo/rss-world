# AI 文章翻译（zh-CN）设计

## 1. 用户体验（UX）

- 文章页操作区保留按钮位：`翻译` / `原文`
- 初始为原文视图
- 点击 `翻译`：
  - 已有译文：直接切到译文视图，按钮显示 `原文`
  - 无译文：调用 `POST /api/articles/:id/ai-translate` 入队并进入“翻译中”状态；轮询 `refreshArticle()` 直到译文落库后自动切换
- 若 `fullTextOnOpenEnabled` 且当前文章全文仍 pending：
  - 翻译按钮禁用并提示“全文抓取中”（直到全文完成或失败）
  - API 也会返回 `reason: fulltext_pending` 作为兜底
- 缺少 AI Key：提示“请先在设置中配置 AI API Key”
- 翻译轮询超时：提示“翻译超时，请稍后重试”

## 2. 数据模型

### 2.1 数据库（`articles`）

新增列：

- `ai_translation_zh_html text null`
- `ai_translation_model text null`
- `ai_translated_at timestamptz null`

### 2.2 Repository（`articlesRepo`）

- `getArticleById()` 查询返回上述字段
- 新增 `setArticleAiTranslationZh(...)` 写回译文与模型名，并写入 `ai_translated_at = now()`

## 3. API

### 3.1 `POST /api/articles/:id/ai-translate`

返回：

- `missing_api_key`
- `fulltext_pending`
- `already_translated`
- `already_enqueued`
- `enqueued: true`（包含 `jobId`）

入队参数：

- `enqueue(JOB_AI_TRANSLATE, { articleId }, { singletonKey: articleId, singletonSeconds: 600, retryLimit: 8, retryDelay: 30 })`

## 4. 队列与 Worker

### 4.1 Job 名称

- `JOB_AI_TRANSLATE = 'ai.translate_article_zh'`

### 4.2 消费规则（worker）

- 若已翻译：跳过
- 若缺少 key：跳过
- 若需要等待全文：`throw new Error('Fulltext pending')` 触发 job retry
- 翻译源：优先 `contentFullHtml`，否则 `contentHtml`
- 翻译结果二次 `sanitizeContent`，为空则视为失败并抛错
- 写回 DB

## 5. LLM 调用与安全

新增 `translateHtml(...)`：

- 调用 `${apiBaseUrl}/chat/completions`
- `temperature: 0.2`
- `system` prompt 强约束：
  - 目标语言 `zh-CN`
  - 只翻译可见文本
  - 保持 HTML 结构不变
  - 严禁改动任何 URL/属性值（尤其 `href/src/srcset`）
  - 只输出 HTML 字符串（不含解释文字/代码块）

输出处理：

- 解析 `choices[0].message.content` 必须是非空字符串
- 对输出运行 `sanitizeContent(translated, { baseUrl })`

## 6. 长文策略

- 设定 `MAX_TRANSLATION_SOURCE_LENGTH`
- 超长时按 HTML chunk 分块翻译并拼接（优先按顶层节点聚合，确保每块是有效 HTML 片段）


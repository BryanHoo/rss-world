# 翻译功能重构设计（标题自动翻译 + 正文沉浸式双语）

- 日期：2026-03-03
- 状态：已评审（用户确认）
- 适用范围：RSS 源配置、全局 AI 配置、文章翻译流水线、阅读器渲染

## 1. 背景与目标

当前系统只有一类正文翻译能力，且路径偏向“整段 HTML 翻译”。本次重构目标：

1. 在 RSS 源配置中拆分两个翻译能力：
   - `titleTranslateEnabled`：列表标题自动翻译
   - `bodyTranslateEnabled`：正文翻译能力开关
2. 在全局 AI 中为翻译提供独立配置：
   - 可选择“与 AI 共用”
   - 也可配置独立 `apiBaseUrl/model/apiKey`
3. 正文翻译采用“提取可见文本段 -> 分段翻译 -> DOM 回填”的方式，禁止把整段 HTML 直接送模型。
4. 阅读体验升级为沉浸式双语：
   - 文章标题：上原文，下译文
   - 正文段落：上原文，下译文

## 2. 约束与已确认决策

以下为本轮讨论中已确认的产品决策：

1. 触发策略：`标题翻译`自动执行；`正文翻译`保持手动点击触发。
2. 标题展示：默认显示翻译标题，原始标题保留用于回退。
3. 翻译配置：默认“与 AI 共用”；用户可切换为独立翻译配置。
4. 历史数据：开启标题翻译后仅影响新抓取文章，不回填历史。
5. 正文开关关闭时：详情页翻译按钮禁用/不可触发。
6. 正文翻译输入源：`contentFullHtml` 优先，没有则使用 `contentHtml`。
7. 沉浸式正文规则：
   - 翻译 `p/li/h1-h6/blockquote/td/th` 等可见文本块
   - `code/pre` 保持原文
8. 标题在详情页翻译态：上原文、下译文。
9. 按钮文案保留 `翻译/原文`，其中“翻译”态实际展示双语。
10. 标题自动翻译失败采用重试：最多 3 次指数退避。

## 3. 方案评估与选型

本次评估了 3 个方案：

1. A1 实时翻译不落库：成本高、结果不稳定，不选。
2. A2 异步落库双语结果：稳定且可复用，选用。
3. A3 段落翻译记忆库：复杂度高，超出当前需求，不选。

最终选型：**A2 异步落库双语结果**。

## 4. 目标架构（高层）

### 4.1 配置层

1. `feeds` 新增源级翻译开关：
   - `title_translate_enabled boolean not null default false`
   - `body_translate_enabled boolean not null default false`
2. `ui_settings.ai` 新增翻译配置命名空间（前端持久化结构）：
   - `translation.useSharedAi: boolean`（默认 `true`）
   - `translation.model: string`
   - `translation.apiBaseUrl: string`
3. `app_settings` 新增翻译独立 API key（服务端安全存储）：
   - `translation_api_key text not null default ''`

### 4.2 数据层

`articles` 新增标题翻译与双语正文字段：

1. 标题翻译：
   - `title_original text not null default ''`
   - `title_zh text null`
   - `title_translation_model text null`
   - `title_translation_attempts int not null default 0`
   - `title_translation_error text null`
   - `title_translated_at timestamptz null`
2. 正文双语：
   - `ai_translation_bilingual_html text null`
   - （可选）`ai_translation_segments_json jsonb null`（用于调试和回放）

兼容期内保留 `ai_translation_zh_html` 读取能力，逐步迁移到 `ai_translation_bilingual_html`。

### 4.3 任务层

新增两个队列任务：

1. `ai.translate_title_zh`
2. `ai.translate_article_bilingual`

两者均使用 `singletonKey = articleId` 避免并发重复执行。

## 5. 核心流程设计

### 5.1 标题自动翻译流程（抓取后）

1. `feed.fetch` 入库新文章时：
   - `title_original = parsed title`
   - 兼容期 `title = title_original`
2. 若 feed 的 `titleTranslateEnabled=true`，enqueue `ai.translate_title_zh`。
3. worker 拉取翻译配置（共享或独立）执行翻译。
4. 成功写入：
   - `title_zh`
   - `title_translation_model`
   - `title_translated_at`
   - 清空 `title_translation_error`
5. 失败重试：
   - 最多 3 次
   - 指数退避建议：15s -> 60s -> 300s
   - 最终失败记录 `title_translation_error`

### 5.2 正文沉浸式翻译流程（手动触发）

1. 用户点击 `翻译` 按钮触发 `/api/articles/:id/ai-translate`。
2. 若 `bodyTranslateEnabled=false`：
   - 返回 `reason: body_translate_disabled`
   - 前端按钮保持禁用态。
3. worker 读取正文源：
   - 优先 `contentFullHtml`
   - 其次 `contentHtml`
4. 进行 DOM 级处理：
   - sanitize -> parse
   - 提取可翻译块（排除 `code/pre`）
   - 生成稳定 `segmentId`
5. 分批将“纯文本段数组”送模型翻译（非整段 HTML）。
6. 回填 DOM 形成双语块结构：
   - 每块“上原下译”
7. 输出并二次 sanitize 后落库 `ai_translation_bilingual_html`。

## 6. DOM 提取与回填规则

### 6.1 可翻译节点

1. 段落类：`p`
2. 列表类：`li`
3. 标题类：`h1-h6`
4. 引用：`blockquote`
5. 表格文本：`td/th`

### 6.2 保持原文节点

1. `code`
2. `pre`

### 6.3 回填结构（示意）

```html
<div class="ff-bilingual-block" data-segment-id="seg-001">
  <p class="ff-original">Original paragraph...</p>
  <p class="ff-translation">翻译后的段落...</p>
</div>
```

注意：严禁改动 `href/src/srcset` 等属性与 URL，模型仅处理文本内容。

## 7. 前后端改动点

### 7.1 后端 API 与 Repository

1. `feeds`：
   - `createFeed/updateFeed/listFeeds` 增加 `titleTranslateEnabled/bodyTranslateEnabled`
   - `/api/feeds` 与 `/api/feeds/:id` schema 同步扩展
2. `articles`：
   - `insertArticleIgnoreDuplicate` 写入 `title_original`
   - `getArticleById` 返回 `titleOriginal/titleZh/aiTranslationBilingualHtml`
3. `/api/articles/:id/ai-translate`：
   - 增加 `body_translate_disabled` 分支
   - 优先判断 `ai_translation_bilingual_html` 的已翻译状态

### 7.2 前端 Store 与 DTO

1. `Feed` 类型增加：
   - `titleTranslateEnabled`
   - `bodyTranslateEnabled`
2. `Article` 类型增加：
   - `titleOriginal`
   - `titleZh`
   - `aiTranslationBilingualHtml`
3. 列表标题取值：
   - `displayTitle = titleZh ?? titleOriginal ?? title`

### 7.3 UI 交互

1. `FeedDialog` 增加两项开关（标题自动翻译、正文翻译）。
2. `AISettingsPanel` 增加翻译配置分组，支持共享或独立。
3. `ArticleView`：
   - 按钮文案保持 `翻译/原文`
   - 翻译态渲染 `aiTranslationBilingualHtml`
   - 标题翻译态显示“上原下译”

## 8. 错误处理与可观测性

1. 可恢复错误（超时/429/5xx）进入重试。
2. 不可恢复错误（配置缺失/数据异常）直接失败并记录错误原因。
3. 结构化日志字段建议：
   - `job`, `articleId`, `feedId`, `attempt`, `batchIndex`, `segmentCount`, `latencyMs`, `model`, `errorCode`
4. 指标建议：
   - 标题/正文翻译成功率
   - 平均翻译耗时
   - 常见失败原因分布

## 9. 测试策略

1. 单元测试：
   - DOM 段落提取与 `segmentId` 稳定性
   - 分批切片边界
   - 翻译配置解析（共享/独立）
2. API/Repository 测试：
   - feed 新字段读写
   - article 新字段映射
   - `body_translate_disabled` 行为
3. UI 测试：
   - 按钮文案仍为 `翻译/原文`
   - 翻译态显示双语块
   - 源开关关闭时按钮禁用
4. 回归测试：
   - AI 摘要流程不受影响
   - Fulltext gating 行为保持一致

## 10. 迁移与发布建议

1. 先发 DB migration（向后兼容，不删除旧列）。
2. 再发后端读取新旧字段兼容逻辑。
3. 最后发前端双语渲染与新配置 UI。
4. 观察期确认稳定后，再考虑清理旧字段 `ai_translation_zh_html` 的写路径。

## 11. 非目标（本次不做）

1. 历史文章批量回填翻译。
2. 段落翻译跨文章缓存命中系统。
3. 多语言目标翻译（仅 `zh-CN`）。


# RSS 全文抓取（按需 + 可配置开关）设计

日期：2026-02-26  
状态：已确认（Approved）

## TL;DR

- 新增“全文抓取”能力：当用户打开文章时，后台抓取 `article.link` 的网页并抽取正文。
- 通过 UI 设置项全局开关启用（默认关闭），配置存入 `app_settings.ui_settings`（即 `/api/settings`）。
- 全文结果**单独存储**到新字段（不覆盖 `articles.content_html`），前端异步轮询刷新显示。
- 抽取实现选用 `@mozilla/readability` + `jsdom`，抽取结果统一走 `sanitizeContent` 清洗与 URL 规范化。

## 背景

当前抓取链路只使用 RSS/Atom feed 内的 `content` / `content:encoded` 作为文章正文，导致很多订阅源仅提供摘要或截断内容时无法在阅读器中直接阅读全文。

当前存储与展示链路：

- worker：`src/worker/index.ts` → `fetchFeedXml` → `parseFeed` → `sanitizeContent` → 写入 `articles.content_html`
- 前端：打开文章后 `GET /api/articles/:id`，渲染 `content_html`（映射为 `article.content`）

## 目标

- 提供“抓取全文”的能力，并以**配置项**控制是否启用（全局开关）。
- 触发时机：**按需**（用户打开文章时触发），不在入库抓取阶段额外请求网页。
- 展示策略：**异步**（先显示 RSS 正文/摘要，后台抽取完成后自动刷新为全文）。
- 存储策略：新增字段保存全文结果，保留原有 `content_html` 不变。
- 安全基线不降低：新增网页抓取仍需要 SSRF 防护与 HTML 清洗。

## 非目标

- 不实现 headless 浏览器渲染（不保证 SPA/强 JS 站点可抽取）。
- 不做资源代理/转存（图片仍由浏览器直连原站加载）。
- 不做登录/付费墙绕过与 Cookie 会话抓取。

## 用户体验（UX）

当开启“打开文章时抓取全文”后：

1) 用户点开文章：立即展示当前 `content_html`（RSS 正文/摘要）。  
2) 前端同时触发 `POST /api/articles/:id/fulltext` 请求后台抓取全文。  
3) 前端以短轮询方式刷新 `GET /api/articles/:id`，当返回出现 `contentFullHtml` 后切换展示为全文。  
4) 若抓取失败：继续展示 RSS 正文，并可在开发日志/错误字段中看到原因（本期可不在 UI 显示失败原因，后续再补）。

## 配置设计（全局开关）

- 新增设置项：`persistedSettings.rss.fullTextOnOpenEnabled: boolean`
  - 默认值：`false`
  - 存储位置：`app_settings.ui_settings`（通过 `/api/settings` 读写）
- 设置 UI：放在现有“外观/阅读体验”设置面板中（避免新增 tab），文案示例：
  - 标题：`打开文章时抓取全文`
  - 说明：`开启后会访问文章原文链接并尝试抽取正文，可能稍慢。`

## 数据库与模型

在 `articles` 表新增字段（migration）：

- `content_full_html text null`：抽取后的全文 HTML（已 sanitize）
- `content_full_fetched_at timestamptz null`：全文成功写入时间
- `content_full_error text null`：失败原因（用于调试与退避）
- `content_full_source_url text null`：最终抓取 URL（用于 redirect 后的可追溯性）

说明：

- 保持现有 `content_html`：仍保存 RSS feed 内的正文/摘要清洗结果。
- 写入 `content_full_html` 后，阅读页优先展示 `content_full_html`。

## API 设计

### `GET /api/articles/:id`

返回在现有字段基础上增加：

- `contentFullHtml: string | null`
- `contentFullFetchedAt: string | null`
- `contentFullError: string | null`
- `contentFullSourceUrl: string | null`

前端展示逻辑：

- `article.content = contentFullHtml ?? contentHtml ?? ''`

### `POST /api/articles/:id/fulltext`

用途：按需触发全文抓取任务，返回是否入队。

行为：

- 若全局开关 `persistedSettings.rss.fullTextOnOpenEnabled` 未开启：返回 `{ enqueued: false }`
- 若文章无 `link`：返回 `{ enqueued: false }`
- 若 `content_full_html` 已存在：返回 `{ enqueued: false }`
- 否则：enqueue `article.fetch_fulltext`，返回 `{ enqueued: true, jobId }`

去重策略：

- 使用 `pg-boss` 的 singleton（例如 `singletonKey = articleId`）防止同一文章重复入队（即便多次打开/轮询）。

## 队列与 worker 设计

新增 job：

- `JOB_ARTICLE_FULLTEXT_FETCH = 'article.fetch_fulltext'`
- payload：`{ articleId: string }`

worker 处理流程：

1) 读取文章：按 `articleId` 查询 DB，取 `link` 与已有 `content_full_*` 字段  
2) 安全校验：
   - 对 `link` 调用 `isSafeExternalUrl(link)`，不安全则写入 `content_full_error` 并退出
3) 抓取网页 HTML：
   - `fetch(link, { redirect: 'follow', signal: AbortController(timeout) })`
   - headers：
     - `accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8`
     - `user-agent: app_settings.rss_user_agent`
   - 若最终 `res.url` 与原链接不同：对 `res.url` 再做一次 `isSafeExternalUrl` 校验
   - 仅接受 2xx；Content-Type 非 HTML 时视为失败（写 error）
   - 限制最大响应体大小（例如 2MB），防止内存压力
4) 抽取正文：
   - `jsdom` 构造 DOM
   - `new Readability(document).parse()` 得到 `{ content, title, ... }`
   - 若抽取失败/为空：写入 `content_full_error`
5) 清洗与落库：
   - `sanitizeContent(readability.content, { baseUrl: res.url })`
   - `update articles set content_full_html = ..., content_full_fetched_at = now(), content_full_error = null, content_full_source_url = res.url`

重试与退避：

- 失败会写入 `content_full_error`，并在 enqueue 入口对“近期失败”进行简单退避（例如 10 分钟内不重复入队），避免每次打开都打爆源站。

## 安全与合规

- SSRF：复用 `src/server/rss/ssrfGuard.ts` 的 `isSafeExternalUrl`
- XSS：抽取结果统一走 `sanitizeContent`，并继续由 allowlist 控制可用标签与属性
- 不引入跨域绕过：图片/链接依然由浏览器按正常跨域规则加载

## 测试策略

- 单元测试：
  - 给全文抽取函数提供 HTML fixture，验证能抽取出主要正文节点
  - 验证抽取后内容经过 `sanitizeContent` 后仍满足安全基线（不含脚本、事件属性等）
- API route tests：
  - `POST /api/articles/:id/fulltext`：开关关闭/无 link/已存在全文/正常入队 等分支
- worker：
  - mock `fetch` 返回固定 HTML，验证能写入 `content_full_html` 与元信息

## 影响范围

- DB：新增 migration（`articles` 增加 `content_full_*` 字段）
- 后端：
  - `src/app/api/articles/[id]/route.ts`（扩展返回字段）
  - 新增 `src/app/api/articles/[id]/fulltext/route.ts`（触发入队）
  - `src/server/repositories/articlesRepo.ts`（读写全文字段）
  - `src/server/queue/jobs.ts`（新增 job 常量）
  - `src/worker/index.ts`（新增 job worker：全文抓取与抽取）
  - 新增全文抽取模块（封装 `Readability` + `jsdom`）
- 前端：
  - `src/features/settings/panels/AppearanceSettingsPanel.tsx`（增加开关）
  - `src/features/articles/ArticleView.tsx` + `src/store/appStore.ts`（打开文章触发入队与轮询刷新）
  - 类型：扩展 `PersistedSettings` 与 `ArticleDto` 映射

## 回滚方案

- 开关默认关闭，线上可不启用。
- 回滚仅需移除相关路由/worker 与忽略 DB 新字段，不影响既有 RSS 抓取与阅读体验。


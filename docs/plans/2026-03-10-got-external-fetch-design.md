# 使用 got 统一服务端 RSS/Fulltext/Image 抓取设计

- 日期：2026-03-10
- 状态：已确认
- 需求：使用 `got` 替换服务端对外站点的抓取实现，覆盖 RSS/Fulltext/Image 三类；统一超时、重定向、响应大小限制与错误处理；浏览器侧内部 `/api/**` 请求（`src/lib/apiClient.ts` / `ky`）不在本次范围。

## 背景

项目当前存在两类网络请求：

- 浏览器侧请求内部 Next.js API（`/api/**`）：已通过 `src/lib/apiClient.ts` 统一（底层为 `ky`）。
- 服务端/Route Handler 请求外部站点（RSS/Atom、全文 HTML、图片代理等）：当前仍直接使用 Node 的 `fetch`，实现分散在多个模块。

截至 2026-03-10，本次替换范围内的入口为：

- RSS 拉取：`src/server/rss/fetchFeedXml.ts`
- RSS 校验：`src/app/api/rss/validate/route.ts`
- 全文抓取：`src/server/fulltext/fetchFulltextAndStore.ts`
- 图片代理：`src/app/api/media/image/route.ts`

现状关键点：

- RSS 拉取与校验使用 `redirect: 'follow'`，且使用 `AbortController` 实现超时。
- 全文抓取对 HTML 有大小限制（`MAX_HTML_BYTES`）与 `Readability` 提取，并使用 `rssTimeoutMs/rssUserAgent` 配置。
- 图片代理是最严格的：手动处理重定向（`redirect: 'manual'`）并在每一跳调用 `isSafeMediaUrl()`，且对响应大小做限制（`MAX_BYTES`）。
- SSRF guard 在不同场景使用不同策略：
  - RSS/Fulltext 使用 `isSafeExternalUrl()`（允许 `localhost` / `127.0.0.1`，用于本地/容器联调）
  - Image 使用 `isSafeMediaUrl()`（仅允许公网 IP / 域名解析为公网 IP）

## 目标

- 将服务端对外抓取统一迁移为 `got`，减少散落的请求配置与实现差异。
- 在不改变既有业务语义的前提下，统一：
  - 超时实现与超时错误归一
  - 默认重试策略（默认不重试）
  - 重定向处理策略（按场景差异化）
  - 响应体大小限制（HTML 与 Image）
- 让调用点更聚焦业务逻辑（解析、入库、图片变换、错误码映射），网络实现细节集中到一处，提升可测试性与可维护性。

## 非目标

- 不替换浏览器侧内部 `/api/**` 请求的 `ky` 方案与 `src/lib/apiClient.ts`。
- 不改变 `isSafeExternalUrl()` / `isSafeMediaUrl()` 的判定规则。
- 不引入全局强制“最终跳转 URL 复检 SSRF”的行为（为兼容现有源站跳转链路，本设计明确不新增这一强制校验）。
- 不在本设计阶段实现代码改动（实现与测试在后续 Implementation Plan 中展开）。

## 备选方案

### 方案 A：最薄封装 `externalRequest()`（不推荐）

仅统一 `got` 发请求，仍在各入口散落处理 redirect/maxBytes/headers/错误映射。

缺点：重复逻辑难以消除，长期一致性差，测试仍易耦合底层请求细节。

### 方案 B：按场景提供 3 个抓取函数（推荐）

在 `src/server/http/externalHttpClient.ts` 内部创建共享 `got` instance，并导出 3 个“场景函数”：

- `fetchRssXml(...)`
- `fetchHtml(...)`
- `fetchImageBytes(...)`

调用点仅表达“要抓什么”，不再关心 `got` 配置与低层细节。

### 方案 C：`ExternalHttpClient` 类 + 依赖注入（不采用）

抽象更强，但对当前规模偏重，引入样板代码与测试复杂度，不利于本次快速、可控的迁移。

## 推荐方案

采用方案 B：新增 `src/server/http/externalHttpClient.ts`，按场景封装 3 个抓取函数，并逐步迁移四个入口点。

理由：

- 封装粒度足够消除重复代码，同时不把 RSS/HTML/Image 的差异强行统一到同一套参数里。
- 调用点改动清晰、风险可控，测试可通过 mock 场景函数避免耦合 `got` 内部行为。

## 已确认设计

### 模块与职责边界

- 新增模块：`src/server/http/externalHttpClient.ts`
  - 负责：对外 HTTP 抓取的统一实现（`got`、超时、重定向策略、响应体读取与大小限制、公共 headers 合并、错误归一）。
  - 不负责：业务层语义（RSS 解析、全文提取、图片变换、入库、API response 结构与错误码映射）。

### got 默认配置

在 `src/server/http/externalHttpClient.ts` 内创建共享 `got` instance（不导出）：

- `retry: { limit: 0 }`：禁用默认重试，避免引入行为变化。
- `throwHttpErrors: false`：让非 2xx 行为更接近 `fetch`，由上层按场景处理 status。
- `followRedirect`：不做全局默认，由场景函数显式设置：
  - RSS/XML 与 HTML：`followRedirect: true`
  - Image：`followRedirect: false`（手动跟随并每跳校验 `isSafeMediaUrl()`）
- `timeout`：统一使用 `AbortController + setTimeout` 实现（便于稳定映射超时错误，并与现有实现一致）。
- headers：不在 instance 上固化 `user-agent`，由场景函数按需设置（避免不同场景互相污染）。

### 场景函数契约

#### `fetchRssXml(url, options)`

用途：RSS/Atom XML 拉取，替代下列入口的请求部分：

- `src/server/rss/fetchFeedXml.ts`
- `src/app/api/rss/validate/route.ts`

输入（示意）：

- `url: string`
- `options: { timeoutMs: number; userAgent: string; etag?: string | null; lastModified?: string | null }`

行为：

- 复用 `getFetchUrlCandidates(url)` 的候选顺序（支持 `localhost`/容器联调 fallback）。
- `GET` + `accept: application/rss+xml, application/atom+xml, application/xml, text/xml, */*`
- `followRedirect: true`
- 返回：
  - `status: number`
  - `xml: string | null`（当 `status === 304` 时为 `null`）
  - `etag: string | null`
  - `lastModified: string | null`
  - `finalUrl: string`（用于调试或上层需要时记录）

约束：

- 不新增“最终跳转 URL 再跑 `isSafeExternalUrl()`”的强制复检（保持现状兼容性）。

#### `fetchHtml(url, options)`

用途：全文抓取 HTML，替代 `src/server/fulltext/fetchFulltextAndStore.ts` 的请求与读取逻辑。

输入（示意）：

- `url: string`
- `options: { timeoutMs: number; userAgent: string; maxBytes: number; headers?: Record<string, string> }`

行为：

- `GET` + 默认 `accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8`
- `followRedirect: true`
- 以“流式累计字节数”的方式读取响应体，超过 `maxBytes` 立即中止并报错（语义对齐现有 `MAX_HTML_BYTES`）。
- 返回：
  - `status: number`
  - `finalUrl: string`
  - `contentType: string | null`
  - `html: string`

说明：

- 是否为 HTML 的 content-type 校验仍由 `fetchFulltextAndStore` 负责，以避免网络层与业务层耦合。

#### `fetchImageBytes(url, options)`

用途：图片代理拉取 upstream，替代 `src/app/api/media/image/route.ts` 中的 upstream 请求部分。

输入（示意）：

- `url: string`
- `options: { maxRedirects: number; maxBytes: number; userAgent: string; timeoutMs?: number }`

行为与约束：

- 严格保留现有语义：
  - 手动处理重定向（`followRedirect: false`）
  - `MAX_REDIRECTS` 次数上限
  - 每一跳都调用 `isSafeMediaUrl(nextUrl)` 做安全校验
  - 流式读取并限制 `maxBytes`（语义对齐现有 `MAX_BYTES`）
  - upstream 非 ok 时由 route 继续走 `Response.redirect(url, 307)` 的回源降级
- 返回建议使用可判别 union，避免异常路径让 Route Handler 语义复杂化，例如：
  - `{ kind: 'ok'; status; contentType; cacheControl; bytes }`
  - `{ kind: 'redirect_fallback' }`
  - `{ kind: 'forbidden' | 'bad_gateway' | 'too_many_redirects' | 'unsupported_media_type' | 'too_large' }`

### 迁移范围与触点

迁移完成后，服务端对外抓取的直接 `fetch` 调用应仅存在于统一抓取层（或被完全消除）。本次目标是将以下 4 处的 `fetch(...)` 全部迁移掉：

- `src/server/rss/fetchFeedXml.ts`
- `src/app/api/rss/validate/route.ts`
- `src/server/fulltext/fetchFulltextAndStore.ts`
- `src/app/api/media/image/route.ts`

### 测试策略

- 对 `src/server/http/externalHttpClient.ts`：以单测覆盖场景函数的关键分支：
  - 超时中止、网络错误、响应过大、重定向边界（Image）
  - `etag` / `last-modified` 透传（RSS）
- 对入口模块：保持测试关注“业务 contract”而非 `got` 细节：
  - `fetchFulltextAndStore`：仍验证写库分支与错误映射；通过 mock 场景函数来控制输入
  - Image route：通过 mock `fetchImageBytes` 控制 upstream 分支（ok/redirect_fallback/forbidden/too_large 等）
  - RSS validate route：验证返回的结构化结果映射（valid/invalid/timeout/unauthorized 等）


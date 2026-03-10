# 使用 ky 替换浏览器侧 fetch 设计

- 日期：2026-03-10
- 状态：已确认
- 需求：仅在浏览器侧将内部 `/api/**` 请求从直接使用 `fetch` 迁移到 `ky`，并统一请求配置、错误处理与测试策略

## 背景

项目当前存在两类网络请求：

- 浏览器侧访问内部 Next.js API 路由（`/api/**`）：用于 reader snapshot、订阅源管理、文章任务、设置等。
- 服务端/Route Handler 访问外部站点（RSS/Atom、全文 HTML、图片代理等）：用于抓取与解析第三方内容。

本设计只覆盖第一类（浏览器侧内部 API 请求）。服务端对外部站点的 `fetch`（例如 `src/server/rss/fetchFeedXml.ts`、`src/server/fulltext/fetchFulltextAndStore.ts`、`src/app/api/media/image/route.ts`）不在本次范围内，避免将 HTTP 抓取、SSRF guard、流式读取与重定向处理等复杂度混入前端请求层。

截至 2026-03-10：

- `src/lib/apiClient.ts` 已存在 `requestApi<T>()` 封装，但底层仍直接使用 `fetch`；其 contract 是解析 `{ ok, data|error }` envelope，并在失败时抛出 `ApiError`，可选触发 `notifyApiError()`。
- `src/features/feeds/services/rssValidationService.ts` 仍直接使用 `fetch` 调用 `/api/rss/validate`，并将超时/网络错误映射为表单友好的 `RssValidationResult`。

`docs/summaries/` 当前仅包含与流式摘要 hook 相关的经验记录，未覆盖网络请求层迁移，因此本设计基于现有封装与调用点制定。

## 目标

- 在浏览器侧将内部 `/api/**` 请求统一迁移到 `ky`，提升默认配置一致性与可测试性。
- 保持 `src/lib/apiClient.ts` 作为内部 API 的统一出口：业务层不应散落拼 URL 与自定义 timeout/retry 的实现。
- 统一 envelope 解析与错误映射策略，让 UI 层的错误展示更可控。
- 保留“校验类请求”返回结构化结果（`RssValidationResult`），避免在表单校验中触发全局错误通知。

## 非目标

- 不替换服务端或 Route Handler 对外部站点的 `fetch` 实现。
- 不引入对外部站点请求的全局 retry、缓存或连接池策略。
- 不改变后端返回 envelope 的结构或字段语义。
- 不在本设计阶段实现任何代码改动（实现另行计划）。

## 备选方案

### 方案 1（推荐）：渐进式迁移，保留现有 `ApiError` 与 envelope contract

做法：

- 在 `src/lib/apiClient.ts` 内创建 ky instance（不导出），统一配置 `timeout`、`retry`、默认 headers。
- 将 `requestApi<T>()` 底层从 `fetch` 迁移到 `ky`，但保留：
  - envelope 解析逻辑
  - `ApiError` 抛出语义
  - `notifyOnError` / `notifyMessage` 行为
- 将 RSS 校验迁移为复用同一 ky instance，但仍返回 `RssValidationResult`（不抛 `ApiError`，不触发全局 notify）。

优点：

- 调用方改动最少，迁移风险低。
- 继续支持 UI 层现有的 `instanceof ApiError` 分支与错误映射逻辑。
- 测试可从“断言 fetch 调用细节”转向“断言 contract 行为”，长期更稳定。

缺点：

- 仍采用“失败抛异常”的风格（但对现有代码最兼容）。

### 方案 2：改为 `Result<T>`（不抛异常）

做法：将所有 API 函数返回 `{ ok: true, data } | { ok: false, error }`，业务层显式分支处理错误。

优点：

- 错误处理更显式，UI 更容易控制各类错误提示与重试。

缺点：

- 改动范围大，涉及大量调用点与测试；不适合本次“仅替换 fetch”目标。

### 方案 3：仅迁移 `rssValidationService`，`apiClient` 保持 `fetch`

优点：

- 短期改动最小。

缺点：

- 形成两套请求风格，timeout/retry/错误映射长期漂移，维护成本高。

## 推荐方案

采用方案 1：在浏览器侧将 `src/lib/apiClient.ts` 底层网络实现替换为 `ky`，并将 RSS 校验逻辑统一纳入同一请求层配置，但保留其“返回结构化校验结果”的业务形态。

理由：

- 在不扩大业务层改动的前提下，最大化统一网络层配置与错误处理。
- 迁移路径清晰，可分步落地并通过单测验证 contract。

## 已确认设计

### 范围与入口

- 仅覆盖浏览器侧内部 `/api/**` 请求。
- `src/lib/apiClient.ts` 继续作为内部 API 的统一出口。
- 迁移点包含：
  - `src/lib/apiClient.ts` 内部的 `requestApi<T>()`
  - `src/features/feeds/services/rssValidationService.ts`（迁移后将不再直接使用 `fetch`）

### ky instance 配置

ky instance 定义在 `src/lib/apiClient.ts` 内部（不导出），主要配置：

- `timeout`：默认 15000ms（允许在 `requestApi` options 中覆盖为 `timeoutMs`）。
- `retry`：默认 0，避免对 POST/PATCH/DELETE 产生重复提交风险。
- `throwHttpErrors`：设置为 `false`，由 `requestApi` 统一处理 HTTP 非 2xx 与 envelope 解析，避免 ky 在读取 body 之前抛出 `HTTPError`。
- 默认 headers：`accept: 'application/json'`（保留调用方自定义 headers 的覆盖能力）。

### envelope 解析与错误映射

`requestApi<T>()` 的责任边界：

- 将 path 转为绝对地址（复用现有 `toAbsoluteUrl()`）。
- 解析 JSON 并验证其为 `{ ok: boolean }` 结构。
- 若 `ok: true`，返回 `data`。
- 若 `ok: false`，抛出 `ApiError(message, code, fields)`，并在 `notifyOnError !== false` 时调用 `notifyApiError()`。

额外错误类型映射（来自网络/超时/非 JSON 等）：

- 超时：抛出 `ApiError(code='timeout')` 或等价错误，并使用友好 message（例如“请求超时，请稍后重试”）。
- 网络错误：抛出 `ApiError(code='network_error')` 或等价错误，并使用友好 message。
- 非法响应（JSON 解析失败或非 envelope）：抛出 `ApiError(code='invalid_response')`（或保留现有通用 `Error`，但建议统一为 `ApiError` 以减少上层分支）。

`ApiError` 可选扩展字段（用于调试）：

- `status?: number`：HTTP status。
- `cause?: unknown`：底层异常。

扩展字段不改变 `ApiError` 的基本构造签名与 `instanceof ApiError` 语义。

### RSS 校验逻辑归并

将 RSS 校验导出函数归并至 `src/lib/apiClient.ts`：

- 新增 `export async function validateRssUrl(url: string): Promise<RssValidationResult>`
- 内部调用 `/api/rss/validate` 使用同一 ky instance。
- 保持“返回结构化结果而非抛异常”的形态：
  - 超时 / 网络错误：返回 `{ ok: false, errorCode: 'timeout' | 'network_error', message }`
  - 后端返回 valid=false：返回 `{ ok: false, errorCode: reason, message }`
  - valid=true：返回 `{ ok: true, kind, title, siteUrl }`
- 校验类请求不触发 `notifyApiError()`，避免在表单交互中制造全局噪声。

`src/features/feeds/services/rssValidationService.ts` 将被删除或退化为 re-export（以减少重复的 URL 拼接与 timeout 逻辑）。

### 迁移路径

为降低风险，按两步落地：

1. 先迁移 `src/lib/apiClient.ts`：将底层 `fetch` 替换为 `ky`，保持所有既有导出函数名不变。
2. 再迁移 RSS 校验：新增并导出 `validateRssUrl`，替换 `rssValidationService` 中的直接 `fetch`。

### 测试策略

现有测试大量通过 `vi.stubGlobal('fetch', ...)` 断言“是否调用 fetch”。迁移到 ky 后，测试应更关注对外 contract：

- 对 `src/lib/apiClient.ts`：
  - 成功 envelope：返回 `data`
  - 失败 envelope：抛出 `ApiError`，包含预期 `code/message/fields`
  - `notifyOnError: false`：不触发 `notifyApiError()`
  - 非法响应：抛出 `ApiError(code='invalid_response')`（或等价错误）
- 对 `validateRssUrl`：
  - 超时映射为 `timeout`
  - 网络错误映射为 `network_error`
  - valid=true/false 分支的字段映射正确

尽量减少对 ky 内部实现细节的耦合（例如不要过度断言 `fetch` 的调用参数形态），使测试在库升级或内部封装调整时仍稳定。


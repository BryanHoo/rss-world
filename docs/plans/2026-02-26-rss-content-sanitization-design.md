# RSS 正文 HTML 规范化（sanitizeContent）设计

日期：2026-02-26  
状态：已确认（Approved）

## TL;DR

- 在入库前对文章正文 HTML 做“规范化 + 清洗”：让图片/链接在阅读器里更稳定可用、排版更干净。
- 继续使用 `sanitize-html`，通过 allowlist + `transformTags` 实现；默认剥离 `style`/`class`，让 `prose` 统一排版。
- 仅影响后续新抓取文章（不回填历史）。

## 背景

当前正文渲染链路：

- 抓取入库：`src/worker/index.ts` 调用 `sanitizeContent(item.contentHtml)` 后写入 `content_html`
- 前端渲染：`src/features/articles/ArticleView.tsx` 使用 `dangerouslySetInnerHTML` + `prose` 渲染 `article.content`

当前清洗实现位于 `src/server/rss/sanitizeContent.ts`，存在两类影响阅读体验的问题：

1) 图片相关属性被过度收敛（例如 `srcset`、`width`、`height`、`loading` 等），导致清晰度与版式稳定性变差。  
2) `a[href]`、`img[src]` 的相对 URL / 协议相对 URL 在阅读器中无法正确解析，出现链接/图片失效。

## 目标

- 在不降低安全基线的前提下，让正文 HTML 本身更适合阅读器渲染：
  - `a[href]`：默认新标签页打开，并补全安全 `rel`
  - `img`：尽可能保留/补全与渲染相关的安全属性（`srcset/width/height/loading/decoding`），支持 `data-src`/`data-srcset`
  - 相对/协议相对 URL：入库前统一转为绝对 URL
- 保持正文样式一致：默认不保留来源站点的 `style`/`class`（由阅读器的 `prose` 统一排版）。
- 不回填历史文章：只影响未来新抓取内容。

## 非目标

- 不做 Reader Mode（不抓取 `article.link` 再抽取正文）。
- 不引入资源代理/转存（图片仍然由浏览器直连原站加载）。
- 不增加异步 DNS 校验（避免扩大 scope 与性能成本）。

## 方案（选定：`sanitize-html` + `transformTags`）

### 数据流调整

- `src/worker/index.ts`：为每个 item 计算 `baseUrl`，并调用 `sanitizeContent(item.contentHtml, { baseUrl })`
- `src/server/rss/sanitizeContent.ts`：
  - 调整签名：`sanitizeContent(html, options?: { baseUrl: string })`
  - 使用 `transformTags` 对 `a`/`img` 做 URL 规范化与属性补全
  - 使用 allowlist 约束允许的 tag/attribute/scheme

### baseUrl 选择（避免“跨域劫持”）

`baseUrl` 的优先级（从高到低）：

1) `item.link`（最接近文章原文页面，通常是相对链接的正确基准）
2) `parsedFeed.link`
3) RSS 源地址（`feed.url`，即抓取 XML 的 URL）

约束：

- 不读取正文里的 `<base>` 标签（避免内容侧通过 `<base href>` 改写相对 URL 的解析基准）。

### allowlist（标签与属性）

`allowedTags`：

- 基于 `sanitizeHtml.defaults.allowedTags`
- 额外允许：`img`

`allowedAttributes`（在默认基础上扩展/修正）：

- `a`: `href`, `name`, `target`, `rel`
- `img`: `src`, `srcset`, `alt`, `title`, `width`, `height`, `loading`, `decoding`
- `td`/`th`: `colspan`, `rowspan`（避免表格语义丢失）

说明：

- 默认不允许 `style`、`class`（统一交给阅读器侧 `prose`）。

### scheme 与协议相对 URL

- `allowedSchemes`: `http`, `https`, `mailto`
- `allowedSchemesByTag.img`: `http`, `https`
- `allowProtocolRelative`: `false`
- 通过 `transformTags` 将 `//example.com/...` 规范化为绝对 URL（默认使用 `https:`）

### transformTags：规范化规则

#### `a`

- `href` 以 `#` 开头：保留（站内锚点不强制新标签页）。
- `mailto:`：保留 `href`，但不强制 `target`。
- 其它情况：将 `href` 通过 `new URL(href, baseUrl)` 转为绝对 URL，仅允许 `http/https`：
  - 不合法或不允许 scheme：移除 `href`
  - 合法：强制补 `target="_blank"` 与 `rel="noopener noreferrer ugc"`（若原本存在 `rel` 则合并去重）

#### `img`

- `src` 的取值优先级：`src` → `data-src`
- `srcset` 的取值优先级：`srcset` → `data-srcset`
- `src/srcset` 统一转绝对 URL，仅允许 `http/https`；无有效 `src` 时丢弃该 `img`（避免空图片占位）。
- 默认补齐：
  - `loading="lazy"`
  - `decoding="async"`
- `width/height`：仅保留纯数字（非数字移除），避免异常值影响排版。

### 安全与“跨域”注意点

- 规范化只在入库时执行，不会触发额外网络请求。
- 仅允许 `http/https/mailto`，并继续清理脚本/事件处理器，保持现有安全基线。
- 规范化后的链接/图片天然是跨域资源：由浏览器按正常跨域规则加载；本次不引入代理与 CORS 绕过逻辑。

## 测试策略

扩展 `src/server/rss/parseFeed.test.ts` 中对 `sanitizeContent` 的覆盖，新增用例验证：

- `a[href]`
  - 相对/协议相对 URL → 绝对 URL
  - 默认补 `target="_blank"` 与 `rel`（含 `noopener`/`noreferrer`/`ugc`）
  - `href="#..."` 不强制新标签页
  - `mailto:` 保留且不强制 `target`
  - `javascript:` 等危险 scheme 被移除
- `img`
  - `data-src`/`data-srcset` 提升为 `src`/`srcset`
  - 相对/协议相对 URL → 绝对 URL
  - 默认补 `loading/decoding`
  - 无有效 `src` 的 `img` 会被过滤
- `table`
  - `td/th` 的 `colspan/rowspan` 可被保留

## 验收标准

- 新抓取文章的 `content_html` 中：
  - 图片：能保留（或从 data-* 提升）`srcset/width/height`，并补齐 `loading/decoding`
  - 链接：默认新标签页打开（除 `#...` / `mailto:`），并包含安全 `rel`
  - 相对/协议相对 URL 均已转为绝对 URL
  - `script`/事件处理器等危险内容仍被清理
- 单测通过：`pnpm run test:unit`

## 影响范围

- 修改：`src/server/rss/sanitizeContent.ts`
- 修改：`src/worker/index.ts`
- 修改：`src/server/rss/parseFeed.test.ts`

## 回滚方案

- 仅涉及入库前的内容规范化与函数签名；如效果不理想，可回退到旧 `sanitizeContent` 实现。
- 不涉及数据库 schema；影响范围仅限“回退后新抓取”的文章内容。


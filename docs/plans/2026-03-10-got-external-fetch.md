# 使用 got 统一服务端外部抓取 Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 将服务端 RSS/Fulltext/Image 对外抓取从直接使用 `fetch` 迁移到 `got`，并新增统一的 `src/server/http/externalHttpClient.ts`（按场景封装 `fetchRssXml` / `fetchHtml` / `fetchImageBytes`）。

**Architecture:** 新增 `externalHttpClient` 作为服务端对外抓取的统一入口，内部维护共享 `got` instance（`retry.limit=0`、`throwHttpErrors=false`），并对 RSS/XML、HTML、Image 三类请求提供不同的重定向与响应体限制策略；四个既有入口（RSS 拉取、RSS 校验、全文抓取、图片代理）依赖该模块并保留各自的业务语义与错误映射。

**Tech Stack:** `next` (Route Handlers, `runtime='nodejs'`), `typescript`, `vitest`, `got`, `rss-parser`, `sharp`

---

## 前置阅读 / 相关经验

- 已检查 `docs/summaries/`：当前仅有与流式摘要 hook 重置相关的总结（`docs/summaries/2026-03-09-streaming-summary-hook-reset.md`），与本次服务端抓取层迁移无直接关联，因此不作为本计划约束。

## 约束与范围

- 仅覆盖“服务端对外抓取”这 4 处入口的 `fetch(...)`：
  - `src/server/rss/fetchFeedXml.ts`
  - `src/app/api/rss/validate/route.ts`
  - `src/server/fulltext/fetchFulltextAndStore.ts`
  - `src/app/api/media/image/route.ts`
- 不触碰浏览器侧内部 `/api/**`（`src/lib/apiClient.ts` / `ky`）。
- 不引入默认重试（`retry.limit = 0`），避免对源站造成额外压力，也避免重复提交风险。
- 不引入“最终跳转 URL 强制 SSRF 复检”的新行为（RSS/XML 与 RSS 校验维持现状）；但图片代理必须保留现有“每一跳重定向都 `isSafeMediaUrl()`”的语义。

---

### Task 1: 创建隔离 worktree（若尚未创建）

**Files:**

- None

**Step 1: Create worktree**

Run: `git worktree add .worktrees/got-external-fetch -b codex/got-external-fetch`

Expected: 输出包含 `Preparing worktree`，并切到新分支。

**Step 2: Commit**

Skip（此任务只做环境准备，不提交）。

---

### Task 2: 引入 got 依赖

**Files:**

- Modify: `package.json`

**Step 1: Install**

Run: `pnpm add got`

Expected: `dependencies` 增加 `got`，安装成功。

**Step 2: Run unit tests (smoke)**

Run: `pnpm vitest run src/app/api/rss/validate/route.test.ts src/app/api/media/image/route.test.ts src/server/fulltext/fetchFulltextAndStore.test.ts`

Expected: PASS（此时实现尚未改动）。

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build(抓取): 添加 got 依赖" -m "- 添加 got 作为服务端对外抓取 HTTP client\n- 为后续统一抓取层迁移做准备"
```

---

### Task 3: 为 externalHttpClient 建立本地 HTTP server 的测试基建（先失败）

> 目的：避免复杂的 ESM mock `got`，通过本地 `node:http` server 进行可控的集成式单测，覆盖 redirect/timeout/maxBytes 等关键分支。

**Files:**

- Create: `src/server/http/externalHttpClient.test.ts`

**Step 1: Write the failing test**

创建 `src/server/http/externalHttpClient.test.ts`，先只写一个“可以启动本地 server 并拿到 baseUrl”的测试，并尝试 import 尚不存在的模块（此时应 FAIL）。

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

describe('externalHttpClient (test harness)', () => {
  let closeServer: (() => Promise<void>) | null = null;
  let baseUrl = '';

  beforeEach(async () => {
    const server = createServer((req, res) => {
      res.statusCode = 200;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end('ok');
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;

    closeServer = async () => {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    };
  });

  afterEach(async () => {
    await closeServer?.();
  });

  it('boots local server and can import externalHttpClient', async () => {
    expect(baseUrl).toMatch(/^http:\\/\\/127\\.0\\.0\\.1:\\d+$/);

    // 暂时仅验证模块可被 import（当前应当失败）
    await import('./externalHttpClient');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/http/externalHttpClient.test.ts`

Expected: FAIL（`Cannot find module './externalHttpClient'` 或类似错误）。

**Step 3: Commit**

Skip（该任务先不提交，让下一任务实现后一起提交更合理）。

---

### Task 4: 实现 `src/server/http/externalHttpClient.ts`（最小实现让 Task 3 通过）

**Files:**

- Create: `src/server/http/externalHttpClient.ts`
- Test: `src/server/http/externalHttpClient.test.ts`

**Step 1: Write minimal implementation**

创建 `src/server/http/externalHttpClient.ts`，先只导出空实现（让 import 通过），后续任务再逐步加功能与测试。

```ts
export {};
```

**Step 2: Run test**

Run: `pnpm vitest run src/server/http/externalHttpClient.test.ts`

Expected: PASS

**Step 3: Commit**

```bash
git add src/server/http/externalHttpClient.ts src/server/http/externalHttpClient.test.ts
git commit -m "test(抓取): 添加 externalHttpClient 测试基建" -m "- 添加本地 node:http server 测试夹具\n- 添加 externalHttpClient 初始占位模块"
```

---

### Task 5: 在 externalHttpClient 中实现 `fetchRssXml`（TDD）

**Files:**

- Modify: `src/server/http/externalHttpClient.test.ts`
- Modify: `src/server/http/externalHttpClient.ts`

**Step 1: Write the failing test**

在 `src/server/http/externalHttpClient.test.ts` 追加一个用例：本地 server 返回 RSS XML，`fetchRssXml` 应返回 `status/xml/etag/lastModified`。

```ts
it('fetchRssXml returns status/xml/etag/lastModified', async () => {
  const { fetchRssXml } = await import('./externalHttpClient');

  const xmlUrl = `${baseUrl}/rss.xml`;
  // 由 server handler 根据 path 返回不同内容（请在 beforeEach 的 createServer handler 中加分支）
  // - /rss.xml: 200 + application/rss+xml + etag/last-modified + body 为 xml

  const res = await fetchRssXml(xmlUrl, {
    timeoutMs: 1000,
    userAgent: 'test-agent',
    etag: null,
    lastModified: null,
  });

  expect(res.status).toBe(200);
  expect(res.xml).toContain('<rss');
  expect(res.etag).toBe('W/\"1\"');
  expect(res.lastModified).toBe('Mon, 01 Jan 2024 00:00:00 GMT');
});
```

并把测试 server 的 handler 改成按 path 返回内容：

```ts
const server = createServer((req, res) => {
  if (req.url === '/rss.xml') {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/rss+xml; charset=utf-8');
    res.setHeader('etag', 'W/\"1\"');
    res.setHeader('last-modified', 'Mon, 01 Jan 2024 00:00:00 GMT');
    res.end('<?xml version=\"1.0\"?><rss><channel><title>Feed</title></channel></rss>');
    return;
  }

  res.statusCode = 200;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.end('ok');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/http/externalHttpClient.test.ts`

Expected: FAIL（`fetchRssXml is not a function` 或 import 找不到导出）。

**Step 3: Implement minimal code**

在 `src/server/http/externalHttpClient.ts`：

1) 引入并创建 got instance（共享、不导出）：

```ts
import got from 'got';
import { getFetchUrlCandidates } from '../rss/fetchUrlCandidates';

const client = got.extend({
  retry: { limit: 0 },
  throwHttpErrors: false,
});
```

2) 定义返回类型与函数（对齐现有 `fetchFeedXml` 需求）：

```ts
export interface FetchRssXmlResult {
  status: number;
  xml: string | null;
  etag: string | null;
  lastModified: string | null;
  finalUrl: string;
}

export async function fetchRssXml(
  url: string,
  options: { timeoutMs: number; userAgent: string; etag?: string | null; lastModified?: string | null },
): Promise<FetchRssXmlResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const headers: Record<string, string> = {
      accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      'user-agent': options.userAgent,
    };

    if (options.etag) headers['if-none-match'] = options.etag;
    if (options.lastModified) headers['if-modified-since'] = options.lastModified;

    const candidates = getFetchUrlCandidates(url);
    let lastError: unknown = null;

    for (const candidate of candidates) {
      try {
        const res = await client(candidate, {
          method: 'GET',
          followRedirect: true,
          headers,
          signal: controller.signal,
        });

        const status = res.statusCode;
        const etag = typeof res.headers.etag === 'string' ? res.headers.etag : null;
        const lastModified =
          typeof res.headers['last-modified'] === 'string' ? res.headers['last-modified'] : null;
        const finalUrl =
          typeof (res as { url?: unknown }).url === 'string' ? (res as { url: string }).url : candidate;

        if (status === 304) {
          return { status, xml: null, etag, lastModified, finalUrl };
        }

        return { status, xml: res.body, etag, lastModified, finalUrl };
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') throw err;
        lastError = err;
      }
    }

    if (lastError instanceof Error) throw lastError;
    throw new Error('Network error');
  } finally {
    clearTimeout(timeout);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/server/http/externalHttpClient.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/http/externalHttpClient.ts src/server/http/externalHttpClient.test.ts
git commit -m "feat(抓取): 添加 fetchRssXml 统一 RSS 拉取" -m "- 使用 got 封装 RSS/XML 拉取并禁用默认重试\n- 复用 getFetchUrlCandidates 与 etag/last-modified 逻辑\n- 增加本地 server 回归测试覆盖"
```

---

### Task 6: 迁移 `src/server/rss/fetchFeedXml.ts` 到 externalHttpClient（保持对外 contract）

**Files:**

- Modify: `src/server/rss/fetchFeedXml.ts`

**Step 1: Implement minimal change**

将 `fetchFeedXml(...)` 内部实现替换为调用 `fetchRssXml(...)`，并将 `finalUrl` 丢弃（该文件原 contract 不需要）。

示意：

```ts
import { fetchRssXml } from '../http/externalHttpClient';

export async function fetchFeedXml(url: string, options: FetchFeedXmlOptions): Promise<FetchFeedXmlResult> {
  const res = await fetchRssXml(url, options);
  return {
    status: res.status,
    xml: res.xml,
    etag: res.etag,
    lastModified: res.lastModified,
  };
}
```

**Step 2: Run targeted tests**

Run: `pnpm vitest run src/server/http/externalHttpClient.test.ts`

Expected: PASS

**Step 3: Commit**

```bash
git add src/server/rss/fetchFeedXml.ts
git commit -m "refactor(抓取): 迁移 fetchFeedXml 到 got 抓取层" -m "- 复用 externalHttpClient.fetchRssXml 统一 RSS 拉取\n- 保持 fetchFeedXml 返回结构与调用方不变"
```

---

### Task 7: 迁移 `/api/rss/validate` Route Handler（并更新单测）

**Files:**

- Modify: `src/app/api/rss/validate/route.ts`
- Modify: `src/app/api/rss/validate/route.test.ts`

**Step 1: Write the failing test**

先更新 `src/app/api/rss/validate/route.test.ts`：将对 `globalThis.fetch` 的 mock 替换为对 `../../../../server/http/externalHttpClient` 的 mock（此时 route 代码尚未改动，测试应 FAIL）。

示意：

```ts
const fetchRssXmlMock = vi.fn();

vi.mock('../../../../server/http/externalHttpClient', () => ({
  fetchRssXml: (...args: unknown[]) => fetchRssXmlMock(...args),
}));
```

并将用例里的 `vi.spyOn(globalThis, 'fetch')...` 改为：

```ts
fetchRssXmlMock.mockResolvedValue({
  status: 200,
  xml: '<?xml version=\"1.0\"?><rss><channel><title>Feed</title></channel></rss>',
  etag: null,
  lastModified: null,
  finalUrl: 'https://example.com/rss.xml',
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/api/rss/validate/route.test.ts`

Expected: FAIL（route 仍在用 fetch，mock 未生效或调用次数不匹配）。

**Step 3: Update route implementation**

在 `src/app/api/rss/validate/route.ts`：

- 保留 `isSafeExternalUrl()`、timeout（10s）、状态码映射、`rss-parser` 解析逻辑不变
- 将“候选 URL + fetch”替换为调用 `fetchRssXml(urlParam, { timeoutMs: 10_000, userAgent: '...' })`
- 根据返回的 `status/xml` 走原有分支：
  - `status === 401 || 403` -> unauthorized
  - 非 2xx -> network_error
  - `xml` 为空或解析失败 -> not_feed

**Step 4: Run tests**

Run: `pnpm vitest run src/app/api/rss/validate/route.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/rss/validate/route.ts src/app/api/rss/validate/route.test.ts
git commit -m "refactor(抓取): /api/rss/validate 迁移到 got 抓取层" -m "- 使用 externalHttpClient.fetchRssXml 替代 Route Handler 内部 fetch\n- 更新单测改为 mock externalHttpClient 以避免耦合网络实现"
```

---

### Task 8: 迁移全文抓取 `fetchFulltextAndStore`（并更新单测）

**Files:**

- Modify: `src/server/fulltext/fetchFulltextAndStore.ts`
- Modify: `src/server/fulltext/fetchFulltextAndStore.test.ts`

**Step 1: Write the failing test**

先改 `src/server/fulltext/fetchFulltextAndStore.test.ts`：将 `vi.stubGlobal('fetch', ...)` 替换为 mock `../http/externalHttpClient` 的 `fetchHtml`。

示意：

```ts
const fetchHtmlMock = vi.fn();

vi.mock('../http/externalHttpClient', () => ({
  fetchHtml: (...args: unknown[]) => fetchHtmlMock(...args),
}));
```

并将用例里构造 `Response` 的部分替换为：

```ts
fetchHtmlMock.mockResolvedValue({
  status: 200,
  finalUrl: 'https://example.com/a',
  contentType: 'text/html; charset=utf-8',
  html: '<html><body><main><p>World</p></main></body></html>',
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/fulltext/fetchFulltextAndStore.test.ts`

Expected: FAIL（实现仍在用 fetch）。

**Step 3: Implement migration**

在 `src/server/fulltext/fetchFulltextAndStore.ts`：

- 引入 `fetchHtml`：`import { fetchHtml } from '../http/externalHttpClient';`
- 删除 `readTextWithLimit` 与 `fetch(...)` 调用，改为：
  - `const res = await fetchHtml(link, { timeoutMs: settings.rssTimeoutMs, userAgent: settings.rssUserAgent, maxBytes: MAX_HTML_BYTES });`
  - `sourceUrl = res.finalUrl || sourceUrl;`（并保留既有 `isSafeExternalUrl(sourceUrl)` 的复检）
  - status/content-type 校验与后续 `extractFulltext/sanitizeContent` 逻辑保持

**Step 4: Run tests**

Run: `pnpm vitest run src/server/fulltext/fetchFulltextAndStore.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/fulltext/fetchFulltextAndStore.ts src/server/fulltext/fetchFulltextAndStore.test.ts
git commit -m "refactor(抓取): 全文抓取迁移到 got 抓取层" -m "- 使用 externalHttpClient.fetchHtml 替代 fetch + 读取限额逻辑\n- 更新单测改为 mock externalHttpClient 以减少耦合"
```

---

### Task 9: 迁移图片代理 `/api/media/image`（并更新单测）

**Files:**

- Modify: `src/app/api/media/image/route.ts`
- Modify: `src/app/api/media/image/route.test.ts`

**Step 1: Write the failing test**

在 `src/app/api/media/image/route.test.ts`：

- 移除 `vi.stubGlobal('fetch', fetchMock);` 相关断言
- 改为 mock `../../../../server/http/externalHttpClient` 的 `fetchImageBytes`

示意：

```ts
const fetchImageBytesMock = vi.fn();

vi.mock('../../../../server/http/externalHttpClient', () => ({
  fetchImageBytes: (...args: unknown[]) => fetchImageBytesMock(...args),
}));
```

并把“proxies image bytes”用例的 mock 改为：

```ts
fetchImageBytesMock.mockResolvedValue({
  kind: 'ok',
  status: 200,
  contentType: 'image/jpeg',
  cacheControl: 'public, max-age=600',
  bytes: Buffer.from([1, 2, 3]),
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/api/media/image/route.test.ts`

Expected: FAIL（route 仍在用 fetch，mock 未生效）。

**Step 3: Implement migration**

在 `src/app/api/media/image/route.ts`：

- 引入 `fetchImageBytes`
- 将 `fetchImage(...)` 替换为对 `fetchImageBytes(...)` 的调用（保留现有 `MAX_REDIRECTS` / `MAX_BYTES` 常量）
- 将结果映射回现有 Response 语义：
  - `kind: 'redirect_fallback'` -> `Response.redirect(url, 307)`
  - `kind: 'forbidden'` -> 403
  - `kind: 'too_many_redirects' | 'bad_gateway'` -> 502
  - `kind: 'unsupported_media_type'` -> 415
  - `kind: 'too_large'` -> 413
  - `kind: 'ok'` -> 继续走 `maybeTransformImage` 并设置 `content-type/cache-control`

**Step 4: Run tests**

Run: `pnpm vitest run src/app/api/media/image/route.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/media/image/route.ts src/app/api/media/image/route.test.ts
git commit -m "refactor(抓取): 图片代理迁移到 got 抓取层" -m "- 使用 externalHttpClient.fetchImageBytes 统一 upstream 拉取与重定向策略\n- 更新单测改为 mock externalHttpClient 避免依赖全局 fetch"
```

---

### Task 10: 最终回归与“无残留 fetch”检查

**Files:**

- None (unless fixes needed)

**Step 1: Ensure no direct fetch remains in the 4 entrypoints**

Run: `rg -n "\\bfetch\\(" src/server/rss/fetchFeedXml.ts src/app/api/rss/validate/route.ts src/server/fulltext/fetchFulltextAndStore.ts src/app/api/media/image/route.ts -S`

Expected: 无输出（或仅剩与测试无关的注释/字符串；正常实现应完全移除）。

**Step 2: Run focused unit tests**

Run: `pnpm vitest run src/server/http/externalHttpClient.test.ts src/app/api/rss/validate/route.test.ts src/server/fulltext/fetchFulltextAndStore.test.ts src/app/api/media/image/route.test.ts`

Expected: PASS

**Step 3: Optional full test run**

Run: `pnpm test:unit`

Expected: PASS

**Step 4: Commit**

如无额外修复则 Skip；若有小修复，请用 `fix(抓取): ...` 提交并在 body 说明影响面。


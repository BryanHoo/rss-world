# OpenAI chat.completions SDK 迁移 Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 将 AI 摘要与翻译（标题/正文）调用从手写 `fetch` 迁移为 OpenAI 官方 npm 包 `openai` 的 `chat.completions`，并禁用 pg-boss 的 job 重试（AI job 入队显式 `retryLimit: 0`）。

**Architecture:** 新增 `src/server/ai/openaiClient.ts` 作为 OpenAI SDK client 工厂（集中 baseURL normalize），其余 AI 模块改为调用 `client.chat.completions.create(...)`。路由侧为 `ai-summary` 增加 `fulltext_pending` 拦截，避免在 pg-boss 无重试场景下产生失败 job。

**Tech Stack:** Next.js App Router（`runtime = 'nodejs'`）、TypeScript、Vitest、pg-boss、OpenAI Node SDK（`openai`）。

---

### Task 1: 添加 OpenAI SDK 依赖

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Step 1: 添加依赖**

Run: `pnpm add openai`

Expected: `package.json` 的 `dependencies` 出现 `openai`，并更新 `pnpm-lock.yaml`。

**Step 2: 运行单测确保环境正常**

Run: `pnpm run test:unit`

Expected: PASS（如果此时还没改代码，也可先确认能跑通）。

**Step 3: Commit**

Run:

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add openai sdk"
```

---

### Task 2: 新增 `openaiClient` 工厂模块（集中 baseURL normalize）

**Files:**

- Create: `src/server/ai/openaiClient.ts`
- Test: `src/server/ai/openaiClient.test.ts`

**Step 1: 写一个会失败的单测（模块尚不存在）**

Add `src/server/ai/openaiClient.test.ts`：

```ts
import { describe, expect, it } from 'vitest';

describe('openaiClient', () => {
  it('normalizes baseURL by trimming trailing slash only', async () => {
    const mod = await import('./openaiClient');
    expect(mod.normalizeBaseUrl('https://api.openai.com/v1/')).toBe('https://api.openai.com/v1');
    expect(mod.normalizeBaseUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1');
  });
});
```

**Step 2: 运行单测验证失败**

Run: `pnpm run test:unit src/server/ai/openaiClient.test.ts`

Expected: FAIL（`Cannot find module './openaiClient'` 或类似错误）。

**Step 3: 实现最小代码让测试通过**

Create `src/server/ai/openaiClient.ts`：

```ts
import OpenAI from 'openai';

export function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function createOpenAIClient(input: { apiBaseUrl: string; apiKey: string }) {
  return new OpenAI({
    apiKey: input.apiKey,
    baseURL: normalizeBaseUrl(input.apiBaseUrl),
  });
}
```

**Step 4: 运行单测验证通过**

Run: `pnpm run test:unit src/server/ai/openaiClient.test.ts`

Expected: PASS

**Step 5: Commit**

Run:

```bash
git add src/server/ai/openaiClient.ts src/server/ai/openaiClient.test.ts
git commit -m "feat(ai): add openai client factory"
```

---

### Task 3: 迁移 `summarizeText` 到 OpenAI SDK，并更新单测断言（兼容 Request 形态）

**Files:**

- Modify: `src/server/ai/summarizeText.ts`
- Modify: `src/server/ai/summarizeText.test.ts`

**Step 1: 先更新测试断言（更稳健，不依赖 fetch 入参一定是 string）**

Update `src/server/ai/summarizeText.test.ts`：

- 新增 helper：

```ts
function getFetchUrl(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg && typeof arg === 'object' && 'url' in arg && typeof (arg as { url?: unknown }).url === 'string') {
    return (arg as { url: string }).url;
  }
  return '';
}
```

- 将断言改为：

```ts
expect(getFetchUrl(fetchMock.mock.calls[0]?.[0])).toBe('https://api.openai.com/v1/chat/completions');
```

**Step 2: 跑单测确认目前仍通过**

Run: `pnpm run test:unit src/server/ai/summarizeText.test.ts`

Expected: PASS

**Step 3: 改实现：用 `createOpenAIClient` + `client.chat.completions.create`**

Update `src/server/ai/summarizeText.ts`（保留函数签名与 content 校验）：

```ts
import { createOpenAIClient } from './openaiClient';

// ...保留 SummarizeTextInput 接口...

function getSummaryContent(content: unknown): string {
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Invalid summarize response: missing content');
  }
  return content.trim();
}

export async function summarizeText(input: SummarizeTextInput): Promise<string> {
  const client = createOpenAIClient({ apiBaseUrl: input.apiBaseUrl, apiKey: input.apiKey });

  const completion = await client.chat.completions.create({
    model: input.model,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: '你是中文摘要助手。请输出简洁中文摘要，格式：先给一行 TL;DR，再给 3-5 条要点。',
      },
      { role: 'user', content: input.text },
    ],
  });

  return getSummaryContent(completion.choices?.[0]?.message?.content);
}
```

**Step 4: 跑单测**

Run: `pnpm run test:unit src/server/ai/summarizeText.test.ts`

Expected: PASS

**Step 5: Commit**

Run:

```bash
git add src/server/ai/summarizeText.ts src/server/ai/summarizeText.test.ts
git commit -m "refactor(ai): summarizeText uses openai sdk"
```

---

### Task 4: 迁移 `translateHtml` 到 OpenAI SDK，并更新单测断言

**Files:**

- Modify: `src/server/ai/translateHtml.ts`
- Modify: `src/server/ai/translateHtml.test.ts`

**Step 1: 更新测试断言为兼容 Request 形态**

同 Task 3 的方式，为 `src/server/ai/translateHtml.test.ts` 添加 `getFetchUrl` 并断言 URL 为 `.../chat/completions`。

Run: `pnpm run test:unit src/server/ai/translateHtml.test.ts`

Expected: PASS

**Step 2: 改实现为 SDK 调用**

Update `src/server/ai/translateHtml.ts`：

```ts
import { createOpenAIClient } from './openaiClient';

function getTranslationContent(content: unknown): string {
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Invalid translate response: missing content');
  }
  return content.trim();
}

export async function translateHtml(input: TranslateHtmlInput): Promise<string> {
  const client = createOpenAIClient({ apiBaseUrl: input.apiBaseUrl, apiKey: input.apiKey });
  const completion = await client.chat.completions.create({
    model: input.model,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          '你是 HTML 翻译助手。请将用户提供的 HTML 内容翻译为简体中文（zh-CN）。只翻译可见文本，保持原始 HTML 结构不变（标签/层级/列表等），严禁改动任何属性值（尤其 href/src/srcset）与 URL。只输出 HTML 字符串，不要输出解释文字或代码块标记。',
      },
      { role: 'user', content: input.html },
    ],
  });

  return getTranslationContent(completion.choices?.[0]?.message?.content);
}
```

**Step 3: 跑单测**

Run: `pnpm run test:unit src/server/ai/translateHtml.test.ts`

Expected: PASS

**Step 4: Commit**

Run:

```bash
git add src/server/ai/translateHtml.ts src/server/ai/translateHtml.test.ts
git commit -m "refactor(ai): translateHtml uses openai sdk"
```

---

### Task 5: 迁移 `bilingualHtmlTranslator` 的 `translateBatch` 到 OpenAI SDK，并更新单测断言

**Files:**

- Modify: `src/server/ai/bilingualHtmlTranslator.ts`
- Modify: `src/server/ai/bilingualHtmlTranslator.test.ts`

**Step 1: 更新测试断言（兼容 Request 形态 + 多次调用）**

Update `src/server/ai/bilingualHtmlTranslator.test.ts`：

- 替换 `toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', ...)` 为：
  - `expect(fetchMock).toHaveBeenCalledTimes(2)`
  - 断言每次调用的 URL 都是 `.../chat/completions`（可用 `mock.calls.map((c) => getFetchUrl(c[0]))`）

**Step 2: 运行单测确认测试更新不破坏当前实现**

Run: `pnpm run test:unit src/server/ai/bilingualHtmlTranslator.test.ts`

Expected: PASS

**Step 3: 改实现：`translateBatch` 改为 SDK 调用**

Update `src/server/ai/bilingualHtmlTranslator.ts`：

- 添加 `import { createOpenAIClient } from './openaiClient';`
- 将 `translateBatch(...)` 里的 `fetch` 替换为：

```ts
  const client = createOpenAIClient({ apiBaseUrl: input.apiBaseUrl, apiKey: input.apiKey });
  const completion = await client.chat.completions.create({
    model: input.model,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          '你是翻译助手。把用户给出的字符串数组逐项翻译为简体中文，保持数组顺序和长度完全一致。只输出 JSON 字符串数组，不要输出解释。',
      },
      { role: 'user', content: JSON.stringify(input.texts) },
    ],
  });

  const content = completion.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Invalid bilingual translation response: missing content');
  }

  return parseBatchTranslations(unwrapCodeFence(content), input.texts.length);
```

（保留原有 `unwrapCodeFence` / `parseBatchTranslations` 逻辑。）

**Step 4: 跑单测**

Run: `pnpm run test:unit src/server/ai/bilingualHtmlTranslator.test.ts`

Expected: PASS

**Step 5: Commit**

Run:

```bash
git add src/server/ai/bilingualHtmlTranslator.ts src/server/ai/bilingualHtmlTranslator.test.ts
git commit -m "refactor(ai): bilingual translator uses openai sdk"
```

---

### Task 6: 迁移 `translateTitle` 到 OpenAI SDK，并补齐单测

**Files:**

- Modify: `src/server/ai/translateTitle.ts`
- Create: `src/server/ai/translateTitle.test.ts`

**Step 1: 先写测试（此时可先通过旧实现，后续用于回归）**

Create `src/server/ai/translateTitle.test.ts`：

```ts
import { describe, expect, it, vi } from 'vitest';

function getFetchUrl(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg && typeof arg === 'object' && 'url' in arg && typeof (arg as { url?: unknown }).url === 'string') {
    return (arg as { url: string }).url;
  }
  return '';
}

describe('translateTitle', () => {
  it('calls chat/completions and returns content', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '你好世界' } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { translateTitle } = await import('./translateTitle');
    const out = await translateTitle({
      apiBaseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      title: 'Hello world',
    });

    expect(out).toBe('你好世界');
    expect(getFetchUrl(fetchMock.mock.calls[0]?.[0])).toBe('https://api.openai.com/v1/chat/completions');
  });
});
```

Run: `pnpm run test:unit src/server/ai/translateTitle.test.ts`

Expected: PASS

**Step 2: 改实现为 SDK 调用**

Update `src/server/ai/translateTitle.ts`：

```ts
import { createOpenAIClient } from './openaiClient';

function getTranslationContent(content: unknown): string {
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Invalid translate-title response: missing content');
  }
  return content.trim();
}

export async function translateTitle(input: TranslateTitleInput): Promise<string> {
  const client = createOpenAIClient({ apiBaseUrl: input.apiBaseUrl, apiKey: input.apiKey });
  const completion = await client.chat.completions.create({
    model: input.model,
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content:
          '你是标题翻译助手。请将用户给出的文章标题翻译成简体中文（zh-CN），仅输出翻译后的标题文本，不要输出解释。',
      },
      { role: 'user', content: input.title },
    ],
  });

  return getTranslationContent(completion.choices?.[0]?.message?.content);
}
```

**Step 3: 跑测试**

Run: `pnpm run test:unit src/server/ai/translateTitle.test.ts`

Expected: PASS

**Step 4: Commit**

Run:

```bash
git add src/server/ai/translateTitle.ts src/server/ai/translateTitle.test.ts
git commit -m "refactor(ai): translateTitle uses openai sdk"
```

---

### Task 7: 禁用 AI 相关 pg-boss job 重试（显式 `retryLimit: 0`）+ `ai-summary` 增加 `fulltext_pending` 拦截，并更新 API 路由测试

**Files:**

- Modify: `src/app/api/articles/[id]/ai-summary/route.ts`
- Modify: `src/app/api/articles/[id]/ai-translate/route.ts`
- Modify: `src/worker/index.ts`
- Modify: `src/app/api/articles/routes.test.ts`

**Step 1: 先改测试，让它失败（期望入队参数与新 reason）**

Update `src/app/api/articles/routes.test.ts`：

1) 更新 `POST /:id/ai-summary enqueues summarize job` 断言：

- 将 `retryLimit: 8, retryDelay: 30` 替换为 `retryLimit: 0`

2) 更新 `POST /:id/ai-translate enqueues translate job` 断言：

- 将 `retryLimit: 8, retryDelay: 30` 替换为 `retryLimit: 0`

3) 新增一个测试：`POST /:id/ai-summary returns fulltext_pending when full text fetch is enabled but not ready`

示例断言要点：

- `getAiApiKeyMock.mockResolvedValue('sk-test')`
- `getFeedFullTextOnOpenEnabledMock.mockResolvedValue(true)`
- `getArticleByIdMock.mockResolvedValue({ contentFullHtml: null, contentFullError: null, contentHtml: '<p>rss</p>', ... })`
- 调用 `./[id]/ai-summary/route` 的 `POST`
- `expect(json.data).toEqual({ enqueued: false, reason: 'fulltext_pending' })`
- `expect(enqueueMock).not.toHaveBeenCalled()`

Run: `pnpm run test:unit src/app/api/articles/routes.test.ts`

Expected: FAIL（因为实现尚未更新）。

**Step 2: 改实现：两条路由入队显式 `retryLimit: 0`**

Update `src/app/api/articles/[id]/ai-summary/route.ts` 的 `enqueue(...)` options：

```ts
{ singletonKey: articleId, singletonSeconds: 600, retryLimit: 0 }
```

Update `src/app/api/articles/[id]/ai-translate/route.ts` 的 `enqueue(...)` options：

```ts
{ singletonKey: articleId, singletonSeconds: 600, retryLimit: 0 }
```

**Step 3: 改实现：`ai-summary` 增加 `fulltext_pending` 拦截**

Update `src/app/api/articles/[id]/ai-summary/route.ts`：

- 新增 import：`getFeedFullTextOnOpenEnabled`（来自 `../../../../../server/repositories/feedsRepo`）
- 在入队前增加判断：

```ts
const fullTextOnOpenEnabled = await getFeedFullTextOnOpenEnabled(pool, article.feedId);
if (fullTextOnOpenEnabled === true && !article.contentFullHtml && !article.contentFullError) {
  return ok({ enqueued: false, reason: 'fulltext_pending' });
}
```

**Step 4: worker 中标题翻译入队禁用重试**

Update `src/worker/index.ts`：`boss.send(JOB_AI_TRANSLATE_TITLE, ...)` 的 options：

```ts
{
  singletonKey: created.id,
  singletonSeconds: 600,
  retryLimit: 0,
}
```

并移除 `retryDelay` / `retryBackoff`。

**Step 5: 跑 API 路由测试**

Run: `pnpm run test:unit src/app/api/articles/routes.test.ts`

Expected: PASS

**Step 6: Commit**

Run:

```bash
git add src/app/api/articles/[id]/ai-summary/route.ts src/app/api/articles/[id]/ai-translate/route.ts src/worker/index.ts src/app/api/articles/routes.test.ts
git commit -m "refactor(ai): disable pg-boss retries and gate summary on fulltext"
```

---

### Task 8: 全量验证

**Files:**

- (no code changes)

**Step 1: 单测**

Run: `pnpm run test:unit`

Expected: PASS

**Step 2: Lint（可选但推荐）**

Run: `pnpm run lint`

Expected: PASS


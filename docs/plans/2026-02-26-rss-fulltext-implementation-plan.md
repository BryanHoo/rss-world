# RSS 全文抓取（按需 + 可配置开关） Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 当用户打开文章时（可配置开关），后台抓取 `article.link` 网页并用 Readability 抽取正文，清洗后写入新字段 `articles.content_full_html`，前端异步轮询刷新展示全文。

**Architecture:** 前端在文章打开时调用 `POST /api/articles/:id/fulltext` 触发队列任务（仅在开关开启、文章有 `link` 且未抓取过全文时入队），worker 执行网页抓取 + Readability 抽取 + `sanitizeContent` 清洗并写库；前端在短时间内轮询 `GET /api/articles/:id`，一旦 `contentFullHtml` 存在即切换展示为全文。

**Tech Stack:** TypeScript, Next.js App Router Route Handlers, Node.js `fetch`, `pg-boss`, Postgres migrations, `@mozilla/readability`, `jsdom`, `sanitize-html`, Vitest, pnpm.

---

## Inputs（先读这些再动手）

- 设计文档：`docs/plans/2026-02-26-rss-fulltext-design.md`
- 相关既有实现（调用链）：
  - 文章读取：`src/app/api/articles/[id]/route.ts`
  - 文章存储：`src/server/repositories/articlesRepo.ts`
  - 抓取 worker：`src/worker/index.ts`
  - HTML 清洗：`src/server/rss/sanitizeContent.ts`
  - SSRF 防护：`src/server/rss/ssrfGuard.ts`
  - 设置存储：`src/app/api/settings/route.ts`、`src/server/repositories/settingsRepo.ts`、`src/features/settings/settingsSchema.ts`
  - 前端展示：`src/features/articles/ArticleView.tsx`、`src/store/appStore.ts`、`src/lib/apiClient.ts`
- 验证命令：
  - 单测：`pnpm run test:unit`
  - Lint：`pnpm run lint`
  - 构建：`pnpm run build`

## Key Risks / Pitfalls（实现时别踩）

1) **安全（SSRF）**：抓网页必须对 `article.link` 做 `isSafeExternalUrl`，且对 `fetch` 的最终 `res.url`（redirect 后）再次校验。
2) **安全（XSS）**：Readability 抽出的 HTML 必须再走 `sanitizeContent(..., { baseUrl })`，不能直接存入库并渲染。
3) **性能与资源**：`jsdom` + Readability 会吃内存；要加超时与响应体大小限制（例如 2MB），避免 worker OOM。
4) **异步一致性**：前端要能“先看 RSS 再自动变成全文”，且用户切换文章时要取消轮询避免误更新与请求风暴。
5) **依赖与构建**：`jsdom` 当前在 `devDependencies`；如果你的生产安装会裁剪 dev 依赖，需要把 `jsdom` 移到 `dependencies`（本仓库 Dockerfile 会拷贝整包 node_modules，但别赌环境）。

---

## Phase 0：准备工作（隔离变更 + 建立基线）

### Task 1: 在独立 worktree/分支上执行（推荐）

**Files:** 无

**Step 1: 创建 worktree**

Run:

```bash
git fetch
git worktree add -b codex/rss-fulltext ../feedfuse-rss-fulltext
```

Expected: 生成目录 `../feedfuse-rss-fulltext`，后续步骤在该目录执行。

**Step 2: 基线验证（改动前先全绿）**

Run:

```bash
pnpm run lint
pnpm run test:unit
pnpm run build
```

Expected: 全部 PASS。

---

## Phase 1：数据库 schema（全文字段落库）

### Task 2: 先写迁移测试（先红）

**Files:**

- Create: `src/server/db/migrations/articleFulltextMigration.test.ts`

**Step 1: 写一个会失败的测试（文件还不存在）**

```ts
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('db migrations', () => {
  it('adds fulltext columns to articles', () => {
    const migrationPath = 'src/server/db/migrations/0004_article_fulltext.sql';
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('content_full_html');
    expect(sql).toContain('content_full_fetched_at');
    expect(sql).toContain('content_full_error');
    expect(sql).toContain('content_full_source_url');
  });
});
```

**Step 2: 运行测试确认失败**

Run:

```bash
pnpm run test:unit -- src/server/db/migrations/articleFulltextMigration.test.ts
```

Expected: FAIL（迁移文件不存在）。

**Step 3: Commit**

先不提交，等迁移文件补齐一起提交（避免主分支红）。

### Task 3: 增加迁移 SQL（转绿）

**Files:**

- Create: `src/server/db/migrations/0004_article_fulltext.sql`

**Step 1: 添加 migration**

```sql
alter table articles
  add column if not exists content_full_html text null;

alter table articles
  add column if not exists content_full_fetched_at timestamptz null;

alter table articles
  add column if not exists content_full_error text null;

alter table articles
  add column if not exists content_full_source_url text null;
```

**Step 2: 运行测试确认通过**

Run:

```bash
pnpm run test:unit -- src/server/db/migrations/articleFulltextMigration.test.ts
```

Expected: PASS。

**Step 3: Commit**

```bash
git add src/server/db/migrations/0004_article_fulltext.sql src/server/db/migrations/articleFulltextMigration.test.ts
git commit -m "feat(db): 增加文章全文字段"
```

---

## Phase 2：repositories（读写全文字段）

### Task 4: 先加 repo 单测锁行为（先红）

**Files:**

- Create: `src/server/repositories/articlesRepo.fulltext.test.ts`

**Step 1: 写 failing test（要求导出全文写入函数）**

```ts
import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

describe('articlesRepo (fulltext)', () => {
  it('writes fulltext html and error fields', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./articlesRepo')) as typeof import('./articlesRepo');

    if (typeof mod.setArticleFulltext !== 'function') {
      expect.fail('setArticleFulltext is not implemented');
    }
    if (typeof mod.setArticleFulltextError !== 'function') {
      expect.fail('setArticleFulltextError is not implemented');
    }

    await mod.setArticleFulltext(pool, 'article-1', {
      contentFullHtml: '<p>Hello</p>',
      sourceUrl: 'https://example.com/a',
    });
    expect(String(query.mock.calls[0]?.[0] ?? '')).toContain('content_full_html');

    await mod.setArticleFulltextError(pool, 'article-1', {
      error: 'timeout',
      sourceUrl: 'https://example.com/a',
    });
    expect(String(query.mock.calls[1]?.[0] ?? '')).toContain('content_full_error');
  });
});
```

**Step 2: 运行测试确认失败**

Run:

```bash
pnpm run test:unit -- src/server/repositories/articlesRepo.fulltext.test.ts
```

Expected: FAIL（函数不存在）。

### Task 5: 实现 repo 读写（转绿）

**Files:**

- Modify: `src/server/repositories/articlesRepo.ts`
- Test: `src/server/repositories/articlesRepo.fulltext.test.ts`

**Step 1: 扩展 `ArticleRow` 与 `getArticleById`**

在 `ArticleRow` 增加字段：

```ts
contentFullHtml: string | null;
contentFullFetchedAt: string | null;
contentFullError: string | null;
contentFullSourceUrl: string | null;
```

并在 `getArticleById` SQL 增加列与 alias：

```sql
content_full_html as "contentFullHtml",
content_full_fetched_at as "contentFullFetchedAt",
content_full_error as "contentFullError",
content_full_source_url as "contentFullSourceUrl",
```

**Step 2: 增加写入函数实现**

```ts
export async function setArticleFulltext(
  pool: Pool,
  id: string,
  input: { contentFullHtml: string; sourceUrl: string | null },
): Promise<void> {
  await pool.query(
    `
      update articles
      set
        content_full_html = $2,
        content_full_fetched_at = now(),
        content_full_error = null,
        content_full_source_url = $3
      where id = $1
    `,
    [id, input.contentFullHtml, input.sourceUrl],
  );
}

export async function setArticleFulltextError(
  pool: Pool,
  id: string,
  input: { error: string; sourceUrl: string | null },
): Promise<void> {
  await pool.query(
    `
      update articles
      set
        content_full_error = $2,
        content_full_source_url = $3
      where id = $1
    `,
    [id, input.error, input.sourceUrl],
  );
}
```

**Step 3: 运行测试确认通过**

Run:

```bash
pnpm run test:unit -- src/server/repositories/articlesRepo.fulltext.test.ts
```

Expected: PASS。

**Step 4: Commit**

```bash
git add src/server/repositories/articlesRepo.ts src/server/repositories/articlesRepo.fulltext.test.ts
git commit -m "feat(articles): 支持全文字段读写"
```

---

## Phase 3：设置项（UI 开关）

### Task 6: 先用 settingsSchema 单测锁定新字段（先红）

**Files:**

- Modify: `src/features/settings/settingsSchema.test.ts`

**Step 1: 增加用例**

```ts
it('supports rss.fullTextOnOpenEnabled', () => {
  const normalized = normalizePersistedSettings({
    rss: { fullTextOnOpenEnabled: true },
  });
  expect(normalized.rss.fullTextOnOpenEnabled).toBe(true);
});
```

**Step 2: 运行该测试确认失败**

Run:

```bash
pnpm run test:unit -- src/features/settings/settingsSchema.test.ts
```

Expected: FAIL（字段不存在/为 undefined）。

### Task 7: 补齐类型与 normalize（转绿）

**Files:**

- Modify: `src/types/index.ts`
- Modify: `src/features/settings/settingsSchema.ts`
- Test: `src/features/settings/settingsSchema.test.ts`

**Step 1: 扩展 `RssSettings` 类型**

在 `src/types/index.ts`：

```ts
export interface RssSettings {
  sources: RssSourceSetting[];
  fullTextOnOpenEnabled: boolean;
}
```

**Step 2: 默认值 + normalize**

在 `src/features/settings/settingsSchema.ts`：

- `defaultRssSettings` 增加 `fullTextOnOpenEnabled: false`
- `normalizeRssSettings(...)` 读取布尔值：

```ts
const fullTextOnOpenEnabled = readBoolean(rssInput.fullTextOnOpenEnabled, false);
return { sources, fullTextOnOpenEnabled };
```

**Step 3: 运行测试确认通过**

Run:

```bash
pnpm run test:unit -- src/features/settings/settingsSchema.test.ts
```

Expected: PASS。

**Step 4: Commit**

```bash
git add src/types/index.ts src/features/settings/settingsSchema.ts src/features/settings/settingsSchema.test.ts
git commit -m "feat(settings): 增加全文抓取开关字段"
```

### Task 8: 在设置 UI 中加入开关（Appearance 面板）

**Files:**

- Modify: `src/features/settings/panels/AppearanceSettingsPanel.tsx`
- Test: `src/features/settings/SettingsCenterModal.test.tsx`

**Step 1: 增加一行设置项**

在 `AppearanceSettingsPanel` 的卡片中新增一段（参考“行高”那行的布局）：

```tsx
<div className="flex items-center justify-between gap-4 px-4 py-3.5">
  <div>
    <p className="text-sm font-medium text-foreground">打开文章时抓取全文</p>
    <p className="text-xs text-muted-foreground">开启后会访问原文链接并尝试抽取正文</p>
  </div>
  <div className="flex gap-1">
    <Button
      type="button"
      onClick={() =>
        onChange((nextDraft) => {
          nextDraft.persisted.rss.fullTextOnOpenEnabled = false;
        })
      }
      aria-pressed={!draft.persisted.rss.fullTextOnOpenEnabled}
      variant={!draft.persisted.rss.fullTextOnOpenEnabled ? 'default' : 'outline'}
      size="sm"
      className="h-8 w-14 rounded-lg px-0"
    >
      关闭
    </Button>
    <Button
      type="button"
      onClick={() =>
        onChange((nextDraft) => {
          nextDraft.persisted.rss.fullTextOnOpenEnabled = true;
        })
      }
      aria-pressed={draft.persisted.rss.fullTextOnOpenEnabled}
      variant={draft.persisted.rss.fullTextOnOpenEnabled ? 'default' : 'outline'}
      size="sm"
      className="h-8 w-14 rounded-lg px-0"
    >
      开启
    </Button>
  </div>
</div>
```

**Step 2: 增加 UI 测试（避免回归）**

在 `src/features/settings/SettingsCenterModal.test.tsx` 增加用例：

```ts
it('toggles fulltext on open setting', async () => {
  resetSettingsStore();
  render(<ReaderLayout />);
  fireEvent.click(screen.getByLabelText('open-settings'));

  await waitFor(() => {
    expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
  });

  expect(screen.getByText('打开文章时抓取全文')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '开启' }));
  expect(useSettingsStore.getState().draft?.persisted.rss.fullTextOnOpenEnabled).toBe(true);
});
```

**Step 3: 运行测试**

Run:

```bash
pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx
```

Expected: PASS。

**Step 4: Commit**

```bash
git add src/features/settings/panels/AppearanceSettingsPanel.tsx src/features/settings/SettingsCenterModal.test.tsx
git commit -m "feat(ui): 设置页增加全文抓取开关"
```

---

## Phase 4：队列 + API（触发抓取任务）

### Task 9: 新增 job 常量（先红后绿）

**Files:**

- Modify: `src/server/queue/jobs.test.ts`
- Modify: `src/server/queue/jobs.ts`

**Step 1: 先改测试（先红）**

在 `jobs.test.ts` 增加断言：

```ts
import { JOB_ARTICLE_FULLTEXT_FETCH } from './jobs';

expect(JOB_ARTICLE_FULLTEXT_FETCH).toBe('article.fetch_fulltext');
```

**Step 2: 运行测试确认失败**

Run:

```bash
pnpm run test:unit -- src/server/queue/jobs.test.ts
```

Expected: FAIL（常量不存在）。

**Step 3: 增加常量实现（转绿）**

在 `src/server/queue/jobs.ts`：

```ts
export const JOB_ARTICLE_FULLTEXT_FETCH = 'article.fetch_fulltext';
```

**Step 4: 运行测试**

Run:

```bash
pnpm run test:unit -- src/server/queue/jobs.test.ts
```

Expected: PASS。

**Step 5: Commit**

```bash
git add src/server/queue/jobs.ts src/server/queue/jobs.test.ts
git commit -m "feat(queue): 增加全文抓取任务名"
```

### Task 10: 增加 `POST /api/articles/:id/fulltext`（TDD）

**Files:**

- Create: `src/app/api/articles/[id]/fulltext/route.ts`
- Modify: `src/app/api/articles/routes.test.ts`

**Step 1: 先写测试（覆盖开关/无 link/重复入队/成功入队）**

在 `routes.test.ts` 顶部添加 mock：

- `getUiSettings`（来自 `settingsRepo`）
- `enqueue`（来自 `server/queue/queue`）

并补齐多层路径的 `vi.mock`（参考 feeds 的测试写法，确保覆盖到 `../../../../../...` 这一级）。

新增用例示例（核心断言）：当设置开关关闭时返回 `{ enqueued: false }` 且不调用 `enqueue`。

**Step 2: 运行测试确认失败**

Run:

```bash
pnpm run test:unit -- src/app/api/articles/routes.test.ts
```

Expected: FAIL（route 文件不存在/逻辑未实现）。

**Step 3: 实现 route**

实现要点（保持与现有路由风格一致）：

- `runtime = 'nodejs'`、`dynamic = 'force-dynamic'`
- 校验 `id` 为 uuid
- 读取 `ui_settings` 并 `normalizePersistedSettings(...)`
- 条件不满足时返回 `ok({ enqueued: false })`
- 满足时调用：

```ts
const jobId = await enqueue(JOB_ARTICLE_FULLTEXT_FETCH, { articleId }, { singletonKey: articleId, singletonSeconds: 600 });
```

并返回 `ok({ enqueued: true, jobId })`

**Step 4: 运行测试确认通过**

Run:

```bash
pnpm run test:unit -- src/app/api/articles/routes.test.ts
```

Expected: PASS。

**Step 5: Commit**

```bash
git add src/app/api/articles/[id]/fulltext/route.ts src/app/api/articles/routes.test.ts
git commit -m "feat(api): 支持文章全文抓取入队"
```

---

## Phase 5：全文抽取模块 + worker

### Task 11: 安装 Readability 依赖

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Step 1: 安装**

Run:

```bash
pnpm add @mozilla/readability
```

**Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build(deps): 添加 Readability 依赖"
```

### Task 12: 新增全文抽取函数（先测后写）

**Files:**

- Create: `src/server/fulltext/extractFulltext.ts`
- Create: `src/server/fulltext/extractFulltext.test.ts`

**Step 1: 写测试（先红）**

```ts
import { describe, expect, it } from 'vitest';
import { extractFulltext } from './extractFulltext';

describe('extractFulltext', () => {
  it('extracts main content via Readability', () => {
    const html = `
      <html><head><title>T</title></head>
      <body>
        <header>nav</header>
        <main>
          <article><h1>Hello</h1><p>World</p></article>
        </main>
      </body></html>
    `;
    const result = extractFulltext({ html, url: 'https://example.com/a' });
    expect(result?.contentHtml).toContain('World');
  });
});
```

Run:

```bash
pnpm run test:unit -- src/server/fulltext/extractFulltext.test.ts
```

Expected: FAIL（函数不存在）。

**Step 2: 实现 `extractFulltext`（转绿）**

```ts
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export function extractFulltext(input: { html: string; url: string }): { contentHtml: string; title: string | null } | null {
  const dom = new JSDOM(input.html, { url: input.url });
  const reader = new Readability(dom.window.document);
  const parsed = reader.parse();
  if (!parsed?.content) return null;
  return {
    contentHtml: parsed.content,
    title: typeof parsed.title === 'string' ? parsed.title : null,
  };
}
```

Run:

```bash
pnpm run test:unit -- src/server/fulltext/extractFulltext.test.ts
```

Expected: PASS。

**Step 3: Commit**

```bash
git add src/server/fulltext/extractFulltext.ts src/server/fulltext/extractFulltext.test.ts
git commit -m "feat(fulltext): 增加 Readability 抽取函数"
```

### Task 13: worker 实现抓取 + 抽取 + 落库

**Files:**

- Modify: `src/worker/index.ts`
- Create: `src/server/fulltext/fetchFulltextAndStore.ts`
- Create: `src/server/fulltext/fetchFulltextAndStore.test.ts`
- Modify: `src/server/repositories/articlesRepo.ts`

**Step 1: 先写模块测试（先红）**

目标：mock `fetch` 返回 HTML，验证会调用 `setArticleFulltext` 写库（用 pool.query mock 或直接 mock `articlesRepo`）。

**Step 2: 实现 `fetchFulltextAndStore`**

实现要点（必须有）：

- `isSafeExternalUrl(link)` 校验（含最终 `res.url`）
- 超时：复用 `app_settings.rss_timeout_ms`（或另设常量例如 10_000）
- 限制响应体大小：实现 `readTextWithLimit(res, maxBytes)`
- Content-Type 必须包含 `text/html`
- `extractFulltext` 抽取
- `sanitizeContent(extractedHtml, { baseUrl: res.url })` 清洗
- 成功：`setArticleFulltext(...)`
- 失败：`setArticleFulltextError(...)`（error message 简短，不要堆栈）

**Step 3: 在 worker 注册 job**

在 `src/worker/index.ts`：

- `import { JOB_ARTICLE_FULLTEXT_FETCH } from '../server/queue/jobs'`
- `await boss.createQueue(JOB_ARTICLE_FULLTEXT_FETCH)`
- `await boss.work(JOB_ARTICLE_FULLTEXT_FETCH, ...)` 解析 `articleId` 并调用 `fetchFulltextAndStore(...)`

**Step 4: 运行单测**

Run:

```bash
pnpm run test:unit
```

Expected: PASS。

**Step 5: Commit**

```bash
git add src/server/fulltext/fetchFulltextAndStore.ts src/server/fulltext/fetchFulltextAndStore.test.ts src/worker/index.ts src/server/repositories/articlesRepo.ts
git commit -m "feat(worker): 支持文章全文抓取"
```

---

## Phase 6：前端联动（触发 + 轮询刷新 + 展示全文）

### Task 14: API client 扩展（TDD）

**Files:**

- Modify: `src/lib/apiClient.ts`
- Modify: `src/lib/apiClient.test.ts`

**Step 1: 先写测试：`mapArticleDto` 优先使用 `contentFullHtml`**

```ts
import { describe, expect, it } from 'vitest';
import { mapArticleDto } from './apiClient';

it('mapArticleDto prefers contentFullHtml', () => {
  const mapped = mapArticleDto({
    id: 'a',
    feedId: 'f',
    dedupeKey: 'k',
    title: 't',
    link: 'https://example.com',
    author: null,
    publishedAt: null,
    contentHtml: '<p>rss</p>',
    contentFullHtml: '<p>full</p>',
    contentFullFetchedAt: null,
    contentFullError: null,
    contentFullSourceUrl: null,
    summary: null,
    isRead: false,
    readAt: null,
    isStarred: false,
    starredAt: null,
  });
  expect(mapped.content).toContain('full');
});
```

Run:

```bash
pnpm run test:unit -- src/lib/apiClient.test.ts
```

Expected: FAIL（类型/实现未更新）。

**Step 2: 实现**

- 扩展 `ArticleDto` 类型：增加 `contentFullHtml/contentFullFetchedAt/contentFullError/contentFullSourceUrl`
- 增加 API 方法：

```ts
export async function enqueueArticleFulltext(articleId: string): Promise<{ enqueued: boolean; jobId?: string }> {
  return requestApi(`/api/articles/${encodeURIComponent(articleId)}/fulltext`, { method: 'POST' });
}
```

- 更新 `mapArticleDto`：

```ts
content: dto.contentFullHtml ?? dto.contentHtml ?? '',
```

**Step 3: 运行测试**

Run:

```bash
pnpm run test:unit -- src/lib/apiClient.test.ts
```

Expected: PASS。

**Step 4: Commit**

```bash
git add src/lib/apiClient.ts src/lib/apiClient.test.ts
git commit -m "feat(client): 支持全文字段与入队接口"
```

### Task 15: 前端打开文章触发入队 + 轮询刷新

**Files:**

- Modify: `src/features/articles/ArticleView.tsx`
- Modify: `src/store/appStore.ts`

**Step 1: 在 store 增加“强制刷新文章详情”的方法**

为避免 `setSelectedArticle` 因 `article.content` 非空而跳过后续请求，新增一个方法（示例名）：`refreshArticle(articleId: string): Promise<{ hasFulltext: boolean }>`

实现思路：

- 永远调用 `getArticle(articleId)`
- 根据 dto 的 `contentFullHtml` 得到 `hasFulltext`
- `mapArticleDto` 后 upsert 到 store
- 返回 `{ hasFulltext }`

**Step 2: 在 `ArticleView` 增加 effect**

当满足以下条件时执行：

- 有 `article` 且有 `selectedArticleId`
- 设置开关 `useSettingsStore(...).persistedSettings.rss.fullTextOnOpenEnabled === true`
- `article.link` 存在（否则不触发）

流程：

1) `enqueueArticleFulltext(article.id)`（忽略失败，不阻塞阅读）
2) 启动短轮询（建议：最多 10~15 次，每次间隔 1000ms）：
   - 每次调用 `refreshArticle(article.id)`
   - 若返回 `hasFulltext === true`，停止轮询
   - cleanup 时停止（用户切换文章/关闭视图）

**Step 3: 运行单测 + 手动冒烟**

Run:

```bash
pnpm run test:unit
```

Manual (推荐 docker-compose 验证)：

```bash
docker-compose up --build
```

- 开启设置项“打开文章时抓取全文”
- 打开一篇 RSS 摘要文章：先显示摘要，几秒内自动切换为全文（若源站可抽取）

**Step 4: Commit**

```bash
git add src/features/articles/ArticleView.tsx src/store/appStore.ts
git commit -m "feat(reader): 打开文章按需抓取全文"
```

---

## Phase 7：收尾验证

### Task 16: 全量验证

Run:

```bash
pnpm run lint
pnpm run test:unit
pnpm run build
```

Expected: 全部 PASS。

---

## 完成交接

计划已写完并保存在 `docs/plans/2026-02-26-rss-fulltext-implementation-plan.md`。

两种执行方式二选一：

1) **Sequential（本 session）**：我按 Task 逐个实现，每个 Task 完成后你确认再继续  
2) **Sequential（新 session）**：你在新 session 里用 `workflow-executing-plans` 按批次执行并检查点验收

你选 1 还是 2？


# 文章异步任务（全文/AI 摘要/AI 翻译）状态、轮询与错误反馈重构 Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 为文章的 `fulltext` / `ai_summary` / `ai_translate` 引入持久化任务状态（含错误码/错误信息），新增轻量状态接口 `GET /api/articles/:id/tasks`，并将前端轮询从 `GET /api/articles/:id` 切换为轮询小 payload（含 backoff + 可取消），最终只在任务成功后刷新一次文章详情。

**Architecture:** 后端新增表 `article_tasks` + repository `articleTasksRepo`，enqueue routes 在入队时写入 `queued`，worker 在执行阶段写入 `running/succeeded/failed` 并持久化稳定错误码；前端新增 `getArticleTasks` API client + 轮询器，文章页基于任务状态展示 loading/error/retry，并避免用“大接口”做 1Hz 轮询。

**Tech Stack:** Next.js App Router（`src/app/api/...`，`runtime = 'nodejs'`）、TypeScript、Postgres（SQL migrations：`src/server/db/migrations/*.sql`）、pg-boss（`src/worker/index.ts`）、Vitest（`pnpm run test:unit`）、React（`src/features/articles/ArticleView.tsx`）。

---

## References / 前置说明

- 需求/设计文档：`docs/plans/2026-03-04-async-tasks-refactor-design.md`
- 迁移执行脚本：`scripts/db/migrate.mjs`（通过 `DATABASE_URL` 执行 SQL migrations）
- 本仓库未发现 `docs/summaries/`（已检查），因此本计划暂无可链接的历史总结。
- 建议在独立 worktree 中实现与执行本计划（避免污染当前工作目录）；如需创建 worktree，可用 `workflow-using-git-worktrees`。

## 任务与状态约定（在实现前先统一口径）

- `article_tasks.type`：`fulltext` / `ai_summary` / `ai_translate`
- `article_tasks.status`（DB 存储值）：`queued` / `running` / `succeeded` / `failed`
- API 暴露的 status：在 DB 值基础上补充 `idle`（**无记录 = idle**）
- `GET /api/articles/:id/tasks` 返回固定 shape（前端无需额外 join）：

```ts
type ArticleTaskType = 'fulltext' | 'ai_summary' | 'ai_translate';
type ArticleTaskStatus = 'idle' | 'queued' | 'running' | 'succeeded' | 'failed';

type ArticleTaskDto = {
  type: ArticleTaskType;
  status: ArticleTaskStatus;
  jobId: string | null;
  requestedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  attempts: number;
  errorCode: string | null;
  errorMessage: string | null;
};

type ArticleTasksDto = {
  fulltext: ArticleTaskDto;
  ai_summary: ArticleTaskDto;
  ai_translate: ArticleTaskDto;
};
```

---

### Task 1: 新增 `article_tasks` SQL migration（含唯一约束/索引）

**Files:**

- Create: `src/server/db/migrations/0013_article_tasks.sql`
- Test: `src/server/db/migrations/articleTasksMigration.test.ts`

**Step 1: 写一个会失败的 migration 单测（文件尚不存在）**

Create `src/server/db/migrations/articleTasksMigration.test.ts`：

```ts
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('db migrations', () => {
  it('adds article_tasks table', () => {
    const migrationPath = 'src/server/db/migrations/0013_article_tasks.sql';
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('create table if not exists article_tasks');
    expect(sql).toContain('article_id');
    expect(sql).toContain('on delete cascade');
    expect(sql).toContain('job_id');
    expect(sql).toContain('error_code');
    expect(sql).toContain('error_message');
    expect(sql).toContain('article_tasks_article_id_type_unique');
  });
});
```

**Step 2: 运行单测验证失败**

Run: `pnpm run test:unit src/server/db/migrations/articleTasksMigration.test.ts`

Expected: FAIL（`existsSync(...)` 断言失败或类似 “file not found”）。

**Step 3: 添加 migration SQL**

Create `src/server/db/migrations/0013_article_tasks.sql`：

```sql
create table if not exists article_tasks (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  type text not null,
  status text not null,
  job_id text null,
  requested_at timestamptz null,
  started_at timestamptz null,
  finished_at timestamptz null,
  attempts int not null default 0,
  error_code text null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint article_tasks_status_check check (status in ('queued', 'running', 'succeeded', 'failed'))
);

create unique index if not exists article_tasks_article_id_type_unique on article_tasks (article_id, type);
create index if not exists article_tasks_article_id_idx on article_tasks (article_id);
create index if not exists article_tasks_status_updated_at_idx on article_tasks (status, updated_at desc);
```

**Step 4: 运行单测验证通过**

Run: `pnpm run test:unit src/server/db/migrations/articleTasksMigration.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/db/migrations/0013_article_tasks.sql src/server/db/migrations/articleTasksMigration.test.ts
git commit -m "feat(db): add article_tasks table"
```

---

### Task 2: 新增 `articleTasksRepo`（upsert 状态 + 查询）

**Files:**

- Create: `src/server/repositories/articleTasksRepo.ts`
- Test: `src/server/repositories/articleTasksRepo.test.ts`

**Step 1: 写一个会失败的单测（模块尚不存在）**

Create `src/server/repositories/articleTasksRepo.test.ts`：

```ts
import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

describe('articleTasksRepo', () => {
  it('getArticleTasksByArticleId selects expected columns', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./articleTasksRepo')) as typeof import('./articleTasksRepo');

    await mod.getArticleTasksByArticleId(pool, 'a1');

    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('from article_tasks');
    expect(sql).toContain('error_code');
    expect(sql).toContain('error_message');
    expect(sql).toContain('requested_at');
    expect(sql).toContain('started_at');
    expect(sql).toContain('finished_at');
  });

  it('upsertTaskFailed increments attempts and sets updated_at', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./articleTasksRepo')) as typeof import('./articleTasksRepo');

    await mod.upsertTaskFailed(pool, {
      articleId: 'a1',
      type: 'ai_summary',
      jobId: 'job-1',
      errorCode: 'ai_timeout',
      errorMessage: 'timeout',
    });

    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('insert into article_tasks');
    expect(sql).toContain('on conflict (article_id, type) do update');
    expect(sql).toContain('attempts');
    expect(sql).toContain('updated_at = now()');
  });
});
```

**Step 2: 运行单测验证失败**

Run: `pnpm run test:unit src/server/repositories/articleTasksRepo.test.ts`

Expected: FAIL（`Cannot find module './articleTasksRepo'` 或类似错误）。

**Step 3: 实现最小 repository**

Create `src/server/repositories/articleTasksRepo.ts`：

```ts
import type { Pool } from 'pg';

export type ArticleTaskType = 'fulltext' | 'ai_summary' | 'ai_translate';
export type ArticleTaskStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface ArticleTaskRow {
  id: string;
  articleId: string;
  type: ArticleTaskType;
  status: ArticleTaskStatus;
  jobId: string | null;
  requestedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  attempts: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getArticleTasksByArticleId(
  pool: Pool,
  articleId: string,
): Promise<ArticleTaskRow[]> {
  const { rows } = await pool.query<ArticleTaskRow>(
    `
      select
        id,
        article_id as "articleId",
        type,
        status,
        job_id as "jobId",
        requested_at as "requestedAt",
        started_at as "startedAt",
        finished_at as "finishedAt",
        attempts,
        error_code as "errorCode",
        error_message as "errorMessage",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from article_tasks
      where article_id = $1
    `,
    [articleId],
  );
  return rows;
}

async function upsertBase(
  pool: Pool,
  input: {
    articleId: string;
    type: ArticleTaskType;
    status: ArticleTaskStatus;
    jobId: string | null;
    requestedAt?: 'now' | 'keep' | 'null';
    startedAt?: 'now' | 'keep' | 'null';
    finishedAt?: 'now' | 'keep' | 'null';
    attempts?: 'inc' | number | 'keep';
    errorCode?: string | null;
    errorMessage?: string | null;
    clearError?: boolean;
  },
): Promise<void> {
  const requestedAtSql =
    input.requestedAt === 'now' ? 'now()' : input.requestedAt === 'null' ? 'null' : 'article_tasks.requested_at';
  const startedAtSql =
    input.startedAt === 'now' ? 'now()' : input.startedAt === 'null' ? 'null' : 'article_tasks.started_at';
  const finishedAtSql =
    input.finishedAt === 'now' ? 'now()' : input.finishedAt === 'null' ? 'null' : 'article_tasks.finished_at';
  const attemptsSql =
    input.attempts === 'inc'
      ? 'article_tasks.attempts + 1'
      : typeof input.attempts === 'number'
        ? String(input.attempts)
        : 'article_tasks.attempts';

  const errorCode = input.clearError ? null : (input.errorCode ?? null);
  const errorMessage = input.clearError ? null : (input.errorMessage ?? null);

  await pool.query(
    `
      insert into article_tasks (
        article_id,
        type,
        status,
        job_id,
        requested_at,
        started_at,
        finished_at,
        attempts,
        error_code,
        error_message,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, now(), null, null, 0, null, null, now(), now())
      on conflict (article_id, type) do update
      set
        status = $3,
        job_id = coalesce($4, article_tasks.job_id),
        requested_at = ${requestedAtSql},
        started_at = ${startedAtSql},
        finished_at = ${finishedAtSql},
        attempts = ${attemptsSql},
        error_code = $5,
        error_message = $6,
        updated_at = now()
    `,
    [
      input.articleId,
      input.type,
      input.status,
      input.jobId,
      errorCode,
      errorMessage,
    ],
  );
}

export async function upsertTaskQueued(
  pool: Pool,
  input: { articleId: string; type: ArticleTaskType; jobId: string | null },
): Promise<void> {
  await upsertBase(pool, {
    articleId: input.articleId,
    type: input.type,
    status: 'queued',
    jobId: input.jobId,
    requestedAt: 'now',
    startedAt: 'null',
    finishedAt: 'null',
    attempts: 'keep',
    clearError: true,
  });
}

export async function upsertTaskRunning(
  pool: Pool,
  input: { articleId: string; type: ArticleTaskType; jobId: string | null },
): Promise<void> {
  await upsertBase(pool, {
    articleId: input.articleId,
    type: input.type,
    status: 'running',
    jobId: input.jobId,
    requestedAt: 'keep',
    startedAt: 'now',
    finishedAt: 'null',
    attempts: 'keep',
    clearError: false,
  });
}

export async function upsertTaskSucceeded(
  pool: Pool,
  input: { articleId: string; type: ArticleTaskType; jobId: string | null },
): Promise<void> {
  await upsertBase(pool, {
    articleId: input.articleId,
    type: input.type,
    status: 'succeeded',
    jobId: input.jobId,
    requestedAt: 'keep',
    startedAt: 'keep',
    finishedAt: 'now',
    attempts: 'keep',
    clearError: true,
  });
}

export async function upsertTaskFailed(
  pool: Pool,
  input: {
    articleId: string;
    type: ArticleTaskType;
    jobId: string | null;
    errorCode: string;
    errorMessage: string;
  },
): Promise<void> {
  await upsertBase(pool, {
    articleId: input.articleId,
    type: input.type,
    status: 'failed',
    jobId: input.jobId,
    requestedAt: 'keep',
    startedAt: 'keep',
    finishedAt: 'now',
    attempts: 'inc',
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    clearError: false,
  });
}
```

> 注意：上面 `upsertBase` 的 SQL 是“能跑通 + 好读”的最小实现；如果你觉得太复杂，可以拆成 4 个显式 SQL（queued/running/succeeded/failed）来提升可维护性，但要保持 `updated_at = now()` 与 `on conflict (article_id, type)` 的幂等语义。

**Step 4: 运行单测验证通过**

Run: `pnpm run test:unit src/server/repositories/articleTasksRepo.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/repositories/articleTasksRepo.ts src/server/repositories/articleTasksRepo.test.ts
git commit -m "feat(server): add articleTasksRepo"
```

---

### Task 3: 新增稳定错误码映射 `errorMapping`

**Files:**

- Create: `src/server/tasks/errorMapping.ts`
- Test: `src/server/tasks/errorMapping.test.ts`

**Step 1: 写一个会失败的单测（模块尚不存在）**

Create `src/server/tasks/errorMapping.test.ts`：

```ts
import { describe, expect, it } from 'vitest';

describe('errorMapping', () => {
  it('maps Fulltext pending to fulltext_pending', async () => {
    const mod = await import('./errorMapping');
    expect(mod.mapTaskError({ type: 'ai_summary', err: new Error('Fulltext pending') })).toEqual({
      errorCode: 'fulltext_pending',
      errorMessage: expect.any(String),
    });
  });

  it('maps AbortError to ai_timeout', async () => {
    const mod = await import('./errorMapping');
    const err = new Error('aborted');
    (err as { name?: string }).name = 'AbortError';
    expect(mod.mapTaskError({ type: 'ai_translate', err })).toEqual({
      errorCode: 'ai_timeout',
      errorMessage: expect.any(String),
    });
  });

  it('maps fulltext Non-HTML response to fetch_non_html', async () => {
    const mod = await import('./errorMapping');
    expect(mod.mapTaskError({ type: 'fulltext', err: 'Non-HTML response' }).errorCode).toBe(
      'fetch_non_html',
    );
  });
});
```

**Step 2: 运行单测验证失败**

Run: `pnpm run test:unit src/server/tasks/errorMapping.test.ts`

Expected: FAIL（`Cannot find module './errorMapping'`）。

**Step 3: 实现最小错误码映射**

Create `src/server/tasks/errorMapping.ts`：

```ts
import type { ArticleTaskType } from '../repositories/articleTasksRepo';

function toSafeMessage(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 200);
}

function getErrorText(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || err.name || 'Unknown error';
  return 'Unknown error';
}

export function mapTaskError(input: {
  type: ArticleTaskType;
  err: unknown;
}): { errorCode: string; errorMessage: string } {
  const text = getErrorText(input.err);
  const safe = toSafeMessage(text);

  // Shared / cross-task
  if (safe === 'Fulltext pending') {
    return { errorCode: 'fulltext_pending', errorMessage: '全文未就绪，请稍后重试' };
  }

  if (input.type === 'fulltext') {
    if (safe === 'timeout') return { errorCode: 'fetch_timeout', errorMessage: '抓取超时' };
    if (/^HTTP\s+\d+/.test(safe)) return { errorCode: 'fetch_http_error', errorMessage: safe };
    if (safe === 'Non-HTML response') {
      return { errorCode: 'fetch_non_html', errorMessage: '响应不是 HTML' };
    }
    if (safe === 'Unsafe URL') return { errorCode: 'ssrf_blocked', errorMessage: 'URL 不安全' };
    if (safe === 'Readability parse failed') {
      return { errorCode: 'parse_failed', errorMessage: '正文解析失败' };
    }
    return { errorCode: 'unknown_error', errorMessage: safe || 'Unknown error' };
  }

  // AI summarize / translate
  if (input.err instanceof Error) {
    const name = typeof (input.err as { name?: unknown }).name === 'string' ? (input.err as { name: string }).name : '';
    if (name === 'AbortError') return { errorCode: 'ai_timeout', errorMessage: '请求超时' };
  }

  if (/429|rate limit/i.test(safe)) return { errorCode: 'ai_rate_limited', errorMessage: '请求过于频繁，请稍后重试' };
  if (/401|unauthorized|api key/i.test(safe)) return { errorCode: 'ai_invalid_config', errorMessage: 'AI 配置无效，请检查 API Key' };
  if (/Invalid .*response/i.test(safe)) return { errorCode: 'ai_bad_response', errorMessage: 'AI 响应异常，请稍后重试' };

  return { errorCode: 'unknown_error', errorMessage: safe || 'Unknown error' };
}
```

**Step 4: 运行单测验证通过**

Run: `pnpm run test:unit src/server/tasks/errorMapping.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/tasks/errorMapping.ts src/server/tasks/errorMapping.test.ts
git commit -m "feat(server): add task error mapping"
```

---

### Task 4: 新增轻量接口 `GET /api/articles/:id/tasks`

**Files:**

- Create: `src/app/api/articles/[id]/tasks/route.ts`
- Modify: `src/app/api/articles/routes.test.ts`

**Step 1: 在 route 测试中先写失败用例（接口尚不存在）**

Update `src/app/api/articles/routes.test.ts`：

1) 在顶部添加 mock：

```ts
const getArticleTasksByArticleIdMock = vi.fn();

vi.mock('../../../../../server/repositories/articleTasksRepo', () => ({
  getArticleTasksByArticleId: (...args: unknown[]) => getArticleTasksByArticleIdMock(...args),
}));
```

2) 添加测试用例（放在 `/api/articles` describe 内）：

```ts
it('GET /:id/tasks returns idle when no task rows', async () => {
  getArticleByIdMock.mockResolvedValue({
    id: articleId,
    feedId,
    dedupeKey: 'guid:1',
    title: 'Hello',
    titleOriginal: 'Hello',
    titleZh: null,
    titleTranslationModel: null,
    titleTranslationAttempts: 0,
    titleTranslationError: null,
    titleTranslatedAt: null,
    link: 'https://example.com/a',
    author: null,
    publishedAt: null,
    contentHtml: '<p>rss</p>',
    contentFullHtml: null,
    contentFullFetchedAt: null,
    contentFullError: null,
    contentFullSourceUrl: null,
    aiSummary: null,
    aiSummaryModel: null,
    aiSummarizedAt: null,
    aiTranslationBilingualHtml: null,
    aiTranslationZhHtml: null,
    aiTranslationModel: null,
    aiTranslatedAt: null,
    summary: null,
    isRead: false,
    readAt: null,
    isStarred: false,
    starredAt: null,
  });
  getArticleTasksByArticleIdMock.mockResolvedValue([]);

  const mod = await import('./[id]/tasks/route');
  const res = await mod.GET(new Request(`http://localhost/api/articles/${articleId}/tasks`), {
    params: Promise.resolve({ id: articleId }),
  });
  const json = await res.json();

  expect(json.ok).toBe(true);
  expect(json.data.fulltext.status).toBe('idle');
  expect(json.data.ai_summary.status).toBe('idle');
  expect(json.data.ai_translate.status).toBe('idle');
});
```

**Step 2: 运行该测试验证失败**

Run: `pnpm run test:unit src/app/api/articles/routes.test.ts`

Expected: FAIL（`Cannot find module './[id]/tasks/route'` 或 mock 未命中）。

**Step 3: 实现 tasks route**

Create `src/app/api/articles/[id]/tasks/route.ts`：

```ts
import { z } from 'zod';
import { getPool } from '../../../../../server/db/pool';
import { ok, fail } from '../../../../../server/http/apiResponse';
import { NotFoundError, ValidationError } from '../../../../../server/http/errors';
import { getArticleById } from '../../../../../server/repositories/articlesRepo';
import { getArticleTasksByArticleId } from '../../../../../server/repositories/articleTasksRepo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

function zodIssuesToFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'body';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

function idleTask(type: 'fulltext' | 'ai_summary' | 'ai_translate') {
  return {
    type,
    status: 'idle' as const,
    jobId: null as string | null,
    requestedAt: null as string | null,
    startedAt: null as string | null,
    finishedAt: null as string | null,
    attempts: 0,
    errorCode: null as string | null,
    errorMessage: null as string | null,
  };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) {
      return fail(new ValidationError('Invalid route params', zodIssuesToFields(parsed.error)));
    }

    const pool = getPool();
    const article = await getArticleById(pool, parsed.data.id);
    if (!article) return fail(new NotFoundError('Article not found'));

    const rows = await getArticleTasksByArticleId(pool, parsed.data.id);
    const byType = new Map(rows.map((row) => [row.type, row]));

    const fulltext = byType.get('fulltext');
    const aiSummary = byType.get('ai_summary');
    const aiTranslate = byType.get('ai_translate');

    const data = {
      fulltext: fulltext
        ? { ...fulltext, status: fulltext.status }
        : idleTask('fulltext'),
      ai_summary: aiSummary
        ? { ...aiSummary, status: aiSummary.status }
        : idleTask('ai_summary'),
      ai_translate: aiTranslate
        ? { ...aiTranslate, status: aiTranslate.status }
        : idleTask('ai_translate'),
    };

    // 将 DB status 扩展到 API status（缺失记录 => idle）
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}
```

> 注意：上面直接把 `ArticleTaskRow` 展开返回是可行的，但你可能希望显式映射字段名（比如把 `articleId/id/createdAt/updatedAt` 去掉）以保持 payload 小且稳定；建议在实现时对返回 DTO 做一次 “白名单字段映射”。

**Step 4: 运行单测验证通过**

Run: `pnpm run test:unit src/app/api/articles/routes.test.ts`

Expected: PASS（至少新增用例通过，其他用例也应保持通过）。

**Step 5: Commit**

```bash
git add src/app/api/articles/[id]/tasks/route.ts src/app/api/articles/routes.test.ts
git commit -m "feat(api): add article tasks status endpoint"
```

---

### Task 5: enqueue `POST /:id/ai-summary` 写入 `article_tasks`（queued/jobId）

**Files:**

- Modify: `src/app/api/articles/[id]/ai-summary/route.ts`
- Modify: `src/app/api/articles/routes.test.ts`

**Step 1: 先在测试里写一个失败断言（新增 repo 调用）**

Update `src/app/api/articles/routes.test.ts`：

- 在 `beforeEach` 中 `getArticleTasksByArticleIdMock.mockReset()`（如你在 Task 4 增加了 mock）。
- 添加 mock：`const upsertTaskQueuedMock = vi.fn();` 并在 `vi.mock('../../../../../server/repositories/articleTasksRepo', ...)` 里同时导出：

```ts
upsertTaskQueued: (...args: unknown[]) => upsertTaskQueuedMock(...args),
```

- 在现有用例 `it('POST /:id/ai-summary enqueues summarize job', ...)` 末尾增加：

```ts
expect(upsertTaskQueuedMock).toHaveBeenCalledWith(pool, {
  articleId,
  type: 'ai_summary',
  jobId: 'job-id-1',
});
```

**Step 2: 运行测试验证失败**

Run: `pnpm run test:unit src/app/api/articles/routes.test.ts`

Expected: FAIL（`upsertTaskQueuedMock` 未被调用）。

**Step 3: 实现 route 写入 queued**

Update `src/app/api/articles/[id]/ai-summary/route.ts`：

- 新增 import：

```ts
import { upsertTaskQueued } from '../../../../../server/repositories/articleTasksRepo';
```

- 在成功拿到 `jobId` 后写入任务表（最小实现）：

```ts
const jobId = await enqueue(...);
await upsertTaskQueued(pool, { articleId, type: 'ai_summary', jobId });
return ok({ enqueued: true, jobId });
```

> 建议：在 `enqueue(...)` 前也先 `await upsertTaskQueued(...jobId: null)`，这样即使 job 由于 singleton 已存在而 enqueue 失败，也能保证任务行存在，前端可轮询；是否需要该 “双写” 由你决定，但要避免把 `running` 降级回 `queued`（repo SQL 需兼容）。

**Step 4: 运行测试验证通过**

Run: `pnpm run test:unit src/app/api/articles/routes.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/articles/[id]/ai-summary/route.ts src/app/api/articles/routes.test.ts
git commit -m "feat(api): persist ai_summary task on enqueue"
```

---

### Task 6: enqueue `POST /:id/ai-translate` 写入 `article_tasks`（queued/jobId）

**Files:**

- Modify: `src/app/api/articles/[id]/ai-translate/route.ts`
- Modify: `src/app/api/articles/routes.test.ts`

**Step 1: 先在测试里写一个失败断言**

在现有用例 `it('POST /:id/ai-translate enqueues translate job', ...)`（如果没有就新增一个）里加入：

```ts
expect(upsertTaskQueuedMock).toHaveBeenCalledWith(pool, {
  articleId,
  type: 'ai_translate',
  jobId: 'job-id-1',
});
```

**Step 2: 运行测试验证失败**

Run: `pnpm run test:unit src/app/api/articles/routes.test.ts`

Expected: FAIL（未调用 upsert）。

**Step 3: 实现 route 写入 queued**

Update `src/app/api/articles/[id]/ai-translate/route.ts`：

- 新增 import：

```ts
import { upsertTaskQueued } from '../../../../../server/repositories/articleTasksRepo';
```

- enqueue 成功后：

```ts
const jobId = await enqueue(...);
await upsertTaskQueued(pool, { articleId, type: 'ai_translate', jobId });
return ok({ enqueued: true, jobId });
```

**Step 4: 运行测试验证通过**

Run: `pnpm run test:unit src/app/api/articles/routes.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/articles/[id]/ai-translate/route.ts src/app/api/articles/routes.test.ts
git commit -m "feat(api): persist ai_translate task on enqueue"
```

---

### Task 7: enqueue `POST /:id/fulltext` 写入 `article_tasks`（queued/jobId）

**Files:**

- Modify: `src/app/api/articles/[id]/fulltext/route.ts`
- Modify: `src/app/api/articles/routes.test.ts`

**Step 1: 先在测试里写一个失败断言**

在现有用例 `it('POST /:id/fulltext enqueues fetch job', ...)` 末尾加入：

```ts
expect(upsertTaskQueuedMock).toHaveBeenCalledWith(pool, {
  articleId,
  type: 'fulltext',
  jobId: 'job-id-1',
});
```

**Step 2: 运行测试验证失败**

Run: `pnpm run test:unit src/app/api/articles/routes.test.ts`

Expected: FAIL

**Step 3: 实现 route 写入 queued**

Update `src/app/api/articles/[id]/fulltext/route.ts`：

- 新增 import：

```ts
import { upsertTaskQueued } from '../../../../../server/repositories/articleTasksRepo';
```

- enqueue 成功后写：

```ts
const jobId = await enqueue(...);
await upsertTaskQueued(pool, { articleId, type: 'fulltext', jobId });
return ok({ enqueued: true, jobId });
```

**Step 4: 运行测试验证通过**

Run: `pnpm run test:unit src/app/api/articles/routes.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/articles/[id]/fulltext/route.ts src/app/api/articles/routes.test.ts
git commit -m "feat(api): persist fulltext task on enqueue"
```

---

### Task 8: worker 在执行阶段写入 `running/succeeded/failed`（含错误码与 attempts）

**Files:**

- Modify: `src/worker/index.ts`
- (Optional) Create: `src/worker/articleTaskStatus.ts`（把重复的 try/catch + status 更新抽成 helper，便于阅读）

**Step 1: 先写一个会失败的单测（推荐对 helper 测试，而不是直接测 worker）**

如果你选择新增 helper，Create `src/worker/articleTaskStatus.test.ts`：

```ts
import { describe, expect, it } from 'vitest';

describe('articleTaskStatus', () => {
  it('is a real module (smoke)', async () => {
    const mod = await import('./articleTaskStatus');
    expect(mod).toBeTruthy();
  });
});
```

Run: `pnpm run test:unit src/worker/articleTaskStatus.test.ts`

Expected: FAIL（模块不存在）。

**Step 2: 实现 helper（最小可用）**

Create `src/worker/articleTaskStatus.ts`（示例，可按需调整）：

```ts
import type { Pool } from 'pg';
import type { ArticleTaskType } from '../server/repositories/articleTasksRepo';
import {
  upsertTaskFailed,
  upsertTaskRunning,
  upsertTaskSucceeded,
} from '../server/repositories/articleTasksRepo';
import { mapTaskError } from '../server/tasks/errorMapping';

export async function runArticleTaskWithStatus<T>(input: {
  pool: Pool;
  articleId: string;
  type: ArticleTaskType;
  jobId: string | null;
  fn: () => Promise<T>;
}): Promise<T> {
  await upsertTaskRunning(input.pool, {
    articleId: input.articleId,
    type: input.type,
    jobId: input.jobId,
  });

  try {
    const result = await input.fn();
    await upsertTaskSucceeded(input.pool, {
      articleId: input.articleId,
      type: input.type,
      jobId: input.jobId,
    });
    return result;
  } catch (err) {
    const mapped = mapTaskError({ type: input.type, err });
    await upsertTaskFailed(input.pool, {
      articleId: input.articleId,
      type: input.type,
      jobId: input.jobId,
      errorCode: mapped.errorCode,
      errorMessage: mapped.errorMessage,
    });
    throw err;
  }
}
```

Run: `pnpm run test:unit src/worker/articleTaskStatus.test.ts`

Expected: PASS

**Step 3: 改 worker：fulltext job**

Update `src/worker/index.ts` 的 `JOB_ARTICLE_FULLTEXT_FETCH` handler：

- 目标：job 开始 -> `running`，结束后根据文章结果写 `succeeded` 或 `failed`（fulltext 的错误可能来自 `articles.content_full_error`）
- 简化策略（最少侵入）：
  1) 用 helper 包裹 `fetchFulltextAndStore(pool, articleId)`
  2) helper `succeeded` 后再读一次 `getArticleById(pool, articleId)`，若 `contentFullError` 非空，则把任务改成 `failed`（并抛错让 helper 走 failed），或在 helper 外额外处理

建议实现方式（伪代码，保持你自己的现有结构）：

```ts
await boss.work(JOB_ARTICLE_FULLTEXT_FETCH, async (jobs) => {
  const pool = getPool();
  for (const job of jobs) {
    const articleId = ...;
    if (!articleId) throw new Error('Missing articleId');

    await runArticleTaskWithStatus({
      pool,
      articleId,
      type: 'fulltext',
      jobId: String((job as { id?: unknown }).id ?? null),
      fn: async () => {
        await fetchFulltextAndStore(pool, articleId);
        const after = await getArticleById(pool, articleId);
        if (after?.contentFullError) {
          throw new Error(after.contentFullError);
        }
      },
    });
  }
});
```

**Step 4: 改 worker：ai summary job**

Update `JOB_AI_SUMMARIZE` handler：

- 把所有 “`continue` 跳过处理” 的分支变为：
  - 如果是 “已存在结果/无文章”等：直接 `succeeded`（让前端停止轮询）
  - 如果是 “缺少配置/无法执行/前置条件未满足（例如 Fulltext pending）”：抛错 -> `failed`（持久化 errorCode/message）

建议策略：

```ts
await runArticleTaskWithStatus({
  pool,
  articleId,
  type: 'ai_summary',
  jobId: String(job.id),
  fn: async () => {
    const article = await getArticleById(pool, articleId);
    if (!article) return;
    if (article.aiSummary?.trim()) return;

    const aiApiKey = await getAiApiKey(pool);
    if (!aiApiKey.trim()) throw new Error('Missing AI API key');

    const fullTextOnOpenEnabled = await getFeedFullTextOnOpenEnabled(pool, article.feedId);
    if (fullTextOnOpenEnabled === true && !article.contentFullHtml && !article.contentFullError) {
      throw new Error('Fulltext pending');
    }

    ... summarizeText + setArticleAiSummary ...
  },
});
```

**Step 5: 改 worker：ai translate job**

Update `JOB_AI_TRANSLATE` handler 同理：

- 将 `if (!apiKey) continue;` 改为 `throw new Error('Missing translation API key')`（或更具体）让任务失败可见
- 将 `if (!htmlSource?.trim()) continue;` 改为 `throw new Error('Missing article content')`（否则任务永远“成功但没产出”，前端无法判断）

**Step 6: 跑全量单测**

Run: `pnpm run test:unit`

Expected: PASS（如果失败，优先修 TypeScript/导入路径/vi.mock 冲突）。

**Step 7: Commit**

```bash
git add src/worker/index.ts src/worker/articleTaskStatus.ts src/worker/articleTaskStatus.test.ts
git commit -m "feat(worker): persist article task running/succeeded/failed"
```

---

### Task 9: 前端 API client 增加 `getArticleTasks`

**Files:**

- Modify: `src/lib/apiClient.ts`
- Modify: `src/lib/apiClient.test.ts`

**Step 1: 写一个会失败的单测（函数尚不存在）**

Update `src/lib/apiClient.test.ts` 添加：

```ts
it('getArticleTasks GETs /api/articles/:id/tasks', async () => {
  const fetchMock = vi.fn(async () => {
    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          fulltext: { type: 'fulltext', status: 'idle', jobId: null, requestedAt: null, startedAt: null, finishedAt: null, attempts: 0, errorCode: null, errorMessage: null },
          ai_summary: { type: 'ai_summary', status: 'idle', jobId: null, requestedAt: null, startedAt: null, finishedAt: null, attempts: 0, errorCode: null, errorMessage: null },
          ai_translate: { type: 'ai_translate', status: 'idle', jobId: null, requestedAt: null, startedAt: null, finishedAt: null, attempts: 0, errorCode: null, errorMessage: null },
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  });
  vi.stubGlobal('fetch', fetchMock);

  const { getArticleTasks } = await import('./apiClient');
  await getArticleTasks('00000000-0000-0000-0000-000000000000');

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/api/articles/00000000-0000-0000-0000-000000000000/tasks'),
    expect.objectContaining({}),
  );
});
```

Run: `pnpm run test:unit src/lib/apiClient.test.ts`

Expected: FAIL（`getArticleTasks` 未导出）。

**Step 2: 实现 `getArticleTasks` 与 DTO 类型**

Update `src/lib/apiClient.ts`（放在 `getArticle(...)` 附近）：

```ts
export type ArticleTaskType = 'fulltext' | 'ai_summary' | 'ai_translate';
export type ArticleTaskStatus = 'idle' | 'queued' | 'running' | 'succeeded' | 'failed';

export interface ArticleTaskDto {
  type: ArticleTaskType;
  status: ArticleTaskStatus;
  jobId: string | null;
  requestedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  attempts: number;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface ArticleTasksDto {
  fulltext: ArticleTaskDto;
  ai_summary: ArticleTaskDto;
  ai_translate: ArticleTaskDto;
}

export async function getArticleTasks(articleId: string): Promise<ArticleTasksDto> {
  return requestApi(`/api/articles/${encodeURIComponent(articleId)}/tasks`);
}
```

**Step 3: 运行单测验证通过**

Run: `pnpm run test:unit src/lib/apiClient.test.ts`

Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/apiClient.ts src/lib/apiClient.test.ts
git commit -m "feat(web): add getArticleTasks api client"
```

---

### Task 10: 新增轮询工具（backoff + 可取消）

**Files:**

- Create: `src/lib/polling.ts`
- Test: `src/lib/polling.test.ts`

**Step 1: 写一个会失败的单测**

Create `src/lib/polling.test.ts`：

```ts
import { describe, expect, it } from 'vitest';

describe('polling', () => {
  it('exports pollWithBackoff', async () => {
    const mod = await import('./polling');
    expect(mod.pollWithBackoff).toBeTypeOf('function');
  });
});
```

Run: `pnpm run test:unit src/lib/polling.test.ts`

Expected: FAIL（模块不存在）。

**Step 2: 实现最小轮询器**

Create `src/lib/polling.ts`：

```ts
export async function pollWithBackoff<T>(input: {
  fn: () => Promise<T>;
  stop: (value: T) => boolean;
  onValue?: (value: T) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
  scheduleMs?: number[];
}): Promise<{ value: T | null; timedOut: boolean }> {
  const schedule = input.scheduleMs ?? [500, 1000, 2000, 3000, 5000];
  const timeoutMs = input.timeoutMs ?? 60_000;

  const started = Date.now();
  let attempt = 0;

  while (true) {
    if (input.signal?.aborted) return { value: null, timedOut: false };

    const value = await input.fn();
    input.onValue?.(value);
    if (input.stop(value)) return { value, timedOut: false };

    const elapsed = Date.now() - started;
    if (elapsed >= timeoutMs) return { value, timedOut: true };

    const delay = schedule[Math.min(attempt, schedule.length - 1)];
    attempt += 1;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delay);
      input.signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new Error('aborted'));
        },
        { once: true },
      );
    }).catch(() => {});
  }
}
```

**Step 3: 运行单测验证通过**

Run: `pnpm run test:unit src/lib/polling.test.ts`

Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/polling.ts src/lib/polling.test.ts
git commit -m "feat(web): add polling helper with backoff"
```

---

### Task 11: ArticleView 用 `GET /api/articles/:id/tasks` 替换全文轮询（不再 1Hz 刷新大接口）

**Files:**

- Modify: `src/features/articles/ArticleView.tsx`
- Modify: `src/features/articles/ArticleView.aiSummary.test.tsx`
- (Optional) Modify: `src/store/appStore.ts`（仅在你需要调整 `refreshArticle` 行为时）

**Step 1: 先更新单测（预期行为变化）**

目标：当全文任务 pending 时，按钮禁用/显示 loading 依赖 tasks 状态，而不是 `refreshArticle` 的 30 次轮询。

Update `src/features/articles/ArticleView.aiSummary.test.tsx` 的 mock：

- 在 `vi.mock('../../lib/apiClient', ...)` 里追加：

```ts
getArticleTasks: vi.fn(),
```

- 在 `beforeEach` 中拿到 mock：

```ts
const apiClient = await import('../../lib/apiClient');
const getArticleTasksMock = vi.mocked(apiClient.getArticleTasks);
getArticleTasksMock.mockReset();
```

- 改造用例 “手动模式下全文 pending 时禁用按钮...”：
  - 让 `getArticleTasksMock` 先返回 `fulltext: running`，随后返回 `fulltext: failed`（模拟全文失败，AI 摘要按钮应恢复可点）

**Step 2: 运行该测试验证失败**

Run: `pnpm run test:unit src/features/articles/ArticleView.aiSummary.test.tsx`

Expected: FAIL（组件未调用 `getArticleTasks` 或 UI 未按任务状态变化）。

**Step 3: 实现 ArticleView：加载 tasks + 轮询 fulltext**

Update `src/features/articles/ArticleView.tsx`：

- 新增 import：

```ts
import { getArticleTasks } from '../../lib/apiClient';
import { pollWithBackoff } from '../../lib/polling';
```

- 新增 state：`const [tasks, setTasks] = useState<ArticleTasksDto | null>(null);`
  - （如果你不想把 `ArticleTasksDto` 导入到 UI，可用 `ReturnType<typeof getArticleTasks>` 的推断类型）

- 在 `article?.id` 变化时：
  1) 立即 `getArticleTasks(articleId)` 并 `setTasks`
  2) 如果 `feedFullTextOnOpenEnabled === true`，先调用 `enqueueArticleFulltext(articleId)`（保持现有产品逻辑）
  3) 使用 `pollWithBackoff` 轮询 `getArticleTasks(articleId)`，直到 `fulltext.status` 进入 `succeeded/failed/idle`（idle=没有任务/不需要）
  4) 当 `fulltext.status === 'succeeded'` 时，调用一次 `refreshArticle(articleId)` 拉回最终内容

- 取消逻辑：用 `AbortController`，在 effect cleanup 时 `abort()`，避免切换文章后继续轮询。

**Step 4: 运行测试验证通过**

Run: `pnpm run test:unit src/features/articles/ArticleView.aiSummary.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/articles/ArticleView.tsx src/features/articles/ArticleView.aiSummary.test.tsx
git commit -m "refactor(web): poll fulltext task via /tasks endpoint"
```

---

### Task 12: ArticleView 用 tasks 轮询替换 AI 摘要轮询 + 展示持久化错误 + 重试

**Files:**

- Modify: `src/features/articles/ArticleView.tsx`
- Modify: `src/features/articles/ArticleView.aiSummary.test.tsx`

**Step 1: 先写/改一个会失败的前端测试（失败后显示 error + 重试）**

在 `src/features/articles/ArticleView.aiSummary.test.tsx` 新增用例：

```ts
it('ai summary failed shows persisted error and retry calls enqueue', async () => {
  const apiClient = await import('../../lib/apiClient');
  const enqueueArticleAiSummaryMock = vi.mocked(apiClient.enqueueArticleAiSummary);
  const getArticleTasksMock = vi.mocked(apiClient.getArticleTasks);

  enqueueArticleAiSummaryMock.mockResolvedValue({ enqueued: true, jobId: 'job-1' });
  getArticleTasksMock.mockResolvedValue({
    fulltext: { type: 'fulltext', status: 'idle', jobId: null, requestedAt: null, startedAt: null, finishedAt: null, attempts: 0, errorCode: null, errorMessage: null },
    ai_summary: { type: 'ai_summary', status: 'failed', jobId: 'job-1', requestedAt: null, startedAt: null, finishedAt: null, attempts: 1, errorCode: 'ai_timeout', errorMessage: '请求超时' },
    ai_translate: { type: 'ai_translate', status: 'idle', jobId: null, requestedAt: null, startedAt: null, finishedAt: null, attempts: 0, errorCode: null, errorMessage: null },
  });

  const { useAppStore } = (await import('../../store/appStore')) as typeof import('../../store/appStore');
  useAppStore.setState({
    feeds: [{ id: 'feed-1', title: 'Feed 1', url: 'https://example.com/rss.xml', unreadCount: 1, enabled: true, fullTextOnOpenEnabled: false, aiSummaryOnOpenEnabled: false, categoryId: null, category: null }],
    categories: [{ id: 'cat-uncategorized', name: '未分类', expanded: true }],
    articles: [{ id: 'article-1', feedId: 'feed-1', title: 'Article 1', content: '<p>Hello</p>', summary: 'hello', publishedAt: new Date('2026-02-28T00:00:00.000Z').toISOString(), link: 'https://example.com/a1', isRead: true, isStarred: false }],
    selectedView: 'all',
    selectedArticleId: 'article-1',
  });

  const { default: ArticleView } = await import('./ArticleView');
  render(<ArticleView />);

  fireEvent.click(await screen.findByRole('button', { name: 'AI摘要' }));
  expect(await screen.findByText('请求超时')).toBeInTheDocument();
});
```

Run: `pnpm run test:unit src/features/articles/ArticleView.aiSummary.test.tsx`

Expected: FAIL

**Step 2: 实现摘要轮询逻辑（queued/running -> poll tasks；failed -> show error；succeeded -> refresh once）**

Update `src/features/articles/ArticleView.tsx`：

- `requestAiSummary`：
  - enqueue 成功/already_enqueued 时：`pollWithBackoff` 轮询 tasks，stop 条件：`ai_summary.status` 为 `succeeded` 或 `failed`
  - `succeeded`：调用一次 `refreshArticle(articleId)`，若拿到 `hasAiSummary` 则结束
  - `failed`：停止轮询，展示 `tasks.ai_summary.errorMessage` + “重试”按钮（重试复用 enqueue endpoint）
  - 超时（`pollWithBackoff(...).timedOut === true`）：只展示 “仍在处理中，可稍后重试/刷新”，不要把它当失败（不要写入 tasks，UI 也不要显示 failed）

**Step 3: 运行测试验证通过**

Run: `pnpm run test:unit src/features/articles/ArticleView.aiSummary.test.tsx`

Expected: PASS

**Step 4: Commit**

```bash
git add src/features/articles/ArticleView.tsx src/features/articles/ArticleView.aiSummary.test.tsx
git commit -m "refactor(web): poll ai_summary task via /tasks and show persisted errors"
```

---

### Task 13: ArticleView 用 tasks 轮询替换 AI 翻译轮询 + 展示持久化错误 + 重试

**Files:**

- Modify: `src/features/articles/ArticleView.tsx`
- Modify: `src/features/articles/ArticleView.aiTranslate.test.tsx`（如需新增失败用例）

**Step 1: 写一个会失败的测试（翻译失败显示 error）**

Update `src/features/articles/ArticleView.aiTranslate.test.tsx`：

- 扩展 `vi.mock('../../lib/apiClient', ...)` 增加：

```ts
getArticleTasks: vi.fn(),
```

- 新增用例（思路同 Task 12），让 tasks 返回：
  - `ai_translate.status = 'failed'`
  - `errorMessage = '请求过于频繁，请稍后重试'`
  - 断言 UI 显示该文案

**Step 2: 运行单测验证失败**

Run: `pnpm run test:unit src/features/articles/ArticleView.aiTranslate.test.tsx`

Expected: FAIL

**Step 3: 实现翻译轮询逻辑**

Update `src/features/articles/ArticleView.tsx` 的 `requestAiTranslation`：

- enqueue 成功/already_enqueued：
  - poll tasks，直到 `ai_translate` 进入 `succeeded/failed`
  - succeeded：`refreshArticle(articleId)` 一次，若 `hasAiTranslation` 为 true，则进入 viewing 模式
  - failed：展示 `tasks.ai_translate.errorMessage` + “重试”
- 保持现有 `body_translate_disabled` 禁用逻辑
- 保持 `fulltext_pending` 产品选择：如果 enqueue 返回 `reason: 'fulltext_pending'`，不启动 ai_translate 轮询，只提示等待全文

**Step 4: 运行单测验证通过**

Run: `pnpm run test:unit src/features/articles/ArticleView.aiTranslate.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/articles/ArticleView.tsx src/features/articles/ArticleView.aiTranslate.test.tsx
git commit -m "refactor(web): poll ai_translate task via /tasks and show persisted errors"
```

---

### Task 14: 端到端自测与验收（手动）

**Files:**

- None（执行与观察为主）

**Step 1: 跑全量单测**

Run: `pnpm run test:unit`

Expected: PASS

**Step 2: 运行迁移（本地/开发环境）**

Run: `DATABASE_URL=... node scripts/db/migrate.mjs`

Expected: 输出包含 `Applied migration 0013_article_tasks.sql`

**Step 3: 启动 web + worker**

Run (two terminals):

- `pnpm run dev`
- `pnpm run worker:dev`

**Step 4: 验收检查（对照 Acceptance Criteria）**

- 打开文章页并触发：
  - 全文抓取：确认轮询请求命中 `GET /api/articles/:id/tasks`，而不是 1Hz 的 `GET /api/articles/:id`
  - AI 摘要/翻译：同上
- 任务 `succeeded` 后：
  - `GET /api/articles/:id` 只在成功后刷新 1 次（拉内容），不会持续刷
- 任务 `failed` 后：
  - 刷新页面仍能看到错误（来自 `article_tasks.error_message`）
  - 点击 “重试” 可再次入队并更新任务状态
- 超过 60s 的等待：
  - UI 只提示 “仍在处理中”，不会把它当作失败

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-03-04-async-tasks-refactor-implementation-plan.md`. Three execution options:

1. Subagent-Driven (this session, requires `spawn_agent`)
2. Single-Agent (this session, no subagents)
3. Separate Session (new session)

Which approach?


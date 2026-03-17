# AI 解读文章来源模块 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在右栏 `ai_digest` 文章正文底部新增“来源”模块，展示本次 AI 输入来源并支持点击联动左栏/中栏/右栏跳转。

**Architecture:** 采用“生成时写入、展示时读取”链路。后端新增 `ai_digest_run_sources` 持久化 run 的来源文章顺序，worker 在生成成功后写入来源映射，`GET /api/articles/:id` 回传来源数据。前端仅在 `feed.kind === 'ai_digest'` 时渲染来源模块，点击来源执行 `setSelectedView -> loadSnapshot -> setSelectedArticle`。

**Tech Stack:** Next.js 16 + React 19 + TypeScript + Zustand + PostgreSQL + Vitest + Testing Library

---

## Context Snapshot

- Approved spec: `docs/superpowers/specs/2026-03-17-ai-digest-article-sources-design.md`
- Key existing files:
  - `src/server/db/migrations/0019_ai_digest_sources.sql`
  - `src/server/repositories/aiDigestRepo.ts`
  - `src/worker/aiDigestGenerate.ts`
  - `src/app/api/articles/[id]/route.ts`
  - `src/lib/apiClient.ts`
  - `src/store/appStore.ts`
  - `src/features/articles/ArticleView.tsx`
- Project constraints:
  - 不做浏览器自动化测试（除非用户额外批准）。
  - 验证环节必须执行 `pnpm build`。

## Scope Guardrails

- 仅实现 AI 解读文章来源显示与跳转，不改 AI 摘要/翻译功能。
- 不改动 AI 解读生成模型逻辑（rerank/compose prompt 不变）。
- 不扩展为“普通 RSS 文章也显示来源模块”。
- 不引入新 UI 依赖库。

## File Structure Plan

Planned creates:
- `src/server/db/migrations/0020_ai_digest_run_sources.sql` - 新增 run 来源映射表与索引
- `src/server/db/migrations/aiDigestRunSourcesMigration.test.ts` - migration 结构测试
- `src/features/articles/ArticleView.aiDigestSources.test.tsx` - 来源模块显示与联动跳转测试

Planned modifies:
- `src/server/repositories/aiDigestRepo.ts` - 新增来源映射写入/读取仓储函数
- `src/server/repositories/aiDigestRepo.test.ts` - 仓储 SQL 断言
- `src/worker/aiDigestGenerate.ts` - 生成成功后写入来源映射
- `src/worker/aiDigestGenerate.test.ts` - 来源写入与顺序测试
- `src/app/api/articles/[id]/route.ts` - article 详情增加 `aiDigestSources`
- `src/app/api/articles/routes.test.ts` - API 返回来源测试
- `src/types/index.ts` - `Article` 增加 `aiDigestSources` 类型
- `src/lib/apiClient.ts` - `ArticleDto`/`mapArticleDto` 映射来源
- `src/lib/apiClient.test.ts` - DTO 映射来源测试
- `src/store/appStore.ts` - snapshot merge 时保留 `aiDigestSources`
- `src/store/appStore.test.ts` - store 保留来源数据测试
- `src/features/articles/ArticleView.tsx` - 渲染来源模块并处理点击联动

Skills reference for implementers:
- `@vitest`
- `@nodejs-best-practices`
- `@verification-before-completion`

## Chunk 1: 数据库与迁移

### Task 1: 新增 `ai_digest_run_sources` 表（TDD）

**Files:**
- Create: `src/server/db/migrations/0020_ai_digest_run_sources.sql`
- Create: `src/server/db/migrations/aiDigestRunSourcesMigration.test.ts`

- [ ] **Step 1: 先写失败测试（迁移文件存在且包含关键 DDL）**

```ts
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('db migrations', () => {
  it('adds ai_digest_run_sources mapping table and indexes', () => {
    const migrationPath = 'src/server/db/migrations/0020_ai_digest_run_sources.sql';
    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('create table if not exists ai_digest_run_sources');
    expect(sql).toContain('run_id uuid not null');
    expect(sql).toContain('source_article_id uuid not null');
    expect(sql).toContain('position int not null');
    expect(sql).toContain('primary key (run_id, source_article_id)');
    expect(sql).toContain('unique (run_id, position)');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test:unit src/server/db/migrations/aiDigestRunSourcesMigration.test.ts`
Expected: FAIL（`0020_ai_digest_run_sources.sql` 尚不存在）。

- [ ] **Step 3: 编写 migration SQL**

```sql
create table if not exists ai_digest_run_sources (
  run_id uuid not null references ai_digest_runs(id) on delete cascade,
  source_article_id uuid not null references articles(id) on delete cascade,
  position int not null,
  created_at timestamptz not null default now(),
  primary key (run_id, source_article_id),
  unique (run_id, position)
);

create index if not exists ai_digest_run_sources_source_article_idx
  on ai_digest_run_sources(source_article_id);
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test:unit src/server/db/migrations/aiDigestRunSourcesMigration.test.ts src/server/db/migrations/aiDigestSourcesMigration.test.ts`
Expected: PASS（新增 migration 测试通过且旧 migration 测试不回归）。

- [ ] **Step 5: 提交**

```bash
git add src/server/db/migrations/0020_ai_digest_run_sources.sql src/server/db/migrations/aiDigestRunSourcesMigration.test.ts
git commit -m "feat(db): 添加AI解读运行来源映射表" \
  -m "- 添加 ai_digest_run_sources 表存储来源文章顺序" \
  -m "- 添加迁移测试覆盖关键约束与索引"
```

## Chunk 2: 仓储与 Worker 持久化来源

### Task 2: 扩展 `aiDigestRepo` 写入/读取来源映射（TDD）

**Files:**
- Modify: `src/server/repositories/aiDigestRepo.ts`
- Modify: `src/server/repositories/aiDigestRepo.test.ts`

- [ ] **Step 1: 先写失败测试（SQL 语义）**

```ts
it('replaces run sources by run id and preserves position order', async () => {
  const query = vi.fn().mockResolvedValue({ rows: [] });
  const pool = { query } as unknown as Pool;
  const mod = (await import('./aiDigestRepo')) as typeof import('./aiDigestRepo');

  await mod.replaceAiDigestRunSources(pool, {
    runId: 'run-1',
    sources: [
      { sourceArticleId: 'a-1', position: 0 },
      { sourceArticleId: 'a-2', position: 1 },
    ],
  });

  const joinedSql = query.mock.calls.map((call) => String(call[0])).join('\n');
  expect(joinedSql).toContain('delete from ai_digest_run_sources');
  expect(joinedSql).toContain('insert into ai_digest_run_sources');
});

it('lists run sources by digest article id ordered by position', async () => {
  const query = vi.fn().mockResolvedValue({ rows: [] });
  const pool = { query } as unknown as Pool;
  const mod = (await import('./aiDigestRepo')) as typeof import('./aiDigestRepo');

  await mod.listAiDigestRunSourcesByArticleId(pool, 'article-1');
  const sql = String(query.mock.calls[0]?.[0] ?? '');
  expect(sql).toContain('from ai_digest_runs r');
  expect(sql).toContain('join ai_digest_run_sources s');
  expect(sql).toContain('order by s.position asc');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test:unit src/server/repositories/aiDigestRepo.test.ts -t "run sources"`
Expected: FAIL（函数未定义）。

- [ ] **Step 3: 实现仓储函数**

```ts
export interface AiDigestRunSourceRow {
  runId: string;
  sourceArticleId: string;
  position: number;
  createdAt: string;
}

export interface AiDigestArticleSourceDetailRow {
  articleId: string;
  feedId: string;
  feedTitle: string;
  title: string;
  link: string | null;
  publishedAt: string | null;
  position: number;
}

export async function replaceAiDigestRunSources(db: DbClient, input: {
  runId: string;
  sources: Array<{ sourceArticleId: string; position: number }>;
}): Promise<void> {
  await db.query('delete from ai_digest_run_sources where run_id = $1', [input.runId]);
  if (input.sources.length === 0) return;
  const values: Array<string | number> = [input.runId];
  const placeholders = input.sources.map((source, index) => {
    const positionParam = index * 2 + 2;
    const articleParam = index * 2 + 3;
    values.push(source.position, source.sourceArticleId);
    return `($1, $${articleParam}::uuid, $${positionParam})`;
  });

  await db.query(
    `
      insert into ai_digest_run_sources(run_id, source_article_id, position)
      values ${placeholders.join(', ')}
    `,
    values,
  );
}

export async function listAiDigestRunSourcesByArticleId(
  db: DbClient,
  articleId: string,
): Promise<AiDigestArticleSourceDetailRow[]> {
  const { rows } = await db.query<AiDigestArticleSourceDetailRow>(
    `
      select
        a.id as "articleId",
        a.feed_id as "feedId",
        f.title as "feedTitle",
        a.title,
        a.link,
        a.published_at as "publishedAt",
        s.position
      from ai_digest_runs r
      join ai_digest_run_sources s on s.run_id = r.id
      join articles a on a.id = s.source_article_id
      join feeds f on f.id = a.feed_id
      where r.article_id = $1
      order by s.position asc
    `,
    [articleId],
  );
  return rows;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test:unit src/server/repositories/aiDigestRepo.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/server/repositories/aiDigestRepo.ts src/server/repositories/aiDigestRepo.test.ts
git commit -m "feat(ai-digest): 增加运行来源映射读写仓储" \
  -m "- 添加 run 来源替换写入能力并支持幂等重试" \
  -m "- 添加按解读文章查询来源列表能力"
```

### Task 3: 在 `runAiDigestGenerate` 成功路径写入来源映射（TDD）

**Files:**
- Modify: `src/worker/aiDigestGenerate.ts`
- Modify: `src/worker/aiDigestGenerate.test.ts`

- [ ] **Step 1: 先写失败测试（成功场景写入来源且顺序正确）**

```ts
it('persists selected source article ids with deterministic positions on success', async () => {
  const replaceAiDigestRunSourcesMock = vi.fn().mockResolvedValue(undefined);
  const pool = { query: vi.fn() } as unknown as Pool;

  await runAiDigestGenerate({
    pool,
    runId: 'run-3',
    jobId: null,
    isFinalAttempt: true,
    deps: {
      getAiDigestRunById: vi.fn().mockResolvedValue({
        id: 'run-3',
        feedId: 'feed-ai',
        windowStartAt: '2026-03-17T00:00:00.000Z',
        windowEndAt: '2026-03-17T01:00:00.000Z',
        status: 'queued',
      }),
      getAiDigestConfigByFeedId: vi.fn().mockResolvedValue({
        feedId: 'feed-ai',
        prompt: 'x',
        intervalMinutes: 60,
        topN: 2,
        selectedFeedIds: ['feed-rss-1'],
      }),
      listFeeds: vi.fn().mockResolvedValue([
        { id: 'feed-ai', kind: 'ai_digest', title: 'AI解读', categoryId: null },
        { id: 'feed-rss-1', kind: 'rss', title: 'RSS 1', categoryId: null },
      ]) as never,
      listAiDigestCandidateArticles: vi.fn().mockResolvedValue([
        { id: 'candidate-1', feedTitle: 'RSS 1', title: '来源1', summary: 's1', link: null, fetchedAt: '2026-03-17T00:30:00.000Z', contentFullHtml: null },
        { id: 'candidate-2', feedTitle: 'RSS 1', title: '来源2', summary: 's2', link: null, fetchedAt: '2026-03-17T00:20:00.000Z', contentFullHtml: null },
      ]),
      updateAiDigestRun: vi.fn().mockResolvedValue(undefined),
      updateAiDigestConfigLastWindowEndAt: vi.fn().mockResolvedValue(undefined),
      getAiApiKey: vi.fn().mockResolvedValue('k'),
      getUiSettings: vi.fn().mockResolvedValue({}),
      aiDigestRerank: vi.fn().mockResolvedValue(['candidate-1', 'candidate-2']),
      aiDigestCompose: vi.fn().mockResolvedValue({ title: 'Digest', html: '<p>digest</p>' }),
      sanitizeContent: vi.fn().mockReturnValue('<p>digest</p>'),
      insertArticleIgnoreDuplicate: vi.fn().mockResolvedValue({ id: 'digest-article-1' }),
      queryArticleIdByDedupeKey: vi.fn().mockResolvedValue('digest-article-1'),
      replaceAiDigestRunSources: replaceAiDigestRunSourcesMock,
    },
  });

  expect(replaceAiDigestRunSourcesMock).toHaveBeenCalledWith(
    pool,
    expect.objectContaining({
      runId: 'run-3',
      sources: [
        { sourceArticleId: 'candidate-1', position: 0 },
        { sourceArticleId: 'candidate-2', position: 1 },
      ],
    }),
  );
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test:unit src/worker/aiDigestGenerate.test.ts -t "persists selected source article ids"`
Expected: FAIL（worker 依赖与逻辑未实现）。

- [ ] **Step 3: 实现 worker 写入逻辑**

```ts
type AiDigestGenerateDeps = {
  getAiDigestRunById: typeof getAiDigestRunById;
  getAiDigestConfigByFeedId: typeof getAiDigestConfigByFeedId;
  listFeeds: typeof listFeeds;
  listAiDigestCandidateArticles: typeof listAiDigestCandidateArticles;
  updateAiDigestRun: typeof updateAiDigestRun;
  updateAiDigestConfigLastWindowEndAt: typeof updateAiDigestConfigLastWindowEndAt;
  getAiApiKey: typeof getAiApiKey;
  getUiSettings: typeof getUiSettings;
  aiDigestRerank: typeof aiDigestRerank;
  aiDigestCompose: typeof aiDigestCompose;
  sanitizeContent: typeof sanitizeContent;
  insertArticleIgnoreDuplicate: typeof insertArticleIgnoreDuplicate;
  queryArticleIdByDedupeKey: (pool: Pool, input: { feedId: string; dedupeKey: string }) => Promise<string | null>;
  replaceAiDigestRunSources: typeof replaceAiDigestRunSources;
};

await input.deps.replaceAiDigestRunSources(input.pool, {
  runId: input.run.id,
  sources: selected.map((candidate, index) => ({
    sourceArticleId: candidate.id,
    position: index,
  })),
});
```

- [ ] **Step 4: 跑回归测试**

Run: `pnpm test:unit src/worker/aiDigestGenerate.test.ts src/server/repositories/aiDigestRepo.test.ts`
Expected: PASS（包含无候选、仅 selectedFeedIds、成功写来源等场景）。

- [ ] **Step 5: 提交**

```bash
git add src/worker/aiDigestGenerate.ts src/worker/aiDigestGenerate.test.ts
git commit -m "feat(worker): 在AI解读生成成功后持久化来源顺序" \
  -m "- 扩展生成依赖注入来源映射写入能力" \
  -m "- 在成功路径记录 selected 候选来源与位置"
```

## Chunk 3: Article API + 前端模型映射

### Task 4: 扩展 `/api/articles/:id` 返回来源列表（TDD）

**Files:**
- Modify: `src/app/api/articles/[id]/route.ts`
- Modify: `src/app/api/articles/routes.test.ts`

- [ ] **Step 1: 先写失败测试（ai_digest 详情返回来源）**

```ts
const listAiDigestRunSourcesByArticleIdMock = vi.fn();

vi.mock('../../../../server/repositories/aiDigestRepo', async () => {
  const actual = await vi.importActual<typeof import('../../../../server/repositories/aiDigestRepo')>(
    '../../../../server/repositories/aiDigestRepo',
  );
  return {
    ...actual,
    listAiDigestRunSourcesByArticleId: (...args: unknown[]) =>
      listAiDigestRunSourcesByArticleIdMock(...args),
  };
});

it('GET returns aiDigestSources ordered by position', async () => {
  getArticleByIdMock.mockResolvedValue({
    id: articleId,
    feedId,
    dedupeKey: 'guid:1',
    title: 'Digest',
    titleOriginal: 'Digest',
    titleZh: null,
    link: null,
    author: null,
    publishedAt: null,
    contentHtml: '<p>digest</p>',
    contentFullHtml: null,
    contentFullFetchedAt: null,
    contentFullError: null,
    contentFullSourceUrl: null,
    previewImageUrl: null,
    aiSummary: null,
    aiSummaryModel: null,
    aiSummarizedAt: null,
    aiTranslationBilingualHtml: null,
    aiTranslationZhHtml: null,
    aiTranslationModel: null,
    aiTranslatedAt: null,
    summary: null,
    sourceLanguage: 'en',
    isRead: false,
    readAt: null,
    isStarred: false,
    starredAt: null,
  });
  listAiDigestRunSourcesByArticleIdMock.mockResolvedValue([
    { articleId: 'a-1', feedId: 'f-1', feedTitle: 'Feed 1', title: 'S1', link: 'https://x/1', publishedAt: '2026-03-17T00:00:00.000Z', position: 0 },
    { articleId: 'a-2', feedId: 'f-2', feedTitle: 'Feed 2', title: 'S2', link: 'https://x/2', publishedAt: '2026-03-16T00:00:00.000Z', position: 1 },
  ]);

  const mod = await import('./[id]/route');
  const res = await mod.GET(new Request(`http://localhost/api/articles/${articleId}`), {
    params: Promise.resolve({ id: articleId }),
  });
  const json = await res.json();
  expect(json.data.aiDigestSources).toHaveLength(2);
  expect(json.data.aiDigestSources[0].position).toBe(0);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test:unit src/app/api/articles/routes.test.ts -t "aiDigestSources"`
Expected: FAIL（路由尚未返回该字段）。

- [ ] **Step 3: 实现 route 聚合来源返回**

```ts
import { listAiDigestRunSourcesByArticleId } from '../../../../server/repositories/aiDigestRepo';

const aiDigestSources = await listAiDigestRunSourcesByArticleId(pool, article.id);

return ok({
  ...proxiedArticle,
  aiSummarySession: buildAiSummarySessionSnapshot(aiSummarySession),
  bodyTranslationEligible: eligibility.bodyTranslationEligible,
  bodyTranslationBlockedReason: eligibility.bodyTranslationBlockedReason,
  aiDigestSources,
});
```

- [ ] **Step 4: 跑回归测试**

Run: `pnpm test:unit src/app/api/articles/routes.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/app/api/articles/[id]/route.ts src/app/api/articles/routes.test.ts
git commit -m "feat(api): 返回AI解读文章来源列表" \
  -m "- 在文章详情接口聚合 aiDigestSources 字段" \
  -m "- 添加来源返回与排序测试覆盖"
```

### Task 5: 映射来源 DTO 到前端模型并保留 store 细节（TDD）

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/apiClient.ts`
- Modify: `src/lib/apiClient.test.ts`
- Modify: `src/store/appStore.ts`
- Modify: `src/store/appStore.test.ts`

- [ ] **Step 1: 先写失败测试（DTO 映射 + snapshot merge 保留来源）**

```ts
it('mapArticleDto maps aiDigestSources', () => {
  const mapped = mapArticleDto({
    id: 'a',
    feedId: 'f',
    dedupeKey: 'k',
    title: 'digest',
    titleOriginal: 'digest',
    titleZh: null,
    link: null,
    author: null,
    publishedAt: null,
    contentHtml: '<p>digest</p>',
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
    aiDigestSources: [
      {
        articleId: 'a-1',
        feedId: 'f-1',
        feedTitle: 'Feed 1',
        title: 'Source 1',
        link: 'https://example.com/s1',
        publishedAt: '2026-03-17T00:00:00.000Z',
        position: 0,
      },
    ],
  });

  expect(mapped.aiDigestSources?.[0]?.articleId).toBe('a-1');
});
```

```ts
it('keeps aiDigestSources when snapshot refresh merges selected article details', async () => {
  useAppStore.setState({
    selectedView: 'all',
    selectedArticleId: 'art-1',
    feeds: [{
      id: 'feed-1',
      kind: 'ai_digest',
      title: 'AI解读',
      url: 'https://example.com/feed-1.xml',
      unreadCount: 1,
      enabled: true,
      fullTextOnOpenEnabled: false,
      aiSummaryOnOpenEnabled: false,
      aiSummaryOnFetchEnabled: false,
      bodyTranslateOnFetchEnabled: false,
      bodyTranslateOnOpenEnabled: false,
      titleTranslateEnabled: false,
      bodyTranslateEnabled: false,
      articleListDisplayMode: 'card',
      categoryId: null,
      category: null,
      fetchStatus: null,
      fetchError: null,
    }],
    articles: [{
      id: 'art-1',
      feedId: 'feed-1',
      title: 'Digest',
      content: '<p>loaded</p>',
      summary: 'old',
      publishedAt: '2026-03-17T00:00:00.000Z',
      link: 'https://example.com/digest',
      isRead: false,
      isStarred: false,
      aiDigestSources: [{ articleId: 'src-1', feedId: 'feed-rss-1', feedTitle: 'RSS 1', title: '来源1', link: null, publishedAt: null, position: 0 }],
    }],
  });
  await useAppStore.getState().loadSnapshot({ view: 'all' });
  const selected = useAppStore.getState().articles.find((a) => a.id === 'art-1');
  expect(selected?.aiDigestSources?.[0]?.articleId).toBe('src-1');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test:unit src/lib/apiClient.test.ts src/store/appStore.test.ts -t "aiDigestSources"`
Expected: FAIL（类型/映射未实现）。

- [ ] **Step 3: 实现类型与映射**

```ts
export interface ArticleAiDigestSource {
  articleId: string;
  feedId: string;
  feedTitle: string;
  title: string;
  link?: string | null;
  publishedAt?: string | null;
  position: number;
}

// src/types/index.ts 的 Article interface 新增字段：
aiDigestSources?: ArticleAiDigestSource[];
```

```ts
export interface ArticleAiDigestSourceDto {
  articleId: string;
  feedId: string;
  feedTitle: string;
  title: string;
  link: string | null;
  publishedAt: string | null;
  position: number;
}

// src/lib/apiClient.ts 的 ArticleDto interface 新增字段：
aiDigestSources?: ArticleAiDigestSourceDto[] | null;

export function mapArticleDto(dto: ArticleDto): Article {
  return {
    id: dto.id,
    feedId: dto.feedId,
    title: dto.title,
    titleOriginal: dto.titleOriginal,
    titleZh: dto.titleZh ?? undefined,
    content: dto.contentFullHtml ?? dto.contentHtml ?? '',
    aiSummary: dto.aiSummary ?? undefined,
    aiSummarySession: dto.aiSummarySession ?? undefined,
    aiTranslationBilingualHtml: dto.aiTranslationBilingualHtml ?? undefined,
    aiTranslationZhHtml: dto.aiTranslationZhHtml ?? undefined,
    summary: dto.summary ?? '',
    author: dto.author ?? undefined,
    publishedAt: dto.publishedAt ?? new Date().toISOString(),
    link: dto.link ?? '',
    isRead: dto.isRead,
    isStarred: dto.isStarred,
    bodyTranslationEligible: dto.bodyTranslationEligible,
    bodyTranslationBlockedReason: dto.bodyTranslationBlockedReason,
    aiDigestSources: dto.aiDigestSources?.map((source) => ({
      articleId: source.articleId,
      feedId: source.feedId,
      feedTitle: source.feedTitle,
      title: source.title,
      link: source.link,
      publishedAt: source.publishedAt,
      position: source.position,
    })) ?? undefined,
  };
}
```

```ts
function mergeSnapshotArticleWithExistingDetails(snapshotArticle: Article, existingArticle?: Article): Article {
  if (!existingArticle) return snapshotArticle;
  return {
    ...snapshotArticle,
    content: existingArticle.content,
    aiSummary: existingArticle.aiSummary,
    aiSummarySession: existingArticle.aiSummarySession,
    aiTranslationZhHtml: existingArticle.aiTranslationZhHtml,
    aiTranslationBilingualHtml: existingArticle.aiTranslationBilingualHtml,
    aiDigestSources: existingArticle.aiDigestSources,
  };
}
```

- [ ] **Step 4: 跑回归测试**

Run: `pnpm test:unit src/lib/apiClient.test.ts src/store/appStore.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/types/index.ts src/lib/apiClient.ts src/lib/apiClient.test.ts src/store/appStore.ts src/store/appStore.test.ts
git commit -m "feat(reader): 映射并保留AI解读来源数据" \
  -m "- 扩展 Article 类型与 API DTO 来源字段" \
  -m "- 在 snapshot merge 中保留已加载来源详情"
```

## Chunk 4: 右栏来源模块与联动跳转

### Task 6: 在 `ArticleView` 渲染来源模块并实现点击联动（TDD）

**Files:**
- Modify: `src/features/articles/ArticleView.tsx`
- Create: `src/features/articles/ArticleView.aiDigestSources.test.tsx`

- [ ] **Step 1: 先写失败测试（显示条件、空态、点击联动）**

```tsx
it('renders sources module only for ai_digest article', async () => {
  seedState({
    feed: { id: 'feed-digest', kind: 'ai_digest', title: 'AI解读' },
    article: {
      id: 'digest-1',
      feedId: 'feed-digest',
      aiDigestSources: [
        { articleId: 'src-1', feedId: 'feed-rss-1', feedTitle: 'RSS 1', title: '来源 1', link: 'https://example.com/1', publishedAt: '2026-03-17T00:00:00.000Z', position: 0 },
      ],
    },
  });

  render(<ArticleView />);
  expect(screen.getByText('来源')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /来源 1/ })).toBeInTheDocument();
});

it('hides sources module for non-ai_digest article', async () => {
  seedState({
    feed: { id: 'feed-rss', kind: 'rss', title: 'RSS' },
    article: { id: 'rss-1', feedId: 'feed-rss', aiDigestSources: [] },
  });
  render(<ArticleView />);
  expect(screen.queryByText('来源')).not.toBeInTheDocument();
});

it('shows empty state for ai_digest article without sources', async () => {
  seedState({
    feed: { id: 'feed-digest', kind: 'ai_digest', title: 'AI解读' },
    article: { id: 'digest-2', feedId: 'feed-digest', aiDigestSources: [] },
  });
  render(<ArticleView />);
  expect(screen.getByText('暂无来源记录')).toBeInTheDocument();
});

it('clicking source item switches view, reloads snapshot and selects article', async () => {
  const loadSnapshot = vi.fn().mockResolvedValue(undefined);
  const setSelectedView = vi.fn();
  const setSelectedArticle = vi.fn();
  seedStateWithActions({ loadSnapshot, setSelectedView, setSelectedArticle });

  render(<ArticleView />);
  await userEvent.click(screen.getByRole('button', { name: /来源 1/ }));

  expect(setSelectedView).toHaveBeenCalledWith('feed-rss-1');
  expect(loadSnapshot).toHaveBeenCalledWith({ view: 'feed-rss-1' });
  expect(setSelectedArticle).toHaveBeenCalledWith('src-1');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test:unit src/features/articles/ArticleView.aiDigestSources.test.tsx`
Expected: FAIL（来源模块与点击逻辑尚未实现）。

- [ ] **Step 3: 实现最小 UI 与联动逻辑**

```tsx
const setSelectedView = useAppStore((state) => state.setSelectedView);
const setSelectedArticle = useAppStore((state) => state.setSelectedArticle);
const loadSnapshot = useAppStore((state) => state.loadSnapshot);

const aiDigestSources = article.aiDigestSources ?? [];
const showAiDigestSourcesSection = (feed?.kind ?? 'rss') === 'ai_digest';

async function onAiDigestSourceClick(source: ArticleAiDigestSource) {
  setSelectedView(source.feedId);
  await loadSnapshot({ view: source.feedId });
  setSelectedArticle(source.articleId);
}
```

```tsx
{showAiDigestSourcesSection ? (
  <section className="mt-8 rounded-xl border border-border/65 bg-muted/20 px-4 py-3" aria-label="来源">
    <h2 className="text-sm font-semibold">来源</h2>
    {aiDigestSources.length === 0 ? (
      <p className="mt-2 text-sm text-muted-foreground">暂无来源记录</p>
    ) : (
      <ul className="mt-2 space-y-2">
        {aiDigestSources.map((source) => (
          <li key={`${article.id}-${source.articleId}-${source.position}`}>
            <button type="button" onClick={() => void onAiDigestSourceClick(source)}>
              <span>{source.title}</span>
              <span>{source.feedTitle}</span>
              <span>{formatRelativeTime(source.publishedAt ?? article.publishedAt, referenceTime)}</span>
            </button>
          </li>
        ))}
      </ul>
    )}
  </section>
) : null}
```

- [ ] **Step 4: 跑回归测试**

Run: `pnpm test:unit src/features/articles/ArticleView.aiDigestSources.test.tsx src/features/articles/ArticleView.titleLink.test.tsx src/features/articles/ArticleView.aiSummary.test.tsx`
Expected: PASS（新模块通过且既有渲染行为不回归）。

- [ ] **Step 5: 提交**

```bash
git add src/features/articles/ArticleView.tsx src/features/articles/ArticleView.aiDigestSources.test.tsx
git commit -m "feat(reader): 在AI解读正文底部展示文章来源" \
  -m "- 仅在 ai_digest 文章渲染来源模块并展示空态" \
  -m "- 点击来源后联动左栏中栏并切换到目标文章"
```

## Chunk 5: 最终验证与交付检查

### Task 7: 全量回归与构建验证（必做）

**Files:**
- Modify: 无（仅验证）

- [ ] **Step 1: 运行受影响测试集**

Run:
`pnpm test:unit src/server/db/migrations/aiDigestRunSourcesMigration.test.ts src/server/repositories/aiDigestRepo.test.ts src/worker/aiDigestGenerate.test.ts src/app/api/articles/routes.test.ts src/lib/apiClient.test.ts src/store/appStore.test.ts src/features/articles/ArticleView.aiDigestSources.test.tsx`

Expected: PASS。

- [ ] **Step 2: 执行构建验证（项目要求）**

Run: `pnpm build`
Expected: BUILD SUCCESS（无 TypeScript/Next build 错误）。

- [ ] **Step 3: 结果核对**

检查点：
- `ai_digest` 文章右栏底部显示来源模块。
- 普通文章不显示来源模块。
- 来源顺序与 `position` 一致。
- 点击来源能联动切换 feed 和文章。

- [ ] **Step 4: 可选汇总提交（仅当需要补充改动）**

```bash
git status
# 若无改动则跳过提交；若有验证修复改动，再按 Conventional Commits 提交
```

## Plan Review (Manual, no subagent)

**Status:** Approved

**Issues:** None blocking.

**Recommendations:**
- 若 `ArticleView.tsx` 继续膨胀，可在实现时将来源列表提取为 `AiDigestSourcesSection` 子组件，但不作为本次强制项。

---

Plan complete and saved to `docs/superpowers/plans/2026-03-17-ai-digest-article-sources.md`. Ready to execute?

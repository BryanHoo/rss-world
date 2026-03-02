### Task 1: Add DB Migration Test For AI Translation Columns

**Files:**

- Create: `src/server/db/migrations/articleAiTranslationMigration.test.ts`

- [x] 1.1 Write the failing test

```ts
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('db migrations', () => {
  it('adds ai translation columns to articles', () => {
    const migrationPath = 'src/server/db/migrations/0009_article_ai_translation.sql';
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('ai_translation_zh_html');
    expect(sql).toContain('ai_translation_model');
    expect(sql).toContain('ai_translated_at');
  });
});
```

- [x] 1.2 Run test to verify it fails

Run: `pnpm test:unit -- src/server/db/migrations/articleAiTranslationMigration.test.ts`  
Expected: FAIL because `0009_article_ai_translation.sql` does not exist yet.

---

### Task 2: Add DB Migration For AI Translation Columns

**Files:**

- Create: `src/server/db/migrations/0009_article_ai_translation.sql`
- Test: `src/server/db/migrations/articleAiTranslationMigration.test.ts`

- [x] 2.1 Write the migration

```sql
alter table articles
  add column if not exists ai_translation_zh_html text null;

alter table articles
  add column if not exists ai_translation_model text null;

alter table articles
  add column if not exists ai_translated_at timestamptz null;
```

- [x] 2.2 Run test to verify it passes

Run: `pnpm test:unit -- src/server/db/migrations/articleAiTranslationMigration.test.ts`  
Expected: PASS

- [x] 2.3 Commit

```bash
git add src/server/db/migrations/0009_article_ai_translation.sql src/server/db/migrations/articleAiTranslationMigration.test.ts
git commit -m "feat(db): add article ai translation columns"
```

---

### Task 3: Extend articlesRepo To Read/Write AI Translation Fields

**Files:**

- Create: `src/server/repositories/articlesRepo.aiTranslation.test.ts`
- Modify: `src/server/repositories/articlesRepo.ts`

- [x] 3.1 Write the failing repo test

```ts
import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

describe('articlesRepo (ai translation)', () => {
  it('getArticleById selects ai translation fields', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./articlesRepo')) as typeof import('./articlesRepo');

    await mod.getArticleById(pool, 'a1');

    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('ai_translation_zh_html');
    expect(sql).toContain('ai_translation_model');
    expect(sql).toContain('ai_translated_at');
  });

  it('setArticleAiTranslationZh updates ai translation fields', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./articlesRepo')) as typeof import('./articlesRepo');

    const setArticleAiTranslationZh = (
      mod as Partial<{
        setArticleAiTranslationZh: (
          pool: Pool,
          id: string,
          input: { aiTranslationZhHtml: string; aiTranslationModel: string },
        ) => Promise<void>;
      }>
    ).setArticleAiTranslationZh;

    if (typeof setArticleAiTranslationZh !== 'function') {
      expect.fail('setArticleAiTranslationZh is not implemented');
    }

    await setArticleAiTranslationZh(pool, 'a1', {
      aiTranslationZhHtml: '<p>你好</p>',
      aiTranslationModel: 'gpt-4o-mini',
    });

    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('ai_translation_zh_html');
    expect(sql).toContain('ai_translated_at');
  });
});
```

- [x] 3.2 Run test to verify it fails

Run: `pnpm test:unit -- src/server/repositories/articlesRepo.aiTranslation.test.ts`  
Expected: FAIL because `articlesRepo` does not yet include the new columns/functions.

- [x] 3.3 Implement minimal repo changes

In `src/server/repositories/articlesRepo.ts`:

- Extend `ArticleRow`:

```ts
  aiTranslationZhHtml: string | null;
  aiTranslationModel: string | null;
  aiTranslatedAt: string | null;
```

- Add to both `insertArticleIgnoreDuplicate` and `getArticleById` `select ...` lists:

```sql
ai_translation_zh_html as "aiTranslationZhHtml",
ai_translation_model as "aiTranslationModel",
ai_translated_at as "aiTranslatedAt",
```

- Add new writer:

```ts
export async function setArticleAiTranslationZh(
  pool: Pool,
  id: string,
  input: { aiTranslationZhHtml: string; aiTranslationModel: string },
): Promise<void> {
  await pool.query(
    `
      update articles
      set
        ai_translation_zh_html = $2,
        ai_translation_model = $3,
        ai_translated_at = now()
      where id = $1
    `,
    [id, input.aiTranslationZhHtml, input.aiTranslationModel],
  );
}
```

- [x] 3.4 Run test to verify it passes

Run: `pnpm test:unit -- src/server/repositories/articlesRepo.aiTranslation.test.ts`  
Expected: PASS

- [x] 3.5 Commit

```bash
git add src/server/repositories/articlesRepo.ts src/server/repositories/articlesRepo.aiTranslation.test.ts
git commit -m "feat(api): persist article ai translation fields"
```

---

### Task 4: Add Article Translation Fields To Client Types And Mapping

**Files:**

- Modify: `src/types/index.ts`
- Modify: `src/lib/apiClient.ts`
- Modify: `src/lib/apiClient.test.ts`
- Modify: `src/store/appStore.ts`

- [x] 4.1 Write/extend failing mapping test

Add a test in `src/lib/apiClient.test.ts`:

```ts
it('mapArticleDto maps aiTranslationZhHtml', () => {
  const mapped = mapArticleDto({
    id: 'a',
    feedId: 'f',
    dedupeKey: 'k',
    title: 't',
    link: 'https://example.com',
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
    aiTranslationZhHtml: '<p>你好</p>',
    aiTranslationModel: 'gpt-4o-mini',
    aiTranslatedAt: '2026-03-02T00:00:00.000Z',
    summary: null,
    isRead: false,
    readAt: null,
    isStarred: false,
    starredAt: null,
  });

  expect(mapped.aiTranslationZhHtml).toContain('你好');
});
```

- [x] 4.2 Run test to verify it fails

Run: `pnpm test:unit -- src/lib/apiClient.test.ts`  
Expected: FAIL until `ArticleDto`/mapping support these fields.

- [x] 4.3 Implement minimal type/mapping/store changes

- In `src/types/index.ts` extend `Article`:

```ts
  aiTranslationZhHtml?: string;
```

- In `src/lib/apiClient.ts` extend `ArticleDto`:

```ts
  aiTranslationZhHtml: string | null;
  aiTranslationModel: string | null;
  aiTranslatedAt: string | null;
```

- In `src/lib/apiClient.ts` update `mapArticleDto`:

```ts
  aiTranslationZhHtml: dto.aiTranslationZhHtml ?? undefined,
```

- In `src/store/appStore.ts` update `refreshArticle` return type and logic:

```ts
  const hasAiTranslation = Boolean(dto.aiTranslationZhHtml?.trim());
  return { hasFulltext, hasFulltextError, hasAiSummary, hasAiTranslation };
```

- [x] 4.4 Run test to verify it passes

Run: `pnpm test:unit -- src/lib/apiClient.test.ts`  
Expected: PASS

- [x] 4.5 Commit

```bash
git add src/types/index.ts src/lib/apiClient.ts src/lib/apiClient.test.ts src/store/appStore.ts
git commit -m "feat(reader): expose article ai translation in client state"
```

---

### Task 5: Add enqueueArticleAiTranslate Client API

**Files:**

- Modify: `src/lib/apiClient.ts`
- Modify: `src/lib/apiClient.test.ts`

- [x] 5.1 Write failing client request test

Add a test in `src/lib/apiClient.test.ts`:

```ts
it('enqueueArticleAiTranslate POSTs /api/articles/:id/ai-translate', async () => {
  const fetchMock = vi.fn(async () => {
    return new Response(JSON.stringify({ ok: true, data: { enqueued: true, jobId: 'job-1' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);

  const { enqueueArticleAiTranslate } = await import('./apiClient');
  await enqueueArticleAiTranslate('00000000-0000-0000-0000-000000000000');

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/api/articles/00000000-0000-0000-0000-000000000000/ai-translate'),
    expect.objectContaining({ method: 'POST' }),
  );
});
```

- [x] 5.2 Run test to verify it fails

Run: `pnpm test:unit -- src/lib/apiClient.test.ts`  
Expected: FAIL because `enqueueArticleAiTranslate` is missing.

- [x] 5.3 Implement minimal client function

In `src/lib/apiClient.ts`:

```ts
export async function enqueueArticleAiTranslate(
  articleId: string,
): Promise<{ enqueued: boolean; jobId?: string; reason?: string }> {
  return requestApi(`/api/articles/${encodeURIComponent(articleId)}/ai-translate`, {
    method: 'POST',
  });
}
```

- [x] 5.4 Run test to verify it passes

Run: `pnpm test:unit -- src/lib/apiClient.test.ts`  
Expected: PASS

- [x] 5.5 Commit

```bash
git add src/lib/apiClient.ts src/lib/apiClient.test.ts
git commit -m "feat(reader): add ai translate enqueue api"
```

---

### Task 6: Add translateHtml AI Helper

**Files:**

- Create: `src/server/ai/translateHtml.ts`
- Create: `src/server/ai/translateHtml.test.ts`

- [x] 6.1 Write failing test

```ts
import { describe, expect, it, vi } from 'vitest';

describe('translateHtml', () => {
  it('calls chat/completions and returns content', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '<p>你好</p>' } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { translateHtml } = await import('./translateHtml');
    const out = await translateHtml({
      apiBaseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      html: '<p>Hello</p>',
    });

    expect(out).toContain('你好');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
```

- [x] 6.2 Run test to verify it fails

Run: `pnpm test:unit -- src/server/ai/translateHtml.test.ts`  
Expected: FAIL because `translateHtml.ts` does not exist yet.

- [x] 6.3 Implement minimal helper

Create `src/server/ai/translateHtml.ts` mirroring `src/server/ai/summarizeText.ts` style, with:

- `normalizeBaseUrl(...)`
- `getTranslationContent(payload)` ensuring `choices[0].message.content` is non-empty `string`
- `translateHtml({ apiBaseUrl, apiKey, model, html })` calling `${baseUrl}/chat/completions`
- `system` prompt enforcing:
  - translate to zh-CN
  - preserve HTML structure and attributes
  - output HTML only

- [x] 6.4 Run test to verify it passes

Run: `pnpm test:unit -- src/server/ai/translateHtml.test.ts`  
Expected: PASS

- [x] 6.5 Commit

```bash
git add src/server/ai/translateHtml.ts src/server/ai/translateHtml.test.ts
git commit -m "feat(ai): add html translation helper"
```

---

### Task 7: Add Stable Queue Job Name For Translation

**Files:**

- Modify: `src/server/queue/jobs.ts`
- Modify: `src/server/queue/jobs.test.ts`

- [x] 7.1 Update failing test first

In `src/server/queue/jobs.test.ts` add:

```ts
import { JOB_AI_TRANSLATE } from './jobs';
// ...
expect(JOB_AI_TRANSLATE).toBe('ai.translate_article_zh');
```

- [x] 7.2 Run test to verify it fails

Run: `pnpm test:unit -- src/server/queue/jobs.test.ts`  
Expected: FAIL because `JOB_AI_TRANSLATE` is not exported yet.

- [x] 7.3 Implement constant

In `src/server/queue/jobs.ts`:

```ts
export const JOB_AI_TRANSLATE = 'ai.translate_article_zh';
```

- [x] 7.4 Run test to verify it passes

Run: `pnpm test:unit -- src/server/queue/jobs.test.ts`  
Expected: PASS

- [x] 7.5 Commit

```bash
git add src/server/queue/jobs.ts src/server/queue/jobs.test.ts
git commit -m "feat(queue): add ai translation job name"
```

---

### Task 8: Add /api/articles/:id/ai-translate Route + Tests

**Files:**

- Create: `src/app/api/articles/[id]/ai-translate/route.ts`
- Modify: `src/app/api/articles/routes.test.ts`

- [x] 8.1 Write failing route tests

Add tests to `src/app/api/articles/routes.test.ts` similar to existing `/ai-summary` tests, covering:

- `missing_api_key`
- `fulltext_pending`
- `already_translated`
- `enqueues translate job`
- `already_enqueued`

Example for `fulltext_pending`:

```ts
it('POST /:id/ai-translate returns fulltext_pending when fulltext is enabled and pending', async () => {
  getAiApiKeyMock.mockResolvedValue('sk-test');
  getFeedFullTextOnOpenEnabledMock.mockResolvedValue(true);
  getArticleByIdMock.mockResolvedValue({
    id: articleId,
    feedId,
    dedupeKey: 'guid:1',
    title: 'Hello',
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
    aiTranslationZhHtml: null,
    aiTranslationModel: null,
    aiTranslatedAt: null,
    summary: null,
    isRead: false,
    readAt: null,
    isStarred: false,
    starredAt: null,
  });

  const mod = await import('./[id]/ai-translate/route');
  const res = await mod.POST(new Request(`http://localhost/api/articles/${articleId}/ai-translate`), {
    params: Promise.resolve({ id: articleId }),
  });
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.data).toEqual({ enqueued: false, reason: 'fulltext_pending' });
});
```

- [x] 8.2 Run test to verify it fails

Run: `pnpm test:unit -- src/app/api/articles/routes.test.ts`  
Expected: FAIL until route exists and reasons match.

- [x] 8.3 Implement route

Create `src/app/api/articles/[id]/ai-translate/route.ts` based on:

- `src/app/api/articles/[id]/ai-summary/route.ts`
- `src/app/api/articles/[id]/fulltext/route.ts`

Key logic:

- Validate `id` with `zod` (`z.string().uuid()`)
- Fetch article with `getArticleById`
- Check `getAiApiKey` (empty => `missing_api_key`)
- If `article.aiTranslationZhHtml?.trim()` => `already_translated`
- If `getFeedFullTextOnOpenEnabled(...) === true` and `!article.contentFullHtml && !article.contentFullError` => `fulltext_pending`
- Enqueue `JOB_AI_TRANSLATE` with singleton+retry options
- Handle `Failed to enqueue job` => `already_enqueued`

- [x] 8.4 Run test to verify it passes

Run: `pnpm test:unit -- src/app/api/articles/routes.test.ts`  
Expected: PASS

- [x] 8.5 Commit

```bash
git add src/app/api/articles/[id]/ai-translate/route.ts src/app/api/articles/routes.test.ts
git commit -m "feat(api): add article ai translate enqueue route"
```

---

### Task 9: Implement Worker Translation Job (ai.translate_article_zh)

**Files:**

- Modify: `src/worker/index.ts`

- [x] 9.1 Implement minimal worker handler

- `createQueue(JOB_AI_TRANSLATE)`
- `boss.work(JOB_AI_TRANSLATE, async (jobs) => { ... })`
- For each job:
  - Parse `articleId`
  - Fetch article; skip if missing or already translated
  - Ensure API key exists; skip if missing
  - If fulltext enabled and pending: `throw new Error('Fulltext pending')`
  - Choose HTML source: `contentFullHtml ?? contentHtml`; if missing, continue
  - Call `translateHtml({ apiBaseUrl, apiKey, model, html })`
  - `sanitizeContent(translated, { baseUrl })` and persist via `setArticleAiTranslationZh(...)`

- [x] 9.2 Run unit tests (compile + regression)

Run: `pnpm test:unit`  
Expected: PASS

- [x] 9.3 Commit

```bash
git add src/worker/index.ts
git commit -m "feat(worker): translate article html to zh-CN"
```

---

### Task 10: Implement ArticleView UI Toggle + Translation Polling

**Files:**

- Modify: `src/features/articles/ArticleView.tsx`
- Modify: `src/lib/apiClient.ts`
- Create: `src/features/articles/ArticleView.aiTranslate.test.tsx`

- [x] 10.1 Write failing UI test

Create `src/features/articles/ArticleView.aiTranslate.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

type ApiClientModule = typeof import('../../lib/apiClient');

vi.mock('../../lib/apiClient', async () => {
  const actual = await vi.importActual<ApiClientModule>('../../lib/apiClient');
  return {
    ...actual,
    enqueueArticleAiTranslate: vi.fn(),
  };
});

describe('ArticleView ai translate', () => {
  it('toggles between original and translation when translation exists', async () => {
    const apiClient = await import('../../lib/apiClient');
    vi.mocked(apiClient.enqueueArticleAiTranslate).mockResolvedValue({
      enqueued: false,
      reason: 'already_translated',
    });

    const { useAppStore } = (await import('../../store/appStore')) as typeof import('../../store/appStore');
    useAppStore.setState({
      feeds: [
        {
          id: 'feed-1',
          title: 'Feed 1',
          url: 'https://example.com/rss.xml',
          unreadCount: 1,
          enabled: true,
          fullTextOnOpenEnabled: false,
          aiSummaryOnOpenEnabled: false,
          categoryId: null,
          category: null,
          articleListDisplayMode: 'card',
        },
      ],
      categories: [{ id: 'cat-uncategorized', name: '未分类', expanded: true }],
      articles: [
        {
          id: 'article-1',
          feedId: 'feed-1',
          title: 'Article 1',
          content: '<p>Hello</p>',
          aiTranslationZhHtml: '<p>你好</p>',
          summary: 'hello',
          publishedAt: new Date('2026-02-28T00:00:00.000Z').toISOString(),
          link: 'https://example.com/a1',
          isRead: true,
          isStarred: false,
        },
      ],
      selectedView: 'all',
      selectedArticleId: 'article-1',
    });

    const { default: ArticleView } = await import('./ArticleView');
    render(<ArticleView />);

    expect(screen.getByText('Hello')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '翻译' }));
    expect(screen.getByText('你好')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '原文' }));
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

- [x] 10.2 Run test to verify it fails

Run: `pnpm test:unit -- src/features/articles/ArticleView.aiTranslate.test.tsx`  
Expected: FAIL until ArticleView supports translation toggle and reads `article.aiTranslationZhHtml`.

- [x] 10.3 Implement minimal ArticleView changes

In `src/features/articles/ArticleView.tsx`:

- Import `enqueueArticleAiTranslate` from `../../lib/apiClient`
- Add UI state for translation view and loading/missing key/timeout messages (pattern-match existing ai summary UX)
- Button behavior:
  - If currently showing translation: render `原文` button to switch back
  - Else if `article.aiTranslationZhHtml` exists: clicking `翻译` switches to translation view without network
  - Else: call `enqueueArticleAiTranslate(article.id)` and poll `refreshArticle()` until `hasAiTranslation`
- Disable `翻译` when `feedFullTextOnOpenEnabled && fulltextPending` (align with fulltext gating)

- [x] 10.4 Run tests

Run: `pnpm test:unit -- src/features/articles/ArticleView.aiTranslate.test.tsx`  
Expected: PASS

- [x] 10.5 Run full unit test suite

Run: `pnpm test:unit`  
Expected: PASS

- [x] 10.6 Commit

```bash
git add src/features/articles/ArticleView.tsx src/features/articles/ArticleView.aiTranslate.test.tsx src/lib/apiClient.ts
git commit -m "feat(reader): add ai translation toggle for article body"
```

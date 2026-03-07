# 简体中文正文跳过翻译 Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 让高置信度简体中文正文在前后端与 worker 全链路上统一跳过正文翻译，并隐藏文章页“翻译”按钮。

**Architecture:** 在服务端新增统一的正文翻译资格 helper，优先读取显式 `source_language` 元数据，缺失时再对正文可见文本做严格启发式检测。将 eligibility 结论透出到 snapshot 与单篇文章 API，并在手动翻译、on-open、on-fetch 三个入口共享同一判定。

**Tech Stack:** Next.js App Router、TypeScript、pg/SQL migrations、rss-parser、Zustand、Vitest、pnpm。

---

**相关总结（实现前先通读）**

- `docs/summaries/2026-03-05-ai-summary-translation-trigger-strategy-refactor.md`
- `docs/summaries/2026-03-04-immersive-translation.md`
- `docs/summaries/2026-03-05-translation-preserve-html-structure.md`
- `docs/summaries/2026-03-04-async-tasks-refactor.md`

### Task 1: 为文章添加显式语言字段并打通抓取链路

**Files:**

- Create: `src/server/db/migrations/0017_article_source_language.sql`
- Create: `src/server/db/migrations/articleSourceLanguageMigration.test.ts`
- Modify: `src/server/repositories/articlesRepo.ts`
- Modify: `src/server/rss/parseFeed.ts`
- Modify: `src/server/rss/parseFeed.test.ts`
- Modify: `src/worker/index.ts`

**Step 1: Write the failing test**

```ts
// src/server/db/migrations/articleSourceLanguageMigration.test.ts
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('db migrations', () => {
  it('adds article source language column', () => {
    const migrationPath = 'src/server/db/migrations/0017_article_source_language.sql';
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('source_language');
  });
});
```

```ts
// src/server/rss/parseFeed.test.ts
it('parses optional feed language metadata', async () => {
  const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Example</title><language>zh-CN</language><item><title>Item</title></item></channel></rss>`;
  const feed = await parseFeed(xml, new Date('2026-03-07T00:00:00Z'));
  expect(feed.language).toBe('zh-CN');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/server/db/migrations/articleSourceLanguageMigration.test.ts src/server/rss/parseFeed.test.ts`

Expected: FAIL，因为迁移文件不存在，`parseFeed()` 也尚未返回 `language`。

**Step 3: Write minimal implementation**

```sql
-- src/server/db/migrations/0017_article_source_language.sql
alter table articles
  add column if not exists source_language text null;
```

```ts
// src/server/rss/parseFeed.ts
export interface ParsedFeed {
  title: string | null;
  link: string | null;
  language: string | null;
  items: ParsedFeedItem[];
}

const language = typeof feed.language === 'string' ? feed.language : null;
return { title, link, language, items };
```

```ts
// src/server/repositories/articlesRepo.ts
export interface ArticleRow {
  // ...existing fields...
  sourceLanguage: string | null;
}

insert into articles(..., source_language)
values (..., $11)
```

```ts
// src/worker/index.ts
const created = await insertArticleIgnoreDuplicate(pool, {
  // ...existing fields...
  sourceLanguage: parsed.language,
});
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/server/db/migrations/articleSourceLanguageMigration.test.ts src/server/rss/parseFeed.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/server/db/migrations/0017_article_source_language.sql src/server/db/migrations/articleSourceLanguageMigration.test.ts src/server/repositories/articlesRepo.ts src/server/rss/parseFeed.ts src/server/rss/parseFeed.test.ts src/worker/index.ts
git commit -m "✨ feat(articles): 添加文章源语言字段" -m "- 添加文章源语言数据库字段与仓储映射
- 更新 RSS 解析与入库链路透出显式语言元数据
- 为后续正文翻译资格判定提供持久化输入"
```

### Task 2: 新增统一正文翻译资格判定 helper

**Files:**

- Create: `src/server/ai/articleTranslationEligibility.ts`
- Create: `src/server/ai/articleTranslationEligibility.test.ts`

**Step 1: Write the failing test**

```ts
// src/server/ai/articleTranslationEligibility.test.ts
import { describe, expect, it } from 'vitest';
import { evaluateArticleBodyTranslationEligibility } from './articleTranslationEligibility';

describe('articleTranslationEligibility', () => {
  it('blocks translation for strong simplified Chinese metadata', () => {
    expect(
      evaluateArticleBodyTranslationEligibility({
        sourceLanguage: 'zh-CN',
        contentHtml: '<p>hello</p>',
        contentFullHtml: null,
        summary: null,
      }),
    ).toMatchObject({
      bodyTranslationEligible: false,
      bodyTranslationBlockedReason: 'source_is_simplified_chinese',
      source: 'metadata',
    });
  });

  it('falls back to heuristic for simplified Chinese body text', () => {
    expect(
      evaluateArticleBodyTranslationEligibility({
        sourceLanguage: null,
        contentHtml: '<p>这是一个支持 API、TypeScript 和 RSS 的简体中文正文。</p>',
        contentFullHtml: null,
        summary: null,
      }),
    ).toMatchObject({
      bodyTranslationEligible: false,
      bodyTranslationBlockedReason: 'source_is_simplified_chinese',
      source: 'heuristic',
    });
  });

  it('allows translation for traditional Chinese and Japanese text', () => {
    expect(
      evaluateArticleBodyTranslationEligibility({
        sourceLanguage: null,
        contentHtml: '<p>這是一篇繁體中文文章。</p>',
        contentFullHtml: null,
        summary: null,
      }).bodyTranslationEligible,
    ).toBe(true);

    expect(
      evaluateArticleBodyTranslationEligibility({
        sourceLanguage: null,
        contentHtml: '<p>これは日本語の記事です。</p>',
        contentFullHtml: null,
        summary: null,
      }).bodyTranslationEligible,
    ).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/server/ai/articleTranslationEligibility.test.ts`

Expected: FAIL，因为 helper 文件还不存在。

**Step 3: Write minimal implementation**

```ts
// src/server/ai/articleTranslationEligibility.ts
const STRONG_SIMPLIFIED_LANGUAGE_TAGS = new Set(['zh-cn', 'zh-hans', 'zh-sg', 'zh-my']);
const STRONG_TRADITIONAL_LANGUAGE_TAGS = new Set(['zh-tw', 'zh-hk', 'zh-mo', 'zh-hant']);

export function evaluateArticleBodyTranslationEligibility(input: {
  sourceLanguage: string | null;
  contentHtml: string | null;
  contentFullHtml: string | null;
  summary: string | null;
}) {
  const normalized = input.sourceLanguage?.trim().toLowerCase() ?? null;
  if (normalized && STRONG_SIMPLIFIED_LANGUAGE_TAGS.has(normalized)) {
    return {
      bodyTranslationEligible: false,
      bodyTranslationBlockedReason: 'source_is_simplified_chinese' as const,
      source: 'metadata' as const,
    };
  }

  if (normalized && STRONG_TRADITIONAL_LANGUAGE_TAGS.has(normalized)) {
    return {
      bodyTranslationEligible: true,
      bodyTranslationBlockedReason: null,
      source: 'metadata' as const,
    };
  }

  const source = input.contentFullHtml ?? input.contentHtml ?? input.summary ?? '';
  const plain = source
    .replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<code[\s\S]*?<\/code>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const hasStrongSimplifiedSignal = /这|里|后|发|级|关|经|应|两|为/.test(plain);
  const hasTraditionalSignal = /這|裡|後|發|級|關|經|應|兩|為/.test(plain);
  const hasJapaneseKana = /[ぁ-んァ-ヶ]/.test(plain);

  if (plain.length >= 24 && hasStrongSimplifiedSignal && !hasTraditionalSignal && !hasJapaneseKana) {
    return {
      bodyTranslationEligible: false,
      bodyTranslationBlockedReason: 'source_is_simplified_chinese' as const,
      source: 'heuristic' as const,
    };
  }

  return {
    bodyTranslationEligible: true,
    bodyTranslationBlockedReason: null,
    source: 'heuristic' as const,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/server/ai/articleTranslationEligibility.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/server/ai/articleTranslationEligibility.ts src/server/ai/articleTranslationEligibility.test.ts
git commit -m "✨ feat(ai-translate): 添加正文翻译资格判定" -m "- 添加统一正文翻译资格 helper
- 优先使用显式语言元数据并回退到严格启发式检测
- 输出可复用的 blocked reason 与判定来源"
```

### Task 3: 透出 eligibility 到文章 API 与阅读器 snapshot

**Files:**

- Modify: `src/server/services/readerSnapshotService.ts`
- Modify: `src/app/api/articles/[id]/route.ts`
- Modify: `src/lib/apiClient.ts`
- Modify: `src/types/index.ts`
- Modify: `src/store/appStore.ts`
- Modify: `src/app/api/articles/routes.test.ts`
- Modify: `src/lib/apiClient.test.ts`
- Modify: `src/store/appStore.test.ts`

**Step 1: Write the failing test**

```ts
// src/app/api/articles/routes.test.ts
it('GET /:id returns body translation eligibility', async () => {
  getArticleByIdMock.mockResolvedValue({
    id: articleId,
    feedId: 'feed-1',
    title: '标题',
    titleOriginal: '标题',
    titleZh: null,
    contentHtml: '<p>这是简体中文正文。</p>',
    contentFullHtml: null,
    sourceLanguage: null,
    summary: null,
    aiSummary: null,
    aiTranslationBilingualHtml: null,
    aiTranslationZhHtml: null,
    isRead: false,
    isStarred: false,
  });

  const response = await GET(new Request(`http://localhost/api/articles/${articleId}`), {
    params: Promise.resolve({ id: articleId }),
  });
  const json = await response.json();

  expect(json.data.bodyTranslationEligible).toBe(false);
  expect(json.data.bodyTranslationBlockedReason).toBe('source_is_simplified_chinese');
});
```

```ts
// src/lib/apiClient.test.ts
it('maps body translation eligibility from article dto and snapshot items', async () => {
  expect(
    mapArticleDto({
      id: 'article-1',
      feedId: 'feed-1',
      dedupeKey: 'dedupe',
      title: '标题',
      titleOriginal: '标题',
      titleZh: null,
      link: null,
      author: null,
      publishedAt: null,
      contentHtml: '<p>正文</p>',
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
      bodyTranslationEligible: false,
      bodyTranslationBlockedReason: 'source_is_simplified_chinese',
    }).bodyTranslationEligible,
  ).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/app/api/articles/routes.test.ts src/lib/apiClient.test.ts src/store/appStore.test.ts`

Expected: FAIL，因为 DTO、类型与映射都还没有 eligibility 字段。

**Step 3: Write minimal implementation**

```ts
// src/server/services/readerSnapshotService.ts
import { evaluateArticleBodyTranslationEligibility } from '../ai/articleTranslationEligibility';

export interface ReaderSnapshotArticleItem {
  // ...existing fields...
  bodyTranslationEligible: boolean;
  bodyTranslationBlockedReason: string | null;
}

items: items.map((item) => {
  const eligibility = evaluateArticleBodyTranslationEligibility(item);
  return {
    ...rest,
    bodyTranslationEligible: eligibility.bodyTranslationEligible,
    bodyTranslationBlockedReason: eligibility.bodyTranslationBlockedReason,
  };
})
```

```ts
// src/app/api/articles/[id]/route.ts
const eligibility = evaluateArticleBodyTranslationEligibility(article);
return ok({
  ...article,
  bodyTranslationEligible: eligibility.bodyTranslationEligible,
  bodyTranslationBlockedReason: eligibility.bodyTranslationBlockedReason,
});
```

```ts
// src/types/index.ts
export interface Article {
  // ...existing fields...
  bodyTranslationEligible?: boolean;
  bodyTranslationBlockedReason?: string | null;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/app/api/articles/routes.test.ts src/lib/apiClient.test.ts src/store/appStore.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/server/services/readerSnapshotService.ts src/app/api/articles/[id]/route.ts src/lib/apiClient.ts src/types/index.ts src/store/appStore.ts src/app/api/articles/routes.test.ts src/lib/apiClient.test.ts src/store/appStore.test.ts
git commit -m "✨ feat(reader): 透出正文翻译资格字段" -m "- 更新 snapshot 与单篇文章接口返回正文翻译资格
- 扩展前端类型与映射消费 blocked reason
- 为文章页显示与自动触发提供统一输入"
```

### Task 4: 在手动与自动翻译入口应用 eligibility

**Files:**

- Modify: `src/app/api/articles/[id]/ai-translate/route.ts`
- Modify: `src/worker/autoAiTriggers.ts`
- Modify: `src/app/api/articles/routes.test.ts`
- Modify: `src/worker/autoAiTriggers.test.ts`

**Step 1: Write the failing test**

```ts
// src/app/api/articles/routes.test.ts
it('POST /:id/ai-translate returns source_is_simplified_chinese when article body is already simplified Chinese', async () => {
  getArticleByIdMock.mockResolvedValue({
    id: articleId,
    feedId: 'feed-1',
    title: '标题',
    titleOriginal: '标题',
    titleZh: null,
    sourceLanguage: 'zh-CN',
    contentHtml: '<p>这是简体中文正文。</p>',
    contentFullHtml: null,
    contentFullError: null,
    summary: null,
    aiTranslationBilingualHtml: null,
    aiTranslationZhHtml: null,
  });

  const response = await POST(new Request(`http://localhost/api/articles/${articleId}/ai-translate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ force: true }),
  }), { params: Promise.resolve({ id: articleId }) });
  const json = await response.json();

  expect(json.data).toEqual({ enqueued: false, reason: 'source_is_simplified_chinese' });
  expect(enqueueWithResultMock).not.toHaveBeenCalled();
});
```

```ts
// src/worker/autoAiTriggers.test.ts
it('does not enqueue ai_translate when article body is already simplified Chinese', async () => {
  const send = vi.fn().mockResolvedValue('job-id-1');
  const { enqueueAutoAiTriggersOnFetch } = await import('./autoAiTriggers');

  await enqueueAutoAiTriggersOnFetch({ send } as never, {
    feed: { aiSummaryOnFetchEnabled: false, bodyTranslateOnFetchEnabled: true },
    created: {
      id: 'article-1',
      aiSummary: null,
      aiTranslationBilingualHtml: null,
      aiTranslationZhHtml: null,
      sourceLanguage: 'zh-CN',
      contentHtml: '<p>这是简体中文正文。</p>',
      contentFullHtml: null,
      summary: null,
    },
  });

  expect(send).not.toHaveBeenCalledWith(
    JOB_AI_TRANSLATE,
    expect.anything(),
    expect.anything(),
  );
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/app/api/articles/routes.test.ts src/worker/autoAiTriggers.test.ts`

Expected: FAIL，因为 API route 与 worker 还没有复用 eligibility helper。

**Step 3: Write minimal implementation**

```ts
// src/app/api/articles/[id]/ai-translate/route.ts
const eligibility = evaluateArticleBodyTranslationEligibility(article);
if (!eligibility.bodyTranslationEligible) {
  return ok({ enqueued: false, reason: 'source_is_simplified_chinese' });
}
```

```ts
// src/worker/autoAiTriggers.ts
const eligibility = evaluateArticleBodyTranslationEligibility(created);
if (!eligibility.bodyTranslationEligible) {
  return;
}

await boss.send(JOB_AI_TRANSLATE, { articleId: created.id }, getQueueSendOptions(...));
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/app/api/articles/routes.test.ts src/worker/autoAiTriggers.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/app/api/articles/[id]/ai-translate/route.ts src/worker/autoAiTriggers.ts src/app/api/articles/routes.test.ts src/worker/autoAiTriggers.test.ts
git commit -m "🩹 fix(ai-translate): 跳过简体中文正文翻译入口" -m "- 为手动翻译 API 添加简体中文跳过分支
- 为抓取后自动翻译复用统一 eligibility 判定
- 保持无需翻译场景不入队且不进入失败态"
```

### Task 5: 在文章页隐藏按钮并阻止 on-open 自动翻译

**Files:**

- Modify: `src/features/articles/useImmersiveTranslation.ts`
- Modify: `src/features/articles/ArticleView.tsx`
- Modify: `src/features/articles/ArticleView.aiTranslate.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/features/articles/ArticleView.aiTranslate.test.tsx
it('does not render translate button when bodyTranslationEligible is false', async () => {
  await seedArticleViewState({
    article: {
      bodyTranslationEligible: false,
      bodyTranslationBlockedReason: 'source_is_simplified_chinese',
    },
  });

  const { default: ArticleView } = await import('./ArticleView');
  render(<ArticleView />);

  expect(screen.queryByRole('button', { name: '翻译' })).not.toBeInTheDocument();
});

it('does not auto-request translation on open when bodyTranslationEligible is false', async () => {
  const apiClient = await import('../../lib/apiClient');
  await seedArticleViewState({
    feed: { bodyTranslateOnOpenEnabled: true },
    article: {
      bodyTranslationEligible: false,
      bodyTranslationBlockedReason: 'source_is_simplified_chinese',
    },
  });

  const { default: ArticleView } = await import('./ArticleView');
  render(<ArticleView />);

  await waitFor(() => {
    expect(apiClient.enqueueArticleAiTranslate).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/articles/ArticleView.aiTranslate.test.tsx`

Expected: FAIL，因为按钮仍无条件渲染，on-open effect 也还会请求翻译。

**Step 3: Write minimal implementation**

```tsx
// src/features/articles/ArticleView.tsx
const bodyTranslationEligible = article?.bodyTranslationEligible !== false;

useEffect(() => {
  const articleId = article?.id ?? null;
  if (!articleId) return;
  if (!feedBodyTranslateOnOpenEnabled) return;
  if (!bodyTranslationEligible) return;
  if (hasAiTranslationContent || immersiveTranslationSession) return;

  void requestImmersiveTranslation({ force: false, autoView: true });
}, [article?.id, bodyTranslationEligible, feedBodyTranslateOnOpenEnabled, hasAiTranslationContent, immersiveTranslationSession, requestImmersiveTranslation]);

{bodyTranslationEligible ? (
  <Button type="button" variant="secondary" onClick={onAiTranslationButtonClick}>
    <Languages />
    <span>翻译</span>
  </Button>
) : null}
```

```ts
// src/features/articles/useImmersiveTranslation.ts
if (enqueueResult.reason === 'source_is_simplified_chinese') {
  setLoadingState(false);
  return;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/features/articles/ArticleView.aiTranslate.test.tsx src/features/articles/useImmersiveTranslation.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/features/articles/useImmersiveTranslation.ts src/features/articles/ArticleView.tsx src/features/articles/ArticleView.aiTranslate.test.tsx
git commit -m "🩹 fix(reader): 隐藏简体中文文章翻译按钮" -m "- 根据正文翻译资格控制文章页翻译按钮显示
- 阻止打开文章时对简体中文正文自动触发翻译
- 兼容新的 source_is_simplified_chinese reason"
```

### Task 6: 运行聚焦回归并补实现总结

**Files:**

- Modify: `docs/summaries/2026-03-07-simplified-chinese-translation-eligibility.md`

**Step 1: Write the verification checklist**

```md
- articleTranslationEligibility 单测通过
- Article GET / ai-translate route 契约通过
- autoAiTriggers 回归通过
- ArticleView 翻译按钮与 on-open 行为回归通过
```

**Step 2: Run focused verification**

Run: `pnpm run test:unit -- src/server/ai/articleTranslationEligibility.test.ts src/app/api/articles/routes.test.ts src/worker/autoAiTriggers.test.ts src/features/articles/ArticleView.aiTranslate.test.tsx src/features/articles/useImmersiveTranslation.test.ts src/lib/apiClient.test.ts src/store/appStore.test.ts src/server/rss/parseFeed.test.ts`

Expected: PASS。

**Step 3: Run code quality checks**

Run: `pnpm run lint`

Expected: PASS。

**Step 4: Write summary doc**

```md
# 简体中文正文跳过翻译实现总结

- 记录统一 eligibility helper、API reason 与前端按钮隐藏逻辑
- 链接本实施计划与相关测试命令
- 说明当前 `source_language` 主要作为显式元数据入口，历史文章继续由启发式兜底
```

**Step 5: Commit**

```bash
git add docs/summaries/2026-03-07-simplified-chinese-translation-eligibility.md
git commit -m "📝 docs(ai-translate): 记录简体中文跳过翻译实现总结" -m "- 记录正文翻译资格统一判定方案
- 更新验证证据与相关设计实现文档链接
- 说明元数据优先与启发式兜底的当前边界"
```

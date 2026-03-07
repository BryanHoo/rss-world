# RSS 关键词过滤 Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 为 FeedFuse 增加非破坏性的 RSS 关键词过滤能力，支持全局规则与单个 feed 规则叠加生效，并在 `reader snapshot` 层统一隐藏命中文章。

**Architecture:** 继续复用 `app_settings.ui_settings` 作为唯一持久化来源，在 `rss.articleKeywordFilter` 下保存全局与 feed 级关键词数组。服务端通过一个纯函数模块统一完成关键词标准化与匹配，并在 `readerSnapshotService` 出数时应用过滤，避免在 `ArticleList` 本地维护第二套事实来源。全局规则通过设置中心 autosave 保存，feed 级规则通过独立的 feed 路由读写，并在保存成功后刷新当前 snapshot。

**Tech Stack:** Next.js App Router、TypeScript、Zustand、pg、Vitest、Testing Library、pnpm

---

## 相关设计与既有经验

- 设计文档：`docs/plans/2026-03-07-rss-keyword-filter-design.md`
- 参考总结：`docs/summaries/2026-03-06-feed-category-inline-management.md`
  - 关键约束：影响 feed / list 展示语义的状态，应继续走 `snapshot -> apiClient -> store -> UI` 主链。
- 参考总结：`docs/summaries/2026-03-07-rss-feed-fetch-error-indicator.md`
  - 关键约束：不要在前端组件本地维护第二套展示事实来源；DTO 与测试夹具必须同步字段。
- 参考总结：`docs/summaries/2026-03-06-rss-feed-context-menu-redesign.md`
  - 关键约束：RSS 源右键菜单是合适的 feed 局部操作入口，新能力优先复用该交互区。

## 实施备注

1. 不新增数据库迁移；规则继续持久化在 `app_settings.ui_settings`。
2. 不在 `ArticleList` 组件中新增本地过滤逻辑；关键词过滤必须发生在 snapshot 层。
3. 首版只匹配 `title + summary`，不依赖正文 HTML 或全文抓取结果。
4. 删除 feed 时同步清理对应的 `feedKeywordsByFeedId[feedId]`，但 snapshot 读取也要容忍孤儿 key。
5. 全局关键词保存后需要刷新当前 snapshot，但应尽量避免因为主题等无关设置变更而额外刷新列表。

### Task 1: 扩展 RSS 关键词过滤设置模型与标准化

**Files:**

- Modify: `src/types/index.ts`
- Modify: `src/features/settings/settingsSchema.ts`
- Test: `src/features/settings/settingsSchema.test.ts`

**Step 1: Write the failing test**

```ts
// src/features/settings/settingsSchema.test.ts
it('adds articleKeywordFilter defaults to rss settings', () => {
  const normalized = normalizePersistedSettings({});

  expect(normalized.rss.articleKeywordFilter).toEqual({
    globalKeywords: [],
    feedKeywordsByFeedId: {},
  });
});

it('normalizes rss article keyword filters by trimming and de-duplicating values', () => {
  const normalized = normalizePersistedSettings({
    rss: {
      articleKeywordFilter: {
        globalKeywords: [' Sponsored ', 'sponsored', '', '招聘'],
        feedKeywordsByFeedId: {
          'feed-1': [' Ads ', '', 'ads', 'Hiring'],
        },
      },
    },
  });

  expect(normalized.rss.articleKeywordFilter).toEqual({
    globalKeywords: ['Sponsored', '招聘'],
    feedKeywordsByFeedId: {
      'feed-1': ['Ads', 'Hiring'],
    },
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/settings/settingsSchema.test.ts`

Expected: FAIL，因为 `RssSettings` 与 `normalizePersistedSettings()` 还没有 `articleKeywordFilter` 字段。

**Step 3: Write minimal implementation**

```ts
// src/types/index.ts
export interface ArticleKeywordFilterSettings {
  globalKeywords: string[];
  feedKeywordsByFeedId: Record<string, string[]>;
}

export interface RssSettings {
  sources: RssSourceSetting[];
  fetchIntervalMinutes: 5 | 15 | 30 | 60 | 120;
  articleKeywordFilter: ArticleKeywordFilterSettings;
}
```

```ts
// src/features/settings/settingsSchema.ts
function normalizeKeywordList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function normalizeArticleKeywordFilter(input: Record<string, unknown>) {
  const filterInput = isRecord(input.articleKeywordFilter) ? input.articleKeywordFilter : {};
  const rawFeedKeywords = isRecord(filterInput.feedKeywordsByFeedId)
    ? filterInput.feedKeywordsByFeedId
    : {};

  return {
    globalKeywords: normalizeKeywordList(filterInput.globalKeywords),
    feedKeywordsByFeedId: Object.fromEntries(
      Object.entries(rawFeedKeywords)
        .map(([feedId, keywords]) => [feedId, normalizeKeywordList(keywords)])
        .filter(([, keywords]) => keywords.length > 0),
    ),
  };
}

const defaultRssSettings: RssSettings = {
  sources: [],
  fetchIntervalMinutes: 30,
  articleKeywordFilter: {
    globalKeywords: [],
    feedKeywordsByFeedId: {},
  },
};

function normalizeRssSettings(input: Record<string, unknown>): RssSettings {
  const rssInput = isRecord(input.rss) ? input.rss : {};
  // ...sources + fetchIntervalMinutes 现有逻辑...
  return {
    sources,
    fetchIntervalMinutes,
    articleKeywordFilter: normalizeArticleKeywordFilter(rssInput),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/features/settings/settingsSchema.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/types/index.ts src/features/settings/settingsSchema.ts src/features/settings/settingsSchema.test.ts
git commit -m "✨ feat(settings): 添加 RSS 关键词过滤配置模型" -m "- 添加 RSS 关键词过滤设置类型与默认值
- 规范化 全局与订阅源级关键词列表输入
- 保持 设置持久化结构与现有 schema 兼容"
```

### Task 2: 提供共享的关键词匹配纯函数

**Files:**

- Create: `src/server/services/articleKeywordFilter.ts`
- Test: `src/server/services/articleKeywordFilter.test.ts`

**Step 1: Write the failing test**

```ts
// src/server/services/articleKeywordFilter.test.ts
import { describe, expect, it } from 'vitest';

describe('articleKeywordFilter', () => {
  it('merges global and feed keywords for a feed', async () => {
    const mod = await import('./articleKeywordFilter');
    expect(
      mod.getArticleKeywordsForFeed(
        {
          globalKeywords: ['Sponsored'],
          feedKeywordsByFeedId: { 'feed-1': ['招聘'] },
        },
        'feed-1',
      ),
    ).toEqual(['Sponsored', '招聘']);
  });

  it('matches keywords against title and summary case-insensitively', async () => {
    const mod = await import('./articleKeywordFilter');
    expect(
      mod.matchesArticleKeywordFilter(
        { title: 'Sponsored Post', summary: 'Weekly digest' },
        ['sponsored'],
      ),
    ).toBe(true);
    expect(
      mod.matchesArticleKeywordFilter(
        { title: 'Daily News', summary: 'Hiring update' },
        ['招聘', 'hiring'],
      ),
    ).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/server/services/articleKeywordFilter.test.ts`

Expected: FAIL，因为 `src/server/services/articleKeywordFilter.ts` 尚不存在。

**Step 3: Write minimal implementation**

```ts
// src/server/services/articleKeywordFilter.ts
import type { ArticleKeywordFilterSettings } from '../../types';

function dedupeKeywords(input: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function getArticleKeywordsForFeed(
  filter: ArticleKeywordFilterSettings,
  feedId: string,
): string[] {
  return dedupeKeywords([
    ...filter.globalKeywords,
    ...(filter.feedKeywordsByFeedId[feedId] ?? []),
  ]);
}

export function matchesArticleKeywordFilter(
  article: { title?: string | null; summary?: string | null },
  keywords: string[],
): boolean {
  if (keywords.length === 0) return false;
  const haystack = `${article.title ?? ''}\n${article.summary ?? ''}`.toLowerCase();
  if (!haystack.trim()) return false;
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/server/services/articleKeywordFilter.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/server/services/articleKeywordFilter.ts src/server/services/articleKeywordFilter.test.ts
git commit -m "✨ feat(reader): 添加文章关键词过滤匹配工具" -m "- 添加 全局与订阅源关键词合并逻辑
- 实现 标题与摘要的大小写不敏感匹配
- 保持 过滤规则复用在 snapshot 与接口层"
```

### Task 3: 在 `reader snapshot` 层应用关键词过滤并补齐分页测试

**Files:**

- Modify: `src/server/services/readerSnapshotService.ts`
- Test: `src/server/services/readerSnapshotService.keywordFilter.test.ts`

**Step 1: Write the failing test**

```ts
// src/server/services/readerSnapshotService.keywordFilter.test.ts
import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

const listCategoriesMock = vi.fn();
const listFeedsMock = vi.fn();
const getUiSettingsMock = vi.fn();

vi.mock('../repositories/categoriesRepo', () => ({
  listCategories: (...args: unknown[]) => listCategoriesMock(...args),
}));
vi.mock('../repositories/feedsRepo', () => ({
  listFeeds: (...args: unknown[]) => listFeedsMock(...args),
}));
vi.mock('../repositories/settingsRepo', () => ({
  getUiSettings: (...args: unknown[]) => getUiSettingsMock(...args),
}));

describe('readerSnapshotService (keyword filter)', () => {
  it('hides articles matched by global keywords', async () => {
    listCategoriesMock.mockResolvedValue([]);
    listFeedsMock.mockResolvedValue([]);
    getUiSettingsMock.mockResolvedValue({
      rss: { articleKeywordFilter: { globalKeywords: ['Sponsored'], feedKeywordsByFeedId: {} } },
    });

    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          { id: 'a-1', feedId: 'feed-1', title: 'Sponsored Post', summary: 'Weekly', sortPublishedAt: '2026-03-01T00:00:00.000Z', publishedAt: '2026-03-01T00:00:00.000Z', author: null, link: null, previewImage: null, titleOriginal: null, titleZh: null, isRead: false, isStarred: false, sourceLanguage: 'en', contentHtml: null, contentFullHtml: null },
          { id: 'a-2', feedId: 'feed-1', title: 'Real Story', summary: 'Useful', sortPublishedAt: '2026-02-28T00:00:00.000Z', publishedAt: '2026-02-28T00:00:00.000Z', author: null, link: null, previewImage: null, titleOriginal: null, titleZh: null, isRead: false, isStarred: false, sourceLanguage: 'en', contentHtml: null, contentFullHtml: null },
        ],
      });

    const pool = { query } as unknown as Pool;
    const mod = await import('./readerSnapshotService');
    const snapshot = await mod.getReaderSnapshot(pool, { view: 'all', limit: 10 });

    expect(snapshot.articles.items.map((item) => item.id)).toEqual(['a-2']);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/server/services/readerSnapshotService.keywordFilter.test.ts`

Expected: FAIL，因为 `readerSnapshotService` 还没有读取 settings，也没有应用关键词过滤。

**Step 3: Write minimal implementation**

```ts
// src/server/services/readerSnapshotService.ts
import { normalizePersistedSettings } from '../../features/settings/settingsSchema';
import { getUiSettings } from '../repositories/settingsRepo';
import { getArticleKeywordsForFeed, matchesArticleKeywordFilter } from './articleKeywordFilter';

async function listVisibleArticleRows(
  pool: Pool,
  input: { view: string; limit: number; cursor?: string | null },
  filterSettings: ReturnType<typeof normalizePersistedSettings>['rss']['articleKeywordFilter'],
) {
  const visible: QueryRow[] = [];
  let cursor = input.cursor ?? null;
  let nextCursor: string | null = null;
  let iterations = 0;

  while (visible.length < input.limit + 1 && iterations < 5) {
    iterations += 1;
    const batch = await queryArticleRows(pool, { ...input, cursor, limit: Math.max(input.limit * 2, 50) });
    if (batch.length === 0) break;

    for (const row of batch) {
      cursor = encodeCursor({ publishedAt: String(row.sortPublishedAt), id: row.id });
      const keywords = getArticleKeywordsForFeed(filterSettings, row.feedId);
      if (matchesArticleKeywordFilter({ title: row.title, summary: row.summary }, keywords)) {
        continue;
      }
      visible.push(row);
      if (visible.length === input.limit + 1) {
        nextCursor = cursor;
        break;
      }
    }

    if (batch.length < Math.max(input.limit * 2, 50) || nextCursor) break;
  }

  return { rows: visible.slice(0, input.limit), nextCursor };
}

export async function getReaderSnapshot(pool: Pool, input: { view: string; limit?: number; cursor?: string | null }) {
  const rawSettings = await getUiSettings(pool);
  const settings = normalizePersistedSettings(rawSettings);
  // ...feeds / unread count 现有逻辑...
  const { rows, nextCursor } = await listVisibleArticleRows(pool, { view: input.view, limit, cursor: input.cursor }, settings.rss.articleKeywordFilter);
  // ...沿用现有 article 映射逻辑...
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/server/services/articleKeywordFilter.test.ts src/server/services/readerSnapshotService.keywordFilter.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/server/services/articleKeywordFilter.ts src/server/services/articleKeywordFilter.test.ts src/server/services/readerSnapshotService.ts src/server/services/readerSnapshotService.keywordFilter.test.ts
git commit -m "✨ feat(reader): 在 snapshot 层应用关键词过滤" -m "- 读取 设置中的 RSS 关键词过滤规则
- 过滤 阅读器快照文章列表并保持分页可用
- 复用 共享关键词匹配工具避免前端本地筛选"
```

### Task 4: 新增 feed 级关键词过滤路由，并在删除 feed 时清理局部规则

**Files:**

- Create: `src/app/api/feeds/[id]/keyword-filter/route.ts`
- Test: `src/app/api/feeds/[id]/keyword-filter/route.test.ts`
- Modify: `src/app/api/feeds/[id]/route.ts`
- Modify: `src/app/api/feeds/routes.test.ts`

**Step 1: Write the failing test**

```ts
// src/app/api/feeds/[id]/keyword-filter/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUiSettingsMock = vi.fn();
const updateUiSettingsMock = vi.fn();
const getFeedCategoryAssignmentMock = vi.fn();
const pool = {};

vi.mock('../../../../../server/db/pool', () => ({ getPool: () => pool }));
vi.mock('../../../../../server/repositories/settingsRepo', () => ({
  getUiSettings: (...args: unknown[]) => getUiSettingsMock(...args),
  updateUiSettings: (...args: unknown[]) => updateUiSettingsMock(...args),
}));
vi.mock('../../../../../server/repositories/feedsRepo', () => ({
  getFeedCategoryAssignment: (...args: unknown[]) => getFeedCategoryAssignmentMock(...args),
}));

it('PATCH stores keywords for a feed and returns normalized values', async () => {
  getFeedCategoryAssignmentMock.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', categoryId: null });
  getUiSettingsMock.mockResolvedValue({ rss: { articleKeywordFilter: { globalKeywords: [], feedKeywordsByFeedId: {} } } });
  updateUiSettingsMock.mockResolvedValue({
    rss: { articleKeywordFilter: { globalKeywords: [], feedKeywordsByFeedId: { '11111111-1111-4111-8111-111111111111': ['Sponsored'] } } },
  });

  const mod = await import('./route');
  const res = await mod.PATCH(
    new Request('http://localhost/api/feeds/11111111-1111-4111-8111-111111111111/keyword-filter', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keywords: [' Sponsored ', 'sponsored'] }),
    }),
    { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }) },
  );
  const json = await res.json();

  expect(json.ok).toBe(true);
  expect(json.data.keywords).toEqual(['Sponsored']);
});
```

```ts
// src/app/api/feeds/routes.test.ts
it('DELETE clears the deleted feed keyword filter settings', async () => {
  deleteFeedAndCleanupCategoryMock.mockResolvedValue(true);
  getUiSettingsMock.mockResolvedValue({
    rss: {
      articleKeywordFilter: {
        globalKeywords: [],
        feedKeywordsByFeedId: { [feedId]: ['Sponsored'] },
      },
    },
  });
  updateUiSettingsMock.mockResolvedValue({ rss: { articleKeywordFilter: { globalKeywords: [], feedKeywordsByFeedId: {} } } });

  const mod = await import('./[id]/route');
  await mod.DELETE(new Request(`http://localhost/api/feeds/${feedId}`), {
    params: Promise.resolve({ id: feedId }),
  });

  expect(updateUiSettingsMock).toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- 'src/app/api/feeds/[id]/keyword-filter/route.test.ts' src/app/api/feeds/routes.test.ts`

Expected: FAIL，因为 feed 级关键词路由尚不存在，删除 feed 也还没有清理局部规则。

**Step 3: Write minimal implementation**

```ts
// src/app/api/feeds/[id]/keyword-filter/route.ts
import { z } from 'zod';
import { getPool } from '../../../../../server/db/pool';
import { ok, fail } from '../../../../../server/http/apiResponse';
import { NotFoundError, ValidationError } from '../../../../../server/http/errors';
import { getFeedCategoryAssignment } from '../../../../../server/repositories/feedsRepo';
import { getUiSettings, updateUiSettings } from '../../../../../server/repositories/settingsRepo';
import { normalizePersistedSettings } from '../../../../../features/settings/settingsSchema';

const bodySchema = z.object({ keywords: z.array(z.string()).default([]) });

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const pool = getPool();
  const feed = await getFeedCategoryAssignment(pool, id);
  if (!feed) return fail(new NotFoundError('Feed not found'));

  const settings = normalizePersistedSettings(await getUiSettings(pool));
  return ok({ keywords: settings.rss.articleKeywordFilter.feedKeywordsByFeedId[id] ?? [] });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(new ValidationError('Invalid request body'));

  const pool = getPool();
  const feed = await getFeedCategoryAssignment(pool, id);
  if (!feed) return fail(new NotFoundError('Feed not found'));

  const settings = normalizePersistedSettings(await getUiSettings(pool));
  settings.rss.articleKeywordFilter.feedKeywordsByFeedId[id] = parsed.data.keywords;
  const saved = normalizePersistedSettings(await updateUiSettings(pool, settings));

  return ok({ keywords: saved.rss.articleKeywordFilter.feedKeywordsByFeedId[id] ?? [] });
}
```

```ts
// src/app/api/feeds/[id]/route.ts
import { getUiSettings, updateUiSettings } from '../../../../server/repositories/settingsRepo';
import { normalizePersistedSettings } from '../../../../features/settings/settingsSchema';

export async function DELETE(...) {
  // ...existing deleteFeedAndCleanupCategory logic...
  const rawSettings = await getUiSettings(pool);
  const settings = normalizePersistedSettings(rawSettings);
  delete settings.rss.articleKeywordFilter.feedKeywordsByFeedId[paramsParsed.data.id];
  await updateUiSettings(pool, settings);
  return ok({ deleted: true });
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- 'src/app/api/feeds/[id]/keyword-filter/route.test.ts' src/app/api/feeds/routes.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add 'src/app/api/feeds/[id]/keyword-filter/route.ts' 'src/app/api/feeds/[id]/keyword-filter/route.test.ts' 'src/app/api/feeds/[id]/route.ts' src/app/api/feeds/routes.test.ts
git commit -m "✨ feat(feeds): 添加订阅源关键词过滤接口" -m "- 添加 订阅源关键词过滤的读取与保存路由
- 清理 删除订阅源后的局部关键词规则
- 保持 规则仍统一持久化在 UI settings 中"
```

### Task 5: 为 RSS 设置面板添加全局关键词编辑，并在相关 autosave 后刷新 snapshot

**Files:**

- Modify: `src/features/settings/panels/RssSettingsPanel.tsx`
- Modify: `src/features/settings/SettingsCenterDrawer.tsx`
- Test: `src/features/settings/SettingsCenterModal.test.tsx`

**Step 1: Write the failing test**

```ts
// src/features/settings/SettingsCenterModal.test.tsx
it('saves global keyword filter from rss settings and refreshes snapshot', async () => {
  resetSettingsStore();
  renderWithNotifications();

  fireEvent.click(screen.getByLabelText('open-settings'));
  await waitFor(() => expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument());

  fireEvent.click(screen.getByTestId('settings-section-tab-rss'));
  const textarea = await screen.findByLabelText('全局文章关键词隐藏');
  fireEvent.change(textarea, { target: { value: 'Sponsored\n招聘' } });

  await waitFor(() => {
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(
      calls.some(([input, init]) => {
        const url = typeof input === 'string' ? input : input.toString();
        return url.includes('/api/settings') && init?.method === 'PUT' && String(init.body).includes('Sponsored');
      }),
    ).toBe(true);
  });

  await waitFor(() => {
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some(([input]) => String(input).includes('/api/reader/snapshot'))).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/features/settings/SettingsCenterModal.test.tsx -t "saves global keyword filter from rss settings and refreshes snapshot"`

Expected: FAIL，因为 RSS 设置面板还没有关键词输入框，也不会在保存后刷新 snapshot。

**Step 3: Write minimal implementation**

```tsx
// src/features/settings/panels/RssSettingsPanel.tsx
import { Textarea } from '@/components/ui/textarea';

const globalKeywordsText = rss.articleKeywordFilter.globalKeywords.join('\n');

<Textarea
  aria-label="全局文章关键词隐藏"
  value={globalKeywordsText}
  onChange={(event) => {
    const value = event.target.value;
    onChange((nextDraft) => {
      nextDraft.persisted.rss.articleKeywordFilter.globalKeywords = value.split('\n');
    });
  }}
  placeholder={'广告\n招聘\nSponsored'}
/>
```

```tsx
// src/features/settings/SettingsCenterDrawer.tsx
import { useAppStore } from '../../store/appStore';

const selectedView = useAppStore((state) => state.selectedView);
const lastSavedKeywordSignatureRef = useRef(JSON.stringify(draft?.persisted.rss.articleKeywordFilter.globalKeywords ?? []));
const pendingKeywordReloadRef = useRef(false);

const handleDraftChange = (updater) => {
  const before = JSON.stringify(draft?.persisted.rss.articleKeywordFilter.globalKeywords ?? []);
  updateDraft((nextDraft) => {
    updater(nextDraft);
    const after = JSON.stringify(nextDraft.persisted.rss.articleKeywordFilter.globalKeywords ?? []);
    if (before !== after) pendingKeywordReloadRef.current = true;
  });
  setDraftVersion((value) => value + 1);
};

useEffect(() => {
  if (autosave.status !== 'saved' || !pendingKeywordReloadRef.current) return;
  pendingKeywordReloadRef.current = false;
  void useAppStore.getState().loadSnapshot({ view: selectedView });
}, [autosave.status, selectedView]);
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/features/settings/SettingsCenterModal.test.tsx -t "saves global keyword filter from rss settings and refreshes snapshot"`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/features/settings/panels/RssSettingsPanel.tsx src/features/settings/SettingsCenterDrawer.tsx src/features/settings/SettingsCenterModal.test.tsx
git commit -m "✨ feat(settings): 添加全局文章关键词过滤设置" -m "- 添加 RSS 设置中的全局关键词多行输入
- 刷新 关键词规则保存后的当前阅读器快照
- 保持 autosave 与现有设置中心交互一致"
```

### Task 6: 为 RSS 源右键菜单接入关键词过滤弹窗与客户端请求

**Files:**

- Create: `src/features/feeds/FeedKeywordFilterDialog.tsx`
- Test: `src/features/feeds/FeedKeywordFilterDialog.test.tsx`
- Modify: `src/features/feeds/FeedList.tsx`
- Modify: `src/features/feeds/FeedList.test.tsx`
- Modify: `src/lib/apiClient.ts`
- Modify: `src/lib/apiClient.test.ts`

**Step 1: Write the failing test**

```ts
// src/lib/apiClient.test.ts
it('requests feed keyword filter endpoints', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ ok: true, data: { keywords: ['Sponsored'] } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);

  const mod = await import('./apiClient');
  await mod.getFeedKeywordFilter('feed-1');
  await mod.patchFeedKeywordFilter('feed-1', { keywords: ['Sponsored'] });

  expect(fetchMock.mock.calls[0][0].toString()).toContain('/api/feeds/feed-1/keyword-filter');
  expect(fetchMock.mock.calls[1][1]?.method).toBe('PATCH');
});
```

```tsx
// src/features/feeds/FeedList.test.tsx
it('opens keyword filter dialog from feed context menu and saves changes', async () => {
  renderFeedList();

  fireEvent.contextMenu(screen.getByText('My Feed'));
  fireEvent.click(await screen.findByText('配置关键词过滤'));

  const textarea = await screen.findByLabelText('订阅源文章关键词隐藏');
  fireEvent.change(textarea, { target: { value: 'Sponsored' } });
  fireEvent.click(screen.getByRole('button', { name: '保存' }));

  await waitFor(() => {
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some(([input]) => String(input).includes('/api/feeds/feed-1/keyword-filter'))).toBe(true);
    expect(calls.filter(([input]) => String(input).includes('/api/reader/snapshot')).length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/lib/apiClient.test.ts src/features/feeds/FeedList.test.tsx`

Expected: FAIL，因为客户端尚无 `getFeedKeywordFilter()` / `patchFeedKeywordFilter()`，右键菜单也没有“配置关键词过滤”入口和弹窗。

**Step 3: Write minimal implementation**

```ts
// src/lib/apiClient.ts
export async function getFeedKeywordFilter(feedId: string): Promise<{ keywords: string[] }> {
  return requestApi(`/api/feeds/${encodeURIComponent(feedId)}/keyword-filter`);
}

export async function patchFeedKeywordFilter(
  feedId: string,
  input: { keywords: string[] },
): Promise<{ keywords: string[] }> {
  return requestApi(`/api/feeds/${encodeURIComponent(feedId)}/keyword-filter`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}
```

```tsx
// src/features/feeds/FeedKeywordFilterDialog.tsx
export default function FeedKeywordFilterDialog({ feed, open, onOpenChange }: Props) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !feed) return;
    void getFeedKeywordFilter(feed.id).then((result) => setValue(result.keywords.join('\n')));
  }, [open, feed?.id]);

  const handleSave = async () => {
    if (!feed) return;
    setSaving(true);
    try {
      await patchFeedKeywordFilter(feed.id, { keywords: value.split('\n') });
      await useAppStore.getState().loadSnapshot({ view: useAppStore.getState().selectedView });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>配置关键词过滤</DialogTitle>
        <DialogDescription>{feed?.title}</DialogDescription>
        <Textarea
          aria-label="订阅源文章关键词隐藏"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button onClick={() => void handleSave()} disabled={saving}>保存</Button>
      </DialogContent>
    </Dialog>
  );
}
```

```tsx
// src/features/feeds/FeedList.tsx
const [keywordFilterFeedId, setKeywordFilterFeedId] = useState<string | null>(null);
const activeKeywordFilterFeed = feeds.find((feed) => feed.id === keywordFilterFeedId) ?? null;

<ContextMenuItem onSelect={() => setKeywordFilterFeedId(feed.id)}>
  配置关键词过滤
</ContextMenuItem>

<FeedKeywordFilterDialog
  open={Boolean(activeKeywordFilterFeed)}
  feed={activeKeywordFilterFeed}
  onOpenChange={(open) => {
    if (!open) setKeywordFilterFeedId(null);
  }}
/>
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/lib/apiClient.test.ts src/features/feeds/FeedList.test.tsx src/features/feeds/FeedKeywordFilterDialog.test.tsx`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/lib/apiClient.ts src/lib/apiClient.test.ts src/features/feeds/FeedList.tsx src/features/feeds/FeedList.test.tsx src/features/feeds/FeedKeywordFilterDialog.tsx src/features/feeds/FeedKeywordFilterDialog.test.tsx
git commit -m "✨ feat(feeds): 添加订阅源关键词过滤弹窗" -m "- 添加 RSS 源右键菜单中的关键词过滤入口
- 接入 订阅源关键词过滤弹窗与客户端请求
- 刷新 保存局部规则后的当前阅读器快照"
```

### Task 7: 执行回归验证并确认交付状态

**Files:**

- Verify only: `src/features/settings/settingsSchema.test.ts`
- Verify only: `src/server/services/articleKeywordFilter.test.ts`
- Verify only: `src/server/services/readerSnapshotService.keywordFilter.test.ts`
- Verify only: `src/app/api/feeds/[id]/keyword-filter/route.test.ts`
- Verify only: `src/app/api/feeds/routes.test.ts`
- Verify only: `src/features/settings/SettingsCenterModal.test.tsx`
- Verify only: `src/features/feeds/FeedKeywordFilterDialog.test.tsx`
- Verify only: `src/features/feeds/FeedList.test.tsx`
- Verify only: `src/lib/apiClient.test.ts`
- Verify only: `src/store/appStore.test.ts`
- Verify only: `src/store/settingsStore.test.ts`

**Step 1: Run targeted test suite**

Run: `pnpm run test:unit -- src/features/settings/settingsSchema.test.ts src/server/services/articleKeywordFilter.test.ts src/server/services/readerSnapshotService.keywordFilter.test.ts 'src/app/api/feeds/[id]/keyword-filter/route.test.ts' src/app/api/feeds/routes.test.ts src/features/settings/SettingsCenterModal.test.tsx src/features/feeds/FeedKeywordFilterDialog.test.tsx src/features/feeds/FeedList.test.tsx src/lib/apiClient.test.ts`

Expected: PASS。

**Step 2: Run adjacent store/service regression tests**

Run: `pnpm run test:unit -- src/server/services/readerSnapshotService.test.ts src/server/services/readerSnapshotService.previewImage.test.ts src/store/appStore.test.ts src/store/settingsStore.test.ts`

Expected: PASS。

**Step 3: Run lint**

Run: `pnpm run lint`

Expected: PASS（exit code 0）。

**Step 4: Confirm no unintended scope creep**

- 确认没有在 `ArticleList` 中新增本地关键词过滤。
- 确认未读数统计逻辑未被修改。
- 确认 `FeedDialog` / `AddFeedDialog` 没有被无关改重。

**Step 5: Commit only if verification uncovered a required final fix**

```bash
# 若前 6 个任务已各自提交且验证阶段没有额外修复，则不要新增空提交。
# 若验证阶段补了必要修复，再按 Conventional Commits 规则提交最后一笔小修。
```

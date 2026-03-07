# RSS 源拉取异常指示 Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 在 RSS 源后台拉取失败时，让左栏对应 feed 显示异常态，并在 hover / focus 时展示稳定、安全的错误信息；下次拉取成功后自动恢复正常显示。

**Architecture:** 继续以 `feeds.last_fetch_status` / `feeds.last_fetch_error` 作为唯一持久化状态来源，不新增 `feed_tasks` 或额外 API。新增一个轻量 feed 抓取错误映射模块，把不稳定原始异常归一化为可展示短文案，再通过 `reader snapshot -> apiClient -> Feed -> FeedList` 链路透出到左栏 UI。为了不破坏新增/编辑 feed 流程，`mapFeedDto()` 必须对缺失的抓取结果字段做 `null` 默认值兼容，而不是要求所有 feed 返回接口立即携带该字段。

**Tech Stack:** Next.js App Router、TypeScript、pg、pg-boss worker、Zustand、Vitest、Radix Tooltip、pnpm

---

## 相关设计与既有经验

- 设计文档：`docs/plans/2026-03-07-rss-feed-fetch-error-indicator-design.md`
- 参考总结：`docs/summaries/2026-03-06-feed-category-inline-management.md`
  - 关键约束：feed 左栏状态必须继续由 snapshot 作为事实来源，不在 `FeedList` 本地维护第二套状态机。
- 参考总结：`docs/summaries/2026-03-04-async-tasks-refactor.md`
  - 关键约束：错误文案必须短、稳定、安全，不能把原始异常或堆栈直接暴露到 UI。
- 参考总结：`docs/summaries/2026-03-06-rss-feed-context-menu-redesign.md`
  - 关键约束：左栏交互区优先复用共享 UI 能力，避免在业务层堆一次性结构。

## 实施备注

1. 不新增数据库迁移。
2. 不新增 `/api/feeds/*` 错误状态接口。
3. “刷新接口入队失败”仍只走 toast，不写入 feed 异常态。
4. `Feed` 类型上的 `fetchStatus` / `fetchError` 设为必有字段（值允许为 `null`），由 `mapFeedDto()` 统一填充默认值。
5. `FeedList` 中若 `TooltipTrigger` 与 `ContextMenuTrigger` 共用同一个按钮发生 ref / event 冲突，优先增加一层中性包裹元素来承接 tooltip，而不是退回原生 `title`。

### Task 1: 归一化 feed 抓取错误文案

**Files:**

- Create: `src/server/tasks/feedFetchErrorMapping.ts`
- Test: `src/server/tasks/feedFetchErrorMapping.test.ts`
- Modify: `src/worker/index.ts`

**Step 1: Write the failing test**

```ts
// src/server/tasks/feedFetchErrorMapping.test.ts
import { describe, expect, it } from 'vitest';

describe('feedFetchErrorMapping', () => {
  it('maps timeout-like errors to a user-facing timeout message', async () => {
    const mod = await import('./feedFetchErrorMapping');
    expect(mod.mapFeedFetchError(new Error('timeout'))).toEqual({
      errorCode: 'fetch_timeout',
      errorMessage: '更新失败：请求超时',
    });
  });

  it('maps HTTP status errors to a stable message', async () => {
    const mod = await import('./feedFetchErrorMapping');
    expect(mod.mapFeedFetchError('HTTP 403')).toEqual({
      errorCode: 'fetch_http_error',
      errorMessage: '更新失败：源站拒绝访问（HTTP 403）',
    });
  });

  it('maps Unsafe URL to a safe message', async () => {
    const mod = await import('./feedFetchErrorMapping');
    expect(mod.mapFeedFetchError('Unsafe URL')).toEqual({
      errorCode: 'ssrf_blocked',
      errorMessage: '更新失败：地址不安全',
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/server/tasks/feedFetchErrorMapping.test.ts`

Expected: FAIL，因为 `src/server/tasks/feedFetchErrorMapping.ts` 尚不存在。

**Step 3: Write minimal implementation**

```ts
// src/server/tasks/feedFetchErrorMapping.ts
function toSafeMessage(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 200);
}

function getErrorText(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || err.name || 'Unknown error';
  return 'Unknown error';
}

export function mapFeedFetchError(err: unknown): { errorCode: string; errorMessage: string } {
  const safe = toSafeMessage(getErrorText(err));

  if (safe === 'Unsafe URL') {
    return { errorCode: 'ssrf_blocked', errorMessage: '更新失败：地址不安全' };
  }
  if (/timeout/i.test(safe)) {
    return { errorCode: 'fetch_timeout', errorMessage: '更新失败：请求超时' };
  }
  if (/^HTTP\s+403$/.test(safe)) {
    return { errorCode: 'fetch_http_error', errorMessage: '更新失败：源站拒绝访问（HTTP 403）' };
  }
  if (/^HTTP\s+\d+$/.test(safe)) {
    return { errorCode: 'fetch_http_error', errorMessage: `更新失败：请求异常（${safe})` };
  }
  if (/parse/i.test(safe) || /xml/i.test(safe) || /rss/i.test(safe)) {
    return { errorCode: 'parse_failed', errorMessage: '更新失败：RSS 解析失败' };
  }
  return { errorCode: 'unknown_error', errorMessage: '更新失败：发生未知错误' };
}
```

```ts
// src/worker/index.ts
import { mapFeedFetchError } from '../server/tasks/feedFetchErrorMapping';

// Unsafe URL 分支
await recordFeedFetchResult(pool, feedId, {
  status: null,
  error: mapFeedFetchError('Unsafe URL').errorMessage,
});

// HTTP status 分支
if (status < 200 || status >= 300) {
  error = mapFeedFetchError(`HTTP ${status}`).errorMessage;
  return { inserted: 0 };
}

// catch 分支
} catch (err) {
  error = mapFeedFetchError(err).errorMessage;
  return { inserted: 0 };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/server/tasks/feedFetchErrorMapping.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/server/tasks/feedFetchErrorMapping.ts src/server/tasks/feedFetchErrorMapping.test.ts src/worker/index.ts
git commit -m "🩹 fix(worker): 归一化 RSS 拉取错误文案" -m "- 添加 RSS 拉取错误安全文案映射
- 更新 worker 统一写入用户可读错误
- 保持成功抓取时覆盖清空旧错误"
```

### Task 2: 透出 feed 抓取结果到 repository 与 snapshot

**Files:**

- Create: `src/server/repositories/feedsRepo.fetchResult.test.ts`
- Create: `src/server/services/readerSnapshotService.feedFetchState.test.ts`
- Modify: `src/server/repositories/feedsRepo.ts`
- Modify: `src/server/services/readerSnapshotService.ts`

**Step 1: Write the failing test**

```ts
// src/server/repositories/feedsRepo.fetchResult.test.ts
import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

describe('feedsRepo (fetch result fields)', () => {
  it('listFeeds selects last fetch status and error', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    const mod = await import('./feedsRepo');

    await mod.listFeeds(pool);
    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('last_fetch_status');
    expect(sql).toContain('lastFetchStatus');
    expect(sql).toContain('last_fetch_error');
    expect(sql).toContain('lastFetchError');
  });

  it('recordFeedFetchResult writes null error to clear prior failures', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    const mod = await import('./feedsRepo');

    await mod.recordFeedFetchResult(pool, 'feed-1', { status: 200, error: null });
    expect(query.mock.calls[0]?.[1]).toEqual(['feed-1', null, null, 200, null]);
  });
});
```

```ts
// src/server/services/readerSnapshotService.feedFetchState.test.ts
import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

const listCategoriesMock = vi.fn();
const listFeedsMock = vi.fn();

vi.mock('../repositories/categoriesRepo', () => ({
  listCategories: (...args: unknown[]) => listCategoriesMock(...args),
}));

vi.mock('../repositories/feedsRepo', () => ({
  listFeeds: (...args: unknown[]) => listFeedsMock(...args),
}));

describe('readerSnapshotService (feed fetch state)', () => {
  it('returns last fetch state on snapshot feeds', async () => {
    listCategoriesMock.mockResolvedValue([]);
    listFeedsMock.mockResolvedValue([
      {
        id: 'feed-1',
        title: 'Example',
        url: 'https://example.com/rss.xml',
        siteUrl: null,
        iconUrl: null,
        enabled: true,
        fullTextOnOpenEnabled: false,
        aiSummaryOnOpenEnabled: false,
        titleTranslateEnabled: false,
        bodyTranslateEnabled: false,
        articleListDisplayMode: 'card',
        categoryId: null,
        fetchIntervalMinutes: 30,
        lastFetchStatus: 403,
        lastFetchError: '更新失败：源站拒绝访问（HTTP 403）',
      },
    ]);

    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    const mod = await import('./readerSnapshotService');
    const snapshot = await mod.getReaderSnapshot(pool, { view: 'all', limit: 10 });

    expect(snapshot.feeds[0]).toMatchObject({
      lastFetchStatus: 403,
      lastFetchError: '更新失败：源站拒绝访问（HTTP 403）',
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/server/repositories/feedsRepo.fetchResult.test.ts src/server/services/readerSnapshotService.feedFetchState.test.ts`

Expected: FAIL，因为 `listFeeds()` 与 `ReaderSnapshotFeed` 还没有透出抓取结果字段。

**Step 3: Write minimal implementation**

```ts
// src/server/repositories/feedsRepo.ts
export interface FeedRow {
  // ...existing fields...
  lastFetchStatus: number | null;
  lastFetchError: string | null;
}

export async function listFeeds(db: DbClient): Promise<FeedRow[]> {
  const { rows } = await db.query<FeedRow>(`
    select
      id,
      title,
      url,
      site_url as "siteUrl",
      icon_url as "iconUrl",
      enabled,
      full_text_on_open_enabled as "fullTextOnOpenEnabled",
      ai_summary_on_open_enabled as "aiSummaryOnOpenEnabled",
      ai_summary_on_fetch_enabled as "aiSummaryOnFetchEnabled",
      body_translate_on_fetch_enabled as "bodyTranslateOnFetchEnabled",
      body_translate_on_open_enabled as "bodyTranslateOnOpenEnabled",
      title_translate_enabled as "titleTranslateEnabled",
      body_translate_enabled as "bodyTranslateEnabled",
      article_list_display_mode as "articleListDisplayMode",
      category_id as "categoryId",
      fetch_interval_minutes as "fetchIntervalMinutes",
      last_fetch_status as "lastFetchStatus",
      last_fetch_error as "lastFetchError"
    from feeds
    order by created_at asc, id asc
  `);
  return rows;
}
```

```ts
// src/server/services/readerSnapshotService.ts
export interface ReaderSnapshotFeed {
  // ...existing fields...
  lastFetchStatus: number | null;
  lastFetchError: string | null;
  unreadCount: number;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/server/repositories/feedsRepo.fetchResult.test.ts src/server/services/readerSnapshotService.feedFetchState.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/server/repositories/feedsRepo.fetchResult.test.ts src/server/services/readerSnapshotService.feedFetchState.test.ts src/server/repositories/feedsRepo.ts src/server/services/readerSnapshotService.ts
git commit -m "♻️ refactor(reader): 透出 RSS 拉取结果字段" -m "- 添加 feed 最近抓取状态与错误字段查询
- 更新 reader snapshot 透出异常信息
- 保持 feeds 表现以 snapshot 为唯一事实来源"
```

### Task 3: 将抓取结果映射到客户端 Feed 模型并保持兼容

**Files:**

- Modify: `src/lib/apiClient.ts`
- Modify: `src/lib/apiClient.test.ts`
- Modify: `src/types/index.ts`
- Modify: `src/store/appStore.test.ts`

**Step 1: Write the failing test**

```ts
// src/lib/apiClient.test.ts
import { describe, expect, it } from 'vitest';
import { mapFeedDto } from './apiClient';

describe('mapFeedDto', () => {
  it('maps fetch result fields from snapshot feeds', () => {
    const mapped = mapFeedDto(
      {
        id: 'feed-1',
        title: 'Example',
        url: 'https://example.com/rss.xml',
        siteUrl: null,
        iconUrl: null,
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
        fetchIntervalMinutes: 30,
        unreadCount: 0,
        lastFetchStatus: 403,
        lastFetchError: '更新失败：源站拒绝访问（HTTP 403）',
      },
      [],
    );

    expect(mapped.fetchStatus).toBe(403);
    expect(mapped.fetchError).toBe('更新失败：源站拒绝访问（HTTP 403）');
  });

  it('defaults missing fetch result fields to null for create/edit payloads', () => {
    const mapped = mapFeedDto(
      {
        id: 'feed-2',
        title: 'Created Feed',
        url: 'https://example.com/new.xml',
        siteUrl: null,
        iconUrl: null,
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
        fetchIntervalMinutes: 30,
        unreadCount: 0,
      } as Parameters<typeof mapFeedDto>[0],
      [],
    );

    expect(mapped.fetchStatus).toBeNull();
    expect(mapped.fetchError).toBeNull();
  });
});
```

```ts
// src/store/appStore.test.ts
it('loads feed fetch error from reader snapshot into store', async () => {
  // snapshot payload feeds[0] 增加 lastFetchStatus / lastFetchError
  // 断言 useAppStore.getState().feeds[0].fetchError 被正确写入
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/lib/apiClient.test.ts src/store/appStore.test.ts`

Expected: FAIL，因为 `Feed` 与 `mapFeedDto()` 尚未映射 `fetchStatus` / `fetchError`。

**Step 3: Write minimal implementation**

```ts
// src/types/index.ts
export interface Feed {
  id: string;
  title: string;
  url: string;
  siteUrl?: string | null;
  icon?: string;
  unreadCount: number;
  enabled: boolean;
  fullTextOnOpenEnabled: boolean;
  aiSummaryOnOpenEnabled: boolean;
  aiSummaryOnFetchEnabled: boolean;
  bodyTranslateOnFetchEnabled: boolean;
  bodyTranslateOnOpenEnabled: boolean;
  titleTranslateEnabled: boolean;
  bodyTranslateEnabled: boolean;
  articleListDisplayMode: 'card' | 'list';
  categoryId?: string | null;
  category?: string | null;
  fetchStatus: number | null;
  fetchError: string | null;
}
```

```ts
// src/lib/apiClient.ts
export interface ReaderSnapshotDto {
  feeds: Array<{
    // ...existing fields...
    lastFetchStatus: number | null;
    lastFetchError: string | null;
  }>;
}

type FeedDtoLike =
  | ReaderSnapshotDto['feeds'][number]
  | (FeedRowDto & { unreadCount?: number; lastFetchStatus?: number | null; lastFetchError?: string | null });

export function mapFeedDto(dto: FeedDtoLike, categories: Category[]): Feed {
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  return {
    id: dto.id,
    title: dto.title,
    url: dto.url,
    siteUrl: dto.siteUrl,
    icon: dto.iconUrl ?? undefined,
    unreadCount: 'unreadCount' in dto ? dto.unreadCount ?? 0 : 0,
    enabled: dto.enabled,
    fullTextOnOpenEnabled: dto.fullTextOnOpenEnabled,
    aiSummaryOnOpenEnabled: dto.aiSummaryOnOpenEnabled,
    aiSummaryOnFetchEnabled: Boolean(dto.aiSummaryOnFetchEnabled),
    bodyTranslateOnFetchEnabled: Boolean(dto.bodyTranslateOnFetchEnabled),
    bodyTranslateOnOpenEnabled: Boolean(dto.bodyTranslateOnOpenEnabled),
    titleTranslateEnabled: dto.titleTranslateEnabled,
    bodyTranslateEnabled: dto.bodyTranslateEnabled,
    articleListDisplayMode: dto.articleListDisplayMode,
    categoryId: dto.categoryId,
    category: dto.categoryId ? categoryNameById.get(dto.categoryId) ?? null : null,
    fetchStatus: ('lastFetchStatus' in dto ? dto.lastFetchStatus : null) ?? null,
    fetchError: ('lastFetchError' in dto ? dto.lastFetchError : null) ?? null,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/lib/apiClient.test.ts src/store/appStore.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/lib/apiClient.ts src/lib/apiClient.test.ts src/types/index.ts src/store/appStore.test.ts
git commit -m "♻️ refactor(api): 映射订阅拉取异常状态" -m "- 扩展 Feed 模型支持最近拉取状态与错误
- 更新 mapFeedDto 兼容 snapshot 与创建编辑返回值
- 覆盖 store 读取异常状态的映射测试"
```

### Task 4: 在左栏展示异常态与 tooltip

**Files:**

- Modify: `src/features/feeds/FeedList.tsx`
- Modify: `src/features/feeds/FeedList.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/features/feeds/FeedList.test.tsx
it('shows tooltip and error styling for feeds with fetchError', async () => {
  useAppStore.setState({
    categories: [{ id: 'cat-uncategorized', name: '未分类', expanded: true }],
    feeds: [
      {
        id: 'feed-1',
        title: 'Broken Feed',
        url: 'https://example.com/rss.xml',
        siteUrl: null,
        icon: null,
        unreadCount: 0,
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
        fetchStatus: 403,
        fetchError: '更新失败：源站拒绝访问（HTTP 403）',
      },
    ],
    articles: [],
    selectedView: 'all',
    selectedArticleId: null,
  });

  render(
    <NotificationProvider>
      <ReaderLayout />
    </NotificationProvider>,
  );

  const feedButton = screen.getByRole('button', { name: /Broken Feed/i });
  fireEvent.mouseEnter(feedButton);

  expect(await screen.findByText('更新失败')).toBeInTheDocument();
  expect(await screen.findByText('更新失败：源站拒绝访问（HTTP 403）')).toBeInTheDocument();
  expect(feedButton.className).toMatch(/destructive|red/);
});

it('returns to normal styling after fetchError is cleared', async () => {
  // 先渲染带错误状态，再把 store 中的 fetchError 更新为 null
  // 断言 tooltip 文案消失，按钮不再带错误样式
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/features/feeds/FeedList.test.tsx`

Expected: FAIL，因为 `FeedList` 还没有根据 `fetchError` 渲染异常态和 tooltip。

**Step 3: Write minimal implementation**

```tsx
// src/features/feeds/FeedList.tsx
import { AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// 在 feed item 渲染处
const isFeedErrored = Boolean(feed.fetchError);

const feedButton = (
  <button
    type="button"
    onClick={() => setSelectedView(feed.id)}
    className={cn(
      'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
      selectedView === feed.id
        ? 'bg-primary/10 text-primary'
        : 'text-foreground hover:bg-accent hover:text-accent-foreground',
      !feed.enabled && 'opacity-60',
      isFeedErrored && 'text-destructive',
    )}
  >
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className={cn('relative flex h-4 w-4 shrink-0 items-center justify-center', isFeedErrored && 'text-destructive')}>
        {/* 现有 icon 逻辑 */}
      </span>
      <span className="truncate font-medium">{feed.title}</span>
      {isFeedErrored ? (
        <span className="sr-only">该订阅源最近更新失败</span>
      ) : null}
    </div>
    <div className="flex items-center gap-1">
      {isFeedErrored ? <AlertCircle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" /> : null}
      {/* 现有 unread badge */}
    </div>
  </button>
);

// 如果嵌套 trigger 有冲突，改为 TooltipTrigger 包裹一个 span，再把 ContextMenuTrigger 仍挂在 button 上。
```

```tsx
// 包装逻辑
{isFeedErrored ? (
  <TooltipProvider delayDuration={150}>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block">
          <ContextMenuTrigger asChild>{feedButton}</ContextMenuTrigger>
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-64 whitespace-normal">
        <div className="space-y-1">
          <p className="font-medium">更新失败</p>
          <p>{feed.fetchError}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
) : (
  <ContextMenuTrigger asChild>{feedButton}</ContextMenuTrigger>
)}
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/features/feeds/FeedList.test.tsx`

Expected: PASS。

**Step 5: Commit**

```bash
git add src/features/feeds/FeedList.tsx src/features/feeds/FeedList.test.tsx
git commit -m "✨ feat(feeds): 显示 RSS 拉取异常提示" -m "- 添加左栏 RSS 源更新失败异常态
- 复用 Tooltip 展示具体抓取错误信息
- 保持选中态、右键菜单与可访问性语义兼容"
```

### Task 5: 运行聚焦验证并做一次全链路回归

**Files:**

- Verify: `src/server/tasks/feedFetchErrorMapping.test.ts`
- Verify: `src/server/repositories/feedsRepo.fetchResult.test.ts`
- Verify: `src/server/services/readerSnapshotService.feedFetchState.test.ts`
- Verify: `src/lib/apiClient.test.ts`
- Verify: `src/store/appStore.test.ts`
- Verify: `src/features/feeds/FeedList.test.tsx`

**Step 1: Run focused test suite**

Run: `pnpm run test:unit -- src/server/tasks/feedFetchErrorMapping.test.ts src/server/repositories/feedsRepo.fetchResult.test.ts src/server/services/readerSnapshotService.feedFetchState.test.ts src/lib/apiClient.test.ts src/store/appStore.test.ts`

Expected: PASS。

**Step 2: Run UI-focused test file**

Run: `pnpm exec vitest run src/features/feeds/FeedList.test.tsx`

Expected: PASS。

**Step 3: Run lint**

Run: `pnpm run lint`

Expected: PASS。

**Step 4: If any snapshot helper broke, update the minimum necessary fixtures**

重点检查 `FeedList.test.tsx` 中的 `snapshotResponseFromStore()` 是否把 `fetchStatus` / `fetchError` 带回 `/api/reader/snapshot` mock；若缺失，只补这两个字段，不顺手改其它测试结构。

**Step 5: Commit final verification tweaks**

```bash
git add src/server/tasks/feedFetchErrorMapping.test.ts src/server/repositories/feedsRepo.fetchResult.test.ts src/server/services/readerSnapshotService.feedFetchState.test.ts src/lib/apiClient.test.ts src/store/appStore.test.ts src/features/feeds/FeedList.test.tsx
git commit -m "✅ test(feeds): 补齐 RSS 拉取异常状态回归覆盖" -m "- 添加 repository 到 UI 的异常状态回归测试
- 验证抓取成功覆盖清空旧错误的链路
- 收紧左栏异常态与 tooltip 交互断言"
```

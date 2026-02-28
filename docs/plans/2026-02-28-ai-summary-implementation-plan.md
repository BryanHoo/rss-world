# AI 摘要（按订阅源开关 + worker 生成）Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 在 FeedFuse 中实现 AI 摘要：按订阅源（feed）配置自动/手动触发；摘要由 pg-boss + worker 异步生成并写回 `articles.ai_summary`，前端轮询刷新展示（输出固定中文）。

**Architecture:** 在 `feeds` 表新增 `ai_summary_on_open_enabled` 开关并通过 feeds API/snapshot 下发；新增 `POST /api/articles/:id/ai-summary` 将 `ai.summarize_article` job 入队（singleton 幂等）；worker 消费 job，优先使用 `contentFullHtml`（如该 feed 开启全文抓取则等待全文或失败后回退 RSS），调用 OpenAI 兼容 `chat/completions` 生成中文摘要并写回 DB；前端 `ArticleView` 在“自动模式”打开文章时自动触发入队并轮询直到拿到摘要，在“手动模式”展示按钮并按规则禁用/触发。

**Tech Stack:** TypeScript, Next.js App Router Route Handlers, Postgres (`pg`), Zustand, shadcn/ui (Radix Select/Dialog), `pg-boss`, Vitest, pnpm, Node `fetch`.

---

## 我在用的 skill

我在用 `workflow-writing-plans` 来创建实现计划（Implementation Plan）。

## Inputs（先读这些再动手）

- 设计文档：`docs/plans/2026-02-28-ai-summary-design.md`
- 相关 prior art（复用结构/测试习惯）：
  - `docs/plans/2026-02-27-rss-fulltext-per-feed-implementation-plan.md`（feed 级开关：迁移/feeds API/UI 模式）
  - `docs/plans/2026-02-26-rss-fulltext-implementation-plan.md`（全文抓取异步 + 前端轮询刷新）
  - `docs/plans/2026-02-24-feedfuse-backend-implementation-plan.md`（pg-boss wrapper、worker 模式、job 命名）
- 关键代码入口（调用链）：
  - DB migrations：`src/server/db/migrations/*`
  - feeds repo：`src/server/repositories/feedsRepo.ts`
  - articles repo：`src/server/repositories/articlesRepo.ts`
  - settings repo：`src/server/repositories/settingsRepo.ts`（`getUiSettings`、`getAiApiKey`）
  - snapshot：`src/server/services/readerSnapshotService.ts`、`src/app/api/reader/snapshot/route.ts`
  - feeds API：`src/app/api/feeds/route.ts`、`src/app/api/feeds/[id]/route.ts`
  - article API：`src/app/api/articles/[id]/route.ts`、`src/app/api/articles/[id]/fulltext/route.ts`
  - queue wrapper：`src/server/queue/queue.ts`、`src/server/queue/jobs.ts`
  - worker：`src/worker/index.ts`
  - client API：`src/lib/apiClient.ts`
  - store：`src/store/appStore.ts`
  - feed UI：`src/features/feeds/AddFeedDialog.tsx`、`src/features/feeds/EditFeedDialog.tsx`、`src/features/feeds/FeedList.tsx`
  - article UI：`src/features/articles/ArticleView.tsx`
- 验证命令：
  - 单测：`pnpm run test:unit`
  - Lint：`pnpm run lint`
  - 构建：`pnpm run build`
  - DB 迁移：`node scripts/db/migrate.mjs`
  - worker：`pnpm run worker:dev`

## Key Risks / Pitfalls（实现时别踩）

1) **类型变更会波及大量 fixture/stub**：`Feed`/feeds DTO 增加字段后，`appStore.test.ts`、`AddFeedDialog.test.tsx`、`FeedList.test.tsx`、`/api/reader/snapshot/route.test.ts`、`/api/feeds/routes.test.ts` 等都要补齐字段，避免运行时报错/断言失败。
2) **“全文未返回禁用按钮”的边界条件**：不能简单用 `!contentFullHtml` 判断，否则在 `POST /api/articles/:id/fulltext` 返回 `{ enqueued: false }` 的场景（RSS 已足够完整、无 link）会造成按钮永久禁用；应以“全文抓取确实在进行中（已入队且未完成/未失败）”为禁用条件。
3) **配置来源一致性**：`ai_api_key` 存 DB，但 `model/apiBaseUrl` 在 `ui_settings`；worker 必须从 `getUiSettings()` normalize 后读取并做空值默认，否则会出现“前端配置了但 worker 不生效”的错觉。
4) **OpenAI 兼容 API 的返回格式不稳定**：解析 `choices[0].message.content` 前要做健壮校验；失败时要让 job 可重试/可失败并在前端超时提示。
5) **幂等**：必须同时使用 `singletonKey`（队列去重）与“已有 `ai_summary` 则跳过”（DB 幂等），避免重复扣费。

---

## Phase 0：准备工作（隔离变更 + 建立基线）

### Task 1: 在独立 worktree/分支上执行（推荐）

**Files:** 无

**Step 1: 创建 worktree**

Run:

```bash
git fetch
git worktree add -b codex/ai-summary ../feedfuse-ai-summary
```

Expected: 生成目录 `../feedfuse-ai-summary`，后续步骤在该目录执行。

**Step 2: 基线验证（改动前先全绿）**

Run:

```bash
pnpm run lint
pnpm run test:unit
pnpm run build
```

Expected: 全部 PASS。

---

## Phase 1：数据库 schema（feeds 增加 AI 摘要开关字段）

### Task 2: 先写 migration 测试（先红）

**Files:**

- Create: `src/server/db/migrations/feedAiSummaryOnOpenMigration.test.ts`

**Step 1: 写 failing test（迁移文件还不存在）**

```ts
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('db migrations', () => {
  it('adds ai-summary-on-open flag to feeds', () => {
    const migrationPath = 'src/server/db/migrations/0007_feed_ai_summary_on_open.sql';
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('alter table feeds');
    expect(sql).toContain('ai_summary_on_open_enabled');
  });
});
```

**Step 2: 运行测试确认失败**

Run:

```bash
pnpm run test:unit -- src/server/db/migrations/feedAiSummaryOnOpenMigration.test.ts
```

Expected: FAIL（迁移文件不存在）。

### Task 3: 添加 migration SQL（转绿）

**Files:**

- Create: `src/server/db/migrations/0007_feed_ai_summary_on_open.sql`
- Test: `src/server/db/migrations/feedAiSummaryOnOpenMigration.test.ts`

**Step 1: 添加 migration**

```sql
alter table feeds
  add column if not exists ai_summary_on_open_enabled boolean not null default false;
```

**Step 2: 运行测试确认通过**

Run:

```bash
pnpm run test:unit -- src/server/db/migrations/feedAiSummaryOnOpenMigration.test.ts
```

Expected: PASS。

**Step 3: Commit**

```bash
git add src/server/db/migrations/0007_feed_ai_summary_on_open.sql src/server/db/migrations/feedAiSummaryOnOpenMigration.test.ts
git commit -m "feat(db): feeds 增加摘要开关字段"
```

---

## Phase 2：数据层（feedsRepo / snapshot 下发）

### Task 4: 为 feedsRepo 增加最小单测锁行为（先红）

**Files:**

- Create: `src/server/repositories/feedsRepo.aiSummaryOnOpen.test.ts`

**Step 1: 写 failing tests（先锁住 SQL 是否包含新列）**

```ts
import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

describe('feedsRepo (aiSummaryOnOpenEnabled)', () => {
  it('listFeeds selects ai_summary_on_open_enabled', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./feedsRepo')) as typeof import('./feedsRepo');

    await mod.listFeeds(pool);
    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('ai_summary_on_open_enabled');
    expect(sql).toContain('aiSummaryOnOpenEnabled');
  });

  it('createFeed inserts and returns ai_summary_on_open_enabled', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'f1' }] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./feedsRepo')) as typeof import('./feedsRepo');

    await mod.createFeed(pool, { title: 'A', url: 'https://example.com/rss.xml' } as any);
    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('ai_summary_on_open_enabled');
    expect(sql).toContain('aiSummaryOnOpenEnabled');
  });

  it('updateFeed supports aiSummaryOnOpenEnabled patch and returns it', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'f1' }] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./feedsRepo')) as typeof import('./feedsRepo');

    await mod.updateFeed(pool, 'f1', { aiSummaryOnOpenEnabled: true } as any);
    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('ai_summary_on_open_enabled');
    expect(sql).toContain('aiSummaryOnOpenEnabled');
  });
});
```

**Step 2: 运行测试确认失败**

Run:

```bash
pnpm run test:unit -- src/server/repositories/feedsRepo.aiSummaryOnOpen.test.ts
```

Expected: FAIL（repo SQL 尚未包含新列）。

### Task 5: 实现 feedsRepo 新字段（转绿）

**Files:**

- Modify: `src/server/repositories/feedsRepo.ts`
- Test: `src/server/repositories/feedsRepo.aiSummaryOnOpen.test.ts`

**Step 1: 扩展 repo 类型**

在 `FeedRow` 增加：

```ts
aiSummaryOnOpenEnabled: boolean;
```

**Step 2: 更新 SQL 读写**

在：

- `listFeeds`：select 增加 `ai_summary_on_open_enabled as "aiSummaryOnOpenEnabled"`
- `createFeed`：insert 增加列 `ai_summary_on_open_enabled` 与对应 values；`returning` 同步增加
- `updateFeed`：支持 patch `aiSummaryOnOpenEnabled`（动态字段）并在 `returning` 中返回

`createFeed` 默认值：

```ts
aiSummaryOnOpenEnabled: input.aiSummaryOnOpenEnabled ?? false
```

**Step 3: 运行测试**

Run:

```bash
pnpm run test:unit -- src/server/repositories/feedsRepo.aiSummaryOnOpen.test.ts
```

Expected: PASS。

**Step 4: Commit**

```bash
git add src/server/repositories/feedsRepo.ts src/server/repositories/feedsRepo.aiSummaryOnOpen.test.ts
git commit -m "feat(backend): feedsRepo 支持摘要开关"
```

### Task 6: snapshot 下发新字段

**Files:**

- Modify: `src/server/services/readerSnapshotService.ts`
- Test: `src/app/api/reader/snapshot/route.test.ts`

**Step 1: 扩展 snapshot feed 类型**

在 `ReaderSnapshotFeed` 增加：

```ts
aiSummaryOnOpenEnabled: boolean;
```

并确保 `feedsWithUnread` 透传该字段（来自 `listFeeds` 的 `FeedRow`）。

**Step 2: 更新 API route test fixture**

在 `src/app/api/reader/snapshot/route.test.ts` 的 feeds fixture 补齐：

```ts
aiSummaryOnOpenEnabled: false,
```

**Step 3: 运行测试**

Run:

```bash
pnpm run test:unit -- src/app/api/reader/snapshot/route.test.ts
```

Expected: PASS。

**Step 4: Commit**

```bash
git add src/server/services/readerSnapshotService.ts src/app/api/reader/snapshot/route.test.ts
git commit -m "feat(api): snapshot 下发摘要开关"
```

---

## Phase 3：feeds API（POST/PATCH/GET 支持新字段）

### Task 7: 扩展 feeds routes（先改测试再改实现）

**Files:**

- Test: `src/app/api/feeds/routes.test.ts`
- Modify: `src/app/api/feeds/route.ts`
- Modify: `src/app/api/feeds/[id]/route.ts`

**Step 1: 先更新测试 fixture / 断言（先红）**

在 `src/app/api/feeds/routes.test.ts`：

- `POST creates a feed`：请求 body 增加 `aiSummaryOnOpenEnabled: true`，并断言 `createFeedMock` 收到该字段
- `createFeedMock.mockResolvedValue(...)` / `updateFeedMock.mockResolvedValue(...)` 返回补齐：

```ts
aiSummaryOnOpenEnabled: true,
```

并在 GET fixture 补齐 `fullTextOnOpenEnabled` 与 `aiSummaryOnOpenEnabled`（保持 DTO 完整）。

**Step 2: 运行测试确认失败**

Run:

```bash
pnpm run test:unit -- src/app/api/feeds/routes.test.ts
```

Expected: FAIL（route schema/透传尚未实现）。

**Step 3: 实现 POST 支持字段**

在 `src/app/api/feeds/route.ts`：

- `createFeedBodySchema` 增加：

```ts
aiSummaryOnOpenEnabled: z.boolean().optional(),
```

- `createFeed(...)` 入参透传：

```ts
aiSummaryOnOpenEnabled: parsed.data.aiSummaryOnOpenEnabled ?? false,
```

**Step 4: 实现 PATCH 支持字段**

在 `src/app/api/feeds/[id]/route.ts`：

- `patchBodySchema` 增加：

```ts
aiSummaryOnOpenEnabled: z.boolean().optional(),
```

并让 `updateFeed(...)` 透传该字段。

**Step 5: 运行测试确认通过**

Run:

```bash
pnpm run test:unit -- src/app/api/feeds/routes.test.ts
```

Expected: PASS。

**Step 6: Commit**

```bash
git add src/app/api/feeds/route.ts src/app/api/feeds/[id]/route.ts src/app/api/feeds/routes.test.ts
git commit -m "feat(api): feeds 支持摘要开关字段"
```

---

## Phase 4：前端类型与 DTO（Feed 增加字段）

### Task 8: 扩展 client DTO + 映射（会连锁修测试）

**Files:**

- Modify: `src/types/index.ts`
- Modify: `src/lib/apiClient.ts`
- Test: `src/store/appStore.test.ts`
- Test: `src/features/feeds/AddFeedDialog.test.tsx`
- Test: `src/app/api/reader/snapshot/route.test.ts`

**Step 1: 扩展前端 Feed 类型**

在 `src/types/index.ts` 的 `Feed` 增加：

```ts
aiSummaryOnOpenEnabled: boolean;
```

**Step 2: 扩展 DTO 并透传映射**

在 `src/lib/apiClient.ts`：

- `ReaderSnapshotDto.feeds[]` 增加 `aiSummaryOnOpenEnabled: boolean`
- `FeedRowDto` 增加 `aiSummaryOnOpenEnabled: boolean`
- `createFeed(...)` / `patchFeed(...)` 的 input 支持 `aiSummaryOnOpenEnabled?: boolean`
- `mapFeedDto(...)` 注入：

```ts
aiSummaryOnOpenEnabled: dto.aiSummaryOnOpenEnabled,
```

**Step 3: 补齐测试 stub**

至少更新：

- `src/store/appStore.test.ts` 中 snapshot feeds fixture 增加 `aiSummaryOnOpenEnabled: false`
- `src/features/feeds/AddFeedDialog.test.tsx` 中创建 feed 响应数据补齐 `aiSummaryOnOpenEnabled: Boolean(body.aiSummaryOnOpenEnabled ?? false)`

**Step 4: 运行测试**

Run:

```bash
pnpm run test:unit -- src/store/appStore.test.ts src/features/feeds/AddFeedDialog.test.tsx src/app/api/reader/snapshot/route.test.ts
```

Expected: PASS。

**Step 5: Commit**

```bash
git add src/types/index.ts src/lib/apiClient.ts src/store/appStore.test.ts src/features/feeds/AddFeedDialog.test.tsx src/app/api/reader/snapshot/route.test.ts
git commit -m "feat(client): Feed 增加摘要开关字段"
```

---

## Phase 5：Feed UI（新增/编辑支持摘要开关）

### Task 9: 扩展 appStore 的 addFeed/updateFeed 入参

**Files:**

- Modify: `src/store/appStore.ts`
- Test: `src/store/appStore.test.ts`

**Step 1: 扩展 `addFeed` 与 `updateFeed` 入参类型**

在 `AppState`：

- `addFeed(...)` payload 增加 `aiSummaryOnOpenEnabled?: boolean`
- `updateFeed(...)` patch 增加 `aiSummaryOnOpenEnabled?: boolean`

并把字段透传给 `createFeed(...)` / `patchFeed(...)`。

**Step 2: 运行测试**

Run:

```bash
pnpm run test:unit -- src/store/appStore.test.ts
```

Expected: PASS。

**Step 3: Commit**

```bash
git add src/store/appStore.ts src/store/appStore.test.ts
git commit -m "feat(store): feeds 支持摘要开关字段"
```

### Task 10: `AddFeedDialog` 增加 UI 字段与测试

**Files:**

- Modify: `src/features/feeds/AddFeedDialog.tsx`
- Test: `src/features/feeds/AddFeedDialog.test.tsx`

**Step 1: 增加选择器（默认关闭）**

仿照现有“打开文章时抓取全文”，增加：

- Label：`打开文章时自动生成 AI 摘要`
- Select options：`关闭` / `开启`
- payload：`aiSummaryOnOpenEnabled: aiSummaryOnOpenEnabledValue === 'enabled'`

**Step 2: 更新测试**

在 `AddFeedDialog.test.tsx`：

- 默认提交断言 `lastCreateFeedBody?.aiSummaryOnOpenEnabled === false`
- 新增用例：选择“开启”后提交断言为 `true`（同 fulltext 的写法）

**Step 3: 运行测试**

Run:

```bash
pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx
```

Expected: PASS。

**Step 4: Commit**

```bash
git add src/features/feeds/AddFeedDialog.tsx src/features/feeds/AddFeedDialog.test.tsx
git commit -m "feat(ui): 添加订阅源支持摘要开关"
```

### Task 11: `EditFeedDialog` 增加 UI 字段

**Files:**

- Modify: `src/features/feeds/EditFeedDialog.tsx`
- Modify: `src/features/feeds/FeedList.tsx`
- Test: `src/features/feeds/FeedList.test.tsx`

**Step 1: `EditFeedDialog` 增加选择器**

- 初始值来自 `feed.aiSummaryOnOpenEnabled`
- `onSubmit` payload 增加 `aiSummaryOnOpenEnabled`

**Step 2: `FeedList` 透传到 store**

- 新增 feed 时：`addFeed({ ..., aiSummaryOnOpenEnabled })`
- 编辑 feed 时：`updateFeed(feedId, { ..., aiSummaryOnOpenEnabled })`

**Step 3: 更新 `FeedList.test.tsx` stub**

确保 mock 的 feed DTO 与 PATCH 响应都带上 `aiSummaryOnOpenEnabled`，并增加断言验证编辑后 store 内该字段更新。

**Step 4: 运行测试**

Run:

```bash
pnpm run test:unit -- src/features/feeds/FeedList.test.tsx
```

Expected: PASS。

**Step 5: Commit**

```bash
git add src/features/feeds/EditFeedDialog.tsx src/features/feeds/FeedList.tsx src/features/feeds/FeedList.test.tsx
git commit -m "feat(ui): 编辑订阅源支持摘要开关"
```

---

## Phase 6：articlesRepo（读写 AI 摘要字段）+ Article API DTO

### Task 12: 先为 articlesRepo 增加最小单测（先红）

**Files:**

- Create: `src/server/repositories/articlesRepo.aiSummary.test.ts`

**Step 1: 写 failing tests（先锁住 SQL 包含 ai_summary）**

```ts
import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

describe('articlesRepo (ai summary)', () => {
  it('getArticleById selects ai_summary fields', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./articlesRepo')) as typeof import('./articlesRepo');

    await mod.getArticleById(pool, 'a1');
    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('ai_summary');
    expect(sql).toContain('ai_summary_model');
    expect(sql).toContain('ai_summarized_at');
  });

  it('setArticleAiSummary updates ai_summary fields', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./articlesRepo')) as typeof import('./articlesRepo');

    if (typeof (mod as any).setArticleAiSummary !== 'function') {
      expect.fail('setArticleAiSummary is not implemented');
    }

    await (mod as any).setArticleAiSummary(pool, 'a1', {
      aiSummary: 'hello',
      aiSummaryModel: 'gpt-4o-mini',
    });
    const sql = String(query.mock.calls[1]?.[0] ?? '');
    expect(sql).toContain('ai_summary');
    expect(sql).toContain('ai_summarized_at');
  });
});
```

**Step 2: 运行测试确认失败**

Run:

```bash
pnpm run test:unit -- src/server/repositories/articlesRepo.aiSummary.test.ts
```

Expected: FAIL（字段未 select / set 函数不存在）。

### Task 13: 实现 articlesRepo 读写摘要字段（转绿）

**Files:**

- Modify: `src/server/repositories/articlesRepo.ts`
- Test: `src/server/repositories/articlesRepo.aiSummary.test.ts`
- Modify: `src/lib/apiClient.ts`
- Modify: `src/types/index.ts`

**Step 1: 扩展 `ArticleRow` 与查询**

在 `ArticleRow` 增加：

```ts
aiSummary: string | null;
aiSummaryModel: string | null;
aiSummarizedAt: string | null;
```

并在 `getArticleById`/`insertArticleIgnoreDuplicate` 的 `select/returning` 增加：

```sql
ai_summary as "aiSummary",
ai_summary_model as "aiSummaryModel",
ai_summarized_at as "aiSummarizedAt"
```

**Step 2: 新增写回方法**

新增：

```ts
export async function setArticleAiSummary(
  pool: Pool,
  id: string,
  input: { aiSummary: string; aiSummaryModel: string },
): Promise<void>
```

SQL：

- set `ai_summary = $2`
- set `ai_summary_model = $3`
- set `ai_summarized_at = now()`

**Step 3: 更新 client Article DTO**

在 `src/lib/apiClient.ts` 的 `ArticleDto` 增加：

```ts
aiSummary: string | null;
aiSummaryModel: string | null;
aiSummarizedAt: string | null;
```

在前端 `Article` 类型（`src/types/index.ts`）增加可选字段（避免影响列表）：

```ts
aiSummary?: string;
```

并在 `mapArticleDto(...)` 注入：

```ts
aiSummary: dto.aiSummary ?? undefined,
```

**Step 4: 运行 repo 测试**

Run:

```bash
pnpm run test:unit -- src/server/repositories/articlesRepo.aiSummary.test.ts
```

Expected: PASS。

**Step 5: Commit**

```bash
git add src/server/repositories/articlesRepo.ts src/server/repositories/articlesRepo.aiSummary.test.ts src/lib/apiClient.ts src/types/index.ts
git commit -m "feat(backend): articles 支持 AI 摘要字段"
```

---

## Phase 7：API（入队生成摘要）

### Task 14: 先写 API tests（先红）

**Files:**

- Test: `src/app/api/articles/routes.test.ts`

**Step 1: 增加 mocks**

在 `routes.test.ts` 增加：

- `getAiApiKeyMock`（mock `src/server/repositories/settingsRepo` 的 `getAiApiKey`）
- 在 `vi.mock(...settingsRepo...)` 中导出该方法

**Step 2: 新增测试用例**

新增测试（示例结构）：

1) missing api key：

- `getAiApiKeyMock.mockResolvedValue('')`
- 期望：`POST /:id/ai-summary` 返回 `{ enqueued: false, reason: 'missing_api_key' }`

2) already summarized：

- `getAiApiKeyMock.mockResolvedValue('sk-test')`
- `getArticleByIdMock.mockResolvedValue({ aiSummary: 'done', ... })`
- 期望：`{ enqueued: false, reason: 'already_summarized' }`

3) enqueue ok：

- `enqueueMock.mockResolvedValue('job-id-1')`
- 期望 enqueue 被调用：

```ts
expect(enqueueMock).toHaveBeenCalledWith(
  'ai.summarize_article',
  { articleId },
  expect.objectContaining({
    singletonKey: articleId,
    singletonSeconds: 600,
    retryLimit: 8,
    retryDelay: 30,
  }),
);
```

4) already enqueued：

- `enqueueMock.mockRejectedValue(new Error('Failed to enqueue job'))`
- 期望：`{ enqueued: false, reason: 'already_enqueued' }`

**Step 3: 运行测试确认失败**

Run:

```bash
pnpm run test:unit -- src/app/api/articles/routes.test.ts
```

Expected: FAIL（route 尚不存在）。

### Task 15: 实现 `POST /api/articles/:id/ai-summary`（转绿）

**Files:**

- Create: `src/app/api/articles/[id]/ai-summary/route.ts`
- Test: `src/app/api/articles/routes.test.ts`

**Step 1: 实现 route（参考 fulltext route 风格）**

要点：

- params zod：`id` uuid
- 读取文章：`getArticleById(pool, articleId)`；不存在 → `NotFoundError`
- 读取 key：`getAiApiKey(pool)`；空 → `ok({ enqueued: false, reason: 'missing_api_key' })`
- 已有摘要（`aiSummary` 非空）→ `ok({ enqueued: false, reason: 'already_summarized' })`
- 入队：

```ts
const jobId = await enqueue(
  JOB_AI_SUMMARIZE,
  { articleId },
  { singletonKey: articleId, singletonSeconds: 600, retryLimit: 8, retryDelay: 30 },
);
```

- 捕获 `Failed to enqueue job` → `ok({ enqueued: false, reason: 'already_enqueued' })`

**Step 2: 运行测试确认通过**

Run:

```bash
pnpm run test:unit -- src/app/api/articles/routes.test.ts
```

Expected: PASS。

**Step 3: Commit**

```bash
git add src/app/api/articles/[id]/ai-summary/route.ts src/app/api/articles/routes.test.ts
git commit -m "feat(api): 支持文章 AI 摘要入队"
```

---

## Phase 8：worker（消费 ai.summarize_article 生成摘要并写回）

### Task 16: 新增 AI 摘要模块（先写单测）

**Files:**

- Create: `src/server/ai/summarizeText.test.ts`
- Create: `src/server/ai/summarizeText.ts`

**Step 1: 写 failing test（stub fetch，锁住请求形状）**

```ts
import { describe, expect, it, vi } from 'vitest';

describe('summarizeText', () => {
  it('calls chat/completions and returns content', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'TL;DR: ...' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const { summarizeText } = await import('./summarizeText');
    const out = await summarizeText({
      apiBaseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      text: 'hello',
    });

    expect(out).toContain('TL;DR');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
```

**Step 2: 运行测试确认失败**

Run:

```bash
pnpm run test:unit -- src/server/ai/summarizeText.test.ts
```

Expected: FAIL（模块不存在）。

**Step 3: 实现最小 `summarizeText`（转绿）**

实现要求：

- baseUrl 去尾 `/`
- 发送 system+user messages，强制中文输出（TL;DR + 要点）
- 解析 `choices[0].message.content`，不存在则抛错

**Step 4: 运行测试确认通过**

Run:

```bash
pnpm run test:unit -- src/server/ai/summarizeText.test.ts
```

Expected: PASS。

**Step 5: Commit**

```bash
git add src/server/ai/summarizeText.ts src/server/ai/summarizeText.test.ts
git commit -m "feat(worker): 增加 AI 摘要请求模块"
```

### Task 17: 在 worker 中消费 job 并写回

**Files:**

- Modify: `src/worker/index.ts`
- Modify: `src/server/queue/jobs.ts`
- Modify: `src/server/repositories/articlesRepo.ts`

**Step 1: worker 增加队列与 handler**

- `createQueue(JOB_AI_SUMMARIZE)`
- `work(JOB_AI_SUMMARIZE, ...)`：
  - 读取文章（`getArticleById`）
  - 若已 `aiSummary`：return
  - 读取 `getAiApiKey`：空则 return
  - 读取 `getUiSettings` + `normalizePersistedSettings`：得到 `model/apiBaseUrl`，为空用默认
  - 若 feed 开启全文抓取且 `contentFullHtml` 为空且 `contentFullError` 为空：`throw new Error('Fulltext pending')`（让 pg-boss 按 retry 重试）
  - 否则选择 HTML：`contentFullHtml ?? contentHtml ?? summary`；都为空则 return
  - HTML→text + 长度限制
  - `summarizeText(...)`
  - `setArticleAiSummary(...)` 写回

**Step 2: 最小手工验证（不跑真实 OpenAI 可先用假 baseUrl）**

Run（需要 DB 与迁移已执行）：

```bash
docker compose up -d db
node scripts/db/migrate.mjs
pnpm run worker:dev
```

Expected: worker 启动成功且注册 `ai.summarize_article` job，不报队列缺失错误。

**Step 3: Commit**

```bash
git add src/worker/index.ts src/server/repositories/articlesRepo.ts src/server/queue/jobs.ts
git commit -m "feat(worker): 消费文章摘要任务并写回"
```

---

## Phase 9：ArticleView（自动/手动触发 + 禁用规则 + 展示）

### Task 18: client API 增加入队方法

**Files:**

- Modify: `src/lib/apiClient.ts`

**Step 1: 增加函数**

```ts
export async function enqueueArticleAiSummary(
  articleId: string,
): Promise<{ enqueued: boolean; jobId?: string; reason?: string }> {
  return requestApi(`/api/articles/${encodeURIComponent(articleId)}/ai-summary`, { method: 'POST' });
}
```

**Step 2: Commit**

```bash
git add src/lib/apiClient.ts
git commit -m "feat(client): 增加文章摘要入队调用"
```

### Task 19: 实现 `ArticleView` UI 与交互（建议加单测）

**Files:**

- Modify: `src/features/articles/ArticleView.tsx`
- Modify: `src/store/appStore.ts`
- Test: `src/features/articles/ArticleView.aiSummary.test.tsx`（建议）

**Step 1: store 合并文章时保留 `aiSummary`**

确保 `mapArticleDto(...)` 已把 `aiSummary` 注入 `Article`，并且 `refreshArticle(...)` 更新文章时会合并该字段。

**Step 2: `ArticleView` 增加摘要展示块**

- 当 `article.aiSummary` 存在：展示内容
- 当处于生成中：展示 “正在生成摘要…”（spinner）
- 当缺少 API Key（入队返回 `missing_api_key`）：展示提示“请在设置中配置 API Key”

**Step 3: 自动模式（feed.aiSummaryOnOpenEnabled=true）**

在选中文章的 effect 中：

- 若无 `aiSummary`：调用 `enqueueArticleAiSummary(articleId)`（忽略 already_enqueued / already_summarized）
- 轮询 `refreshArticle(articleId)`（例如最多 30 次，每次 1s），直到拿到 `aiSummary`

**Step 4: 手动模式（feed.aiSummaryOnOpenEnabled=false）**

- 显示按钮 `AI摘要`
- 禁用规则（避免“永久禁用”）：
  - 仅当 **该 feed 开启全文抓取** 且 **全文抓取已入队并仍未完成/未失败** 才禁用
  - 实现建议：引入 `fulltextPending` 本地状态（当 `/fulltext` 返回 `enqueued=true` 置 `true`，当拿到 `contentFullHtml` 或 `contentFullError` 置 `false`）
- 点击按钮：
  - 调用 `enqueueArticleAiSummary(articleId)`
  - 轮询 `refreshArticle(articleId)` 直到拿到 `aiSummary` 或超时提示

**Step 5:（建议）补一个最小 UI 测试**

`ArticleView.aiSummary.test.tsx` 目标：

- 手动模式：当 `fulltextPending=true` 时按钮禁用；当 `contentFullError='timeout'` 时按钮可点击并触发 `/ai-summary` 请求
- 自动模式：打开文章后会调用 `/ai-summary`

**Step 6: Commit**

```bash
git add src/features/articles/ArticleView.tsx src/store/appStore.ts src/features/articles/ArticleView.aiSummary.test.tsx
git commit -m "feat(ui): 文章页支持 AI 摘要"
```

---

## Phase 10：收尾验证

### Task 20: 全量验证（必须）

**Files:** 无

Run:

```bash
pnpm run lint
pnpm run test:unit
pnpm run build
```

Expected: 全部 PASS。

### Task 21: 手工验收（推荐）

1) 配置 AI Key（设置中心 → AI → API Key 保存成功）
2) 新增或编辑某个 feed：
   - `打开文章时抓取全文`：可开可关
   - `打开文章时自动生成 AI 摘要`：开/关各验证一次
3) 开启自动摘要：
   - 点开文章 → 自动生成摘要并展示
   - 若同时开启全文抓取：摘要最终基于全文（全文成功时）；全文失败/超时后仍可基于 RSS 生成（手动按钮场景）
4) 关闭自动摘要：
   - 按钮存在
   - 全文抓取进行中按钮禁用
   - 全文失败/超时按钮可点并生成摘要

---

## 执行交接

计划已完成并保存到 `docs/plans/2026-02-28-ai-summary-implementation-plan.md`。两种执行方式：

1) **Sequential（本 session）**：我按 Task 逐个实现，每个 Task 完成后做一次小结与校验再继续
2) **Sequential（单独 session）**：开新 session，用 `workflow-executing-plans` 按计划分批执行并设 checkpoint

你选哪一种？


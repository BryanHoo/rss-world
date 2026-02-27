# RSS 全文抓取开关改为按订阅源（feed）配置 Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 将“打开文章时抓取全文”从全局设置移除，改为每个订阅源（`feeds` 表）独立开关（默认关闭），并让前后端全文入队 gating 以该 feed 开关为准。

**Architecture:** 在 `feeds` 表新增 `full_text_on_open_enabled` 字段（默认 `false`），通过 `POST/PATCH /api/feeds` 写入、通过 `GET /api/reader/snapshot` 下发到前端；当用户打开文章时，`POST /api/articles/:id/fulltext` 根据文章所属 `feed` 的开关决定是否 enqueue `article.fetch_fulltext`，前端 `ArticleView` 也基于该 feed 开关决定是否触发入队与轮询刷新。旧全局字段 `persistedSettings.rss.fullTextOnOpenEnabled` 被移除并忽略。

**Tech Stack:** TypeScript, Next.js App Router Route Handlers, Postgres (`pg`), Zustand, shadcn/ui (Radix Select/Dialog), `pg-boss`, Vitest, pnpm.

---

## 我在用的 skill

我在用 `workflow-writing-plans` 来创建实现计划（Implementation Plan）。

## Inputs（先读这些再动手）

- 设计文档：`docs/plans/2026-02-27-rss-fulltext-per-feed-design.md`
- 相关 prior art（复用结构/测试习惯）：
  - `docs/plans/2026-02-26-rss-fulltext-implementation-plan.md`（全文抓取链路、入队去重、worker 抽取与清洗）
  - `docs/plans/2026-02-25-feeds-manage-implementation-plan.md`（feed 管理：`AddFeedDialog` / `EditFeedDialog` / `patchFeed` / `deleteFeed`）
- 关键代码入口（调用链）：
  - feeds 表与 repo：`src/server/db/migrations/0001_init.sql`、`src/server/repositories/feedsRepo.ts`
  - feeds API：`src/app/api/feeds/route.ts`、`src/app/api/feeds/[id]/route.ts`
  - Reader snapshot：`src/server/services/readerSnapshotService.ts`、`src/app/api/reader/snapshot/route.ts`
  - Client DTO 与映射：`src/lib/apiClient.ts`（`ReaderSnapshotDto`、`mapFeedDto`、`createFeed`、`patchFeed`）
  - Store：`src/store/appStore.ts`
  - Feed UI：`src/features/feeds/AddFeedDialog.tsx`、`src/features/feeds/EditFeedDialog.tsx`、`src/features/feeds/FeedList.tsx`
  - 全文入队 API：`src/app/api/articles/[id]/fulltext/route.ts`
  - 阅读页触发：`src/features/articles/ArticleView.tsx`
  - 设置（将移除全局开关）：`src/features/settings/settingsSchema.ts`、`src/features/settings/panels/RssSettingsPanel.tsx`
- 验证命令：
  - 单测：`pnpm run test:unit`
  - Lint：`pnpm run lint`
  - 构建：`pnpm run build`

## Key Risks / Pitfalls（实现时别踩）

1) **旧全局开关必须完全失效**：不能只改前端 gating，否则后端仍会 enqueue；必须同时改 `POST /api/articles/:id/fulltext` 的 gating。
2) **类型变更会波及大量 fixture/stub**：`Feed` / `ReaderSnapshotDto.feeds[]` 增加字段后，`appStore.test.ts`、`FeedList.test.tsx`、`AddFeedDialog.test.tsx`、`/api/reader/snapshot/route.test.ts` 等都要补齐字段，避免 TS 编译或运行时断言失败。
3) **DB 列新增与代码读取顺序**：先落 migration（至少文件与测试齐全），再在 repo/query 中读取列；否则后续落地到真实 DB 时会出现缺列错误。
4) **`PATCH /api/feeds/:id` 动态 SQL**：仅当请求 body 含 `fullTextOnOpenEnabled` 时才更新该列；返回 `returning` 也要包含该字段，避免前端差量更新丢字段。
5) **不迁移意味着默认更保守**：实现中不要意外把旧 `persistedSettings.rss.fullTextOnOpenEnabled` 当作默认值写回 feeds。

---

## Phase 0：准备工作（隔离变更 + 建立基线）

### Task 1: 在独立 worktree/分支上执行（推荐）

**Files:** 无

**Step 1: 创建 worktree**

Run:

```bash
git fetch
git worktree add -b codex/rss-fulltext-per-feed ../feedfuse-rss-fulltext-per-feed
```

Expected: 生成目录 `../feedfuse-rss-fulltext-per-feed`，后续步骤在该目录执行。

**Step 2: 基线验证（改动前先全绿）**

Run:

```bash
pnpm run lint
pnpm run test:unit
pnpm run build
```

Expected: 全部 PASS。

---

## Phase 1：数据库 schema（feeds 增加全文开关字段）

### Task 2: 先写 migration 测试（先红）

**Files:**

- Create: `src/server/db/migrations/feedFulltextOnOpenMigration.test.ts`

**Step 1: 写 failing test（迁移文件还不存在）**

```ts
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('db migrations', () => {
  it('adds fulltext-on-open flag to feeds', () => {
    const migrationPath = 'src/server/db/migrations/0005_feed_fulltext_on_open.sql';
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('alter table feeds');
    expect(sql).toContain('full_text_on_open_enabled');
  });
});
```

**Step 2: 运行测试确认失败**

Run:

```bash
pnpm run test:unit -- src/server/db/migrations/feedFulltextOnOpenMigration.test.ts
```

Expected: FAIL（迁移文件不存在）。

### Task 3: 添加 migration SQL（转绿）

**Files:**

- Create: `src/server/db/migrations/0005_feed_fulltext_on_open.sql`
- Test: `src/server/db/migrations/feedFulltextOnOpenMigration.test.ts`

**Step 1: 添加 migration**

```sql
alter table feeds
  add column if not exists full_text_on_open_enabled boolean not null default false;
```

**Step 2: 运行测试确认通过**

Run:

```bash
pnpm run test:unit -- src/server/db/migrations/feedFulltextOnOpenMigration.test.ts
```

Expected: PASS。

**Step 3: Commit**

```bash
git add src/server/db/migrations/0005_feed_fulltext_on_open.sql src/server/db/migrations/feedFulltextOnOpenMigration.test.ts
git commit -m "feat(db): feeds 增加全文开关字段"
```

---

## Phase 2：数据层（feedsRepo / snapshot 下发）

### Task 4: 为 feedsRepo 增加最小单测锁行为（先红）

**Files:**

- Create: `src/server/repositories/feedsRepo.fulltextOnOpen.test.ts`

**Step 1: 写 failing tests（先锁住 SQL 是否包含新列）**

```ts
import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

describe('feedsRepo (fullTextOnOpenEnabled)', () => {
  it('listFeeds selects full_text_on_open_enabled', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./feedsRepo')) as typeof import('./feedsRepo');

    await mod.listFeeds(pool);
    expect(String(query.mock.calls[0]?.[0] ?? '')).toContain('full_text_on_open_enabled');
    expect(String(query.mock.calls[0]?.[0] ?? '')).toContain('fullTextOnOpenEnabled');
  });

  it('createFeed inserts and returns full_text_on_open_enabled', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'f1' }] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./feedsRepo')) as typeof import('./feedsRepo');

    await mod.createFeed(pool, { title: 'A', url: 'https://example.com/rss.xml' });
    expect(String(query.mock.calls[0]?.[0] ?? '')).toContain('full_text_on_open_enabled');
    expect(String(query.mock.calls[0]?.[0] ?? '')).toContain('fullTextOnOpenEnabled');
  });

  it('updateFeed supports fullTextOnOpenEnabled patch and returns it', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'f1' }] });
    const pool = { query } as unknown as Pool;
    const mod = (await import('./feedsRepo')) as typeof import('./feedsRepo');

    await mod.updateFeed(pool, 'f1', { fullTextOnOpenEnabled: true } as any);

    const sql = String(query.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain('full_text_on_open_enabled');
    expect(sql).toContain('fullTextOnOpenEnabled');
  });
});
```

**Step 2: 运行测试确认失败**

Run:

```bash
pnpm run test:unit -- src/server/repositories/feedsRepo.fulltextOnOpen.test.ts
```

Expected: FAIL（repo SQL 尚未包含新列）。

### Task 5: 实现 feedsRepo 新字段（转绿）

**Files:**

- Modify: `src/server/repositories/feedsRepo.ts`
- Test: `src/server/repositories/feedsRepo.fulltextOnOpen.test.ts`
- Modify: `src/server/services/readerSnapshotService.ts`

**Step 1: 扩展 repo 类型**

在 `FeedRow` 增加：

```ts
fullTextOnOpenEnabled: boolean;
```

**Step 2: `listFeeds` select 新列**

在 `listFeeds` 的 SQL `select` 增加：

```sql
full_text_on_open_enabled as "fullTextOnOpenEnabled",
```

**Step 3: `createFeed` insert/return 新列**

- insert columns 增加 `full_text_on_open_enabled`
- values 增加一个参数（默认 `false`）
- returning 增加 alias：

```sql
full_text_on_open_enabled as "fullTextOnOpenEnabled",
```

**Step 4: `updateFeed` 支持 patch 新列**

在动态字段构建中添加：

```ts
if (typeof (input as any).fullTextOnOpenEnabled !== 'undefined') {
  fields.push(`full_text_on_open_enabled = $${paramIndex++}`);
  values.push(Boolean((input as any).fullTextOnOpenEnabled));
}
```

并在 `returning` 中加入：

```sql
full_text_on_open_enabled as "fullTextOnOpenEnabled",
```

**Step 5: reader snapshot 类型透传**

在 `src/server/services/readerSnapshotService.ts`：

- `ReaderSnapshotFeed` 增加 `fullTextOnOpenEnabled: boolean`
- `feedsWithUnread` 的 spread 保持即可（只要 `listFeeds` 返回已包含字段）

**Step 6: 运行 repo 单测确认通过**

Run:

```bash
pnpm run test:unit -- src/server/repositories/feedsRepo.fulltextOnOpen.test.ts
```

Expected: PASS。

**Step 7: Commit**

```bash
git add src/server/repositories/feedsRepo.ts src/server/repositories/feedsRepo.fulltextOnOpen.test.ts src/server/services/readerSnapshotService.ts
git commit -m "feat(feeds): 存储并下发单源全文开关"
```

---

## Phase 3：feeds API（POST/PATCH 支持新字段）

### Task 6: 先改 feeds route tests（先红）

**Files:**

- Modify: `src/app/api/feeds/routes.test.ts`

**Step 1: 更新 POST 测试覆盖 `fullTextOnOpenEnabled`**

- `POST creates a feed` 的 body 增加 `fullTextOnOpenEnabled: true`
- `createFeedMock.mockResolvedValue(...)` 的返回对象增加 `fullTextOnOpenEnabled: true`
- 增加断言：`createFeedMock` 被调用时包含该字段

示例断言：

```ts
expect(createFeedMock).toHaveBeenCalledWith(
  pool,
  expect.objectContaining({ fullTextOnOpenEnabled: true }),
);
```

**Step 2: 更新 PATCH 测试覆盖 `fullTextOnOpenEnabled`**

- patch body 增加 `fullTextOnOpenEnabled: true`
- `updateFeedMock` 返回对象增加 `fullTextOnOpenEnabled: true`
- 增加断言：`updateFeedMock` 被调用时包含该字段

**Step 3: 运行该测试确认失败**

Run:

```bash
pnpm run test:unit -- src/app/api/feeds/routes.test.ts
```

Expected: FAIL（route schema 尚未接受/透传该字段）。

### Task 7: 修改 feeds routes 支持新字段（转绿）

**Files:**

- Modify: `src/app/api/feeds/route.ts`
- Modify: `src/app/api/feeds/[id]/route.ts`
- Test: `src/app/api/feeds/routes.test.ts`

**Step 1: `POST /api/feeds` body schema 增加字段**

在 `createFeedBodySchema` 增加：

```ts
fullTextOnOpenEnabled: z.boolean().optional(),
```

并在调用 `createFeed` 时透传：

```ts
fullTextOnOpenEnabled: parsed.data.fullTextOnOpenEnabled ?? false,
```

**Step 2: `PATCH /api/feeds/:id` body schema 增加字段**

在 `patchBodySchema` 增加：

```ts
fullTextOnOpenEnabled: z.boolean().optional(),
```

并确保 `updateFeed(pool, id, bodyParsed.data)` 能接收该字段（feedsRepo 已在 Phase 2 支持）。

**Step 3: 运行测试确认通过**

Run:

```bash
pnpm run test:unit -- src/app/api/feeds/routes.test.ts
```

Expected: PASS。

**Step 4: Commit**

```bash
git add src/app/api/feeds/route.ts src/app/api/feeds/[id]/route.ts src/app/api/feeds/routes.test.ts
git commit -m "feat(api): feeds 支持单源全文开关字段"
```

---

## Phase 4：客户端类型与 Store（Feed 字段贯通）

### Task 8: 更新 DTO/类型，并修复相关测试 fixture

**Files:**

- Modify: `src/lib/apiClient.ts`
- Modify: `src/types/index.ts`
- Modify: `src/store/appStore.ts`
- Test: `src/store/appStore.test.ts`
- Test: `src/app/api/reader/snapshot/route.test.ts`

**Step 1: 扩展 client DTO**

在 `src/lib/apiClient.ts`：

- `ReaderSnapshotDto.feeds[]` 增加：

```ts
fullTextOnOpenEnabled: boolean;
```

- `FeedRowDto` 增加：

```ts
fullTextOnOpenEnabled: boolean;
```

- `createFeed(...)` input 增加可选字段：

```ts
fullTextOnOpenEnabled?: boolean;
```

- `patchFeed(...)` input 增加可选字段：

```ts
fullTextOnOpenEnabled?: boolean;
```

**Step 2: 扩展 `Feed` 类型并映射**

在 `src/types/index.ts` 的 `Feed` 增加：

```ts
fullTextOnOpenEnabled: boolean;
```

在 `mapFeedDto(...)` 返回对象中注入：

```ts
fullTextOnOpenEnabled: dto.fullTextOnOpenEnabled,
```

**Step 3: store 接口透传**

在 `src/store/appStore.ts`：

- `addFeed` payload 增加 `fullTextOnOpenEnabled?: boolean`
- `updateFeed` patch 增加 `fullTextOnOpenEnabled?: boolean`
- `updateFeed` 成功写回时同步更新该字段（从 `patchFeed` 返回取）

**Step 4: 修复测试 stub**

- `src/store/appStore.test.ts`：`/api/reader/snapshot` stub 的 feed 增加 `fullTextOnOpenEnabled: false`
- `src/app/api/reader/snapshot/route.test.ts`：mock snapshot 的 feed 增加 `fullTextOnOpenEnabled: false`

**Step 5: 运行相关单测**

Run:

```bash
pnpm run test:unit -- src/store/appStore.test.ts
pnpm run test:unit -- src/app/api/reader/snapshot/route.test.ts
```

Expected: PASS。

**Step 6: Commit**

```bash
git add src/lib/apiClient.ts src/types/index.ts src/store/appStore.ts src/store/appStore.test.ts src/app/api/reader/snapshot/route.test.ts
git commit -m "refactor(types): Feed 增加全文开关字段"
```

---

## Phase 5：Feed 配置入口（Add/Edit dialog）

### Task 9: `AddFeedDialog` 支持设置全文开关 + 单测

**Files:**

- Modify: `src/features/feeds/AddFeedDialog.tsx`
- Modify: `src/features/feeds/FeedList.tsx`
- Test: `src/features/feeds/AddFeedDialog.test.tsx`

**Step 1: UI 增加开关字段（Select）**

在 `AddFeedDialog` 表单中新增一段（建议放在“分类”下面）：

- 标题：`打开文章时抓取全文`
- 说明：`开启后会访问原文链接并尝试抽取正文`
- Select 值：`enabled/disabled`（默认 `disabled`）

提交时将其加入 `onSubmit(...)` payload：

```ts
fullTextOnOpenEnabled: fullTextOnOpenEnabledValue === 'enabled',
```

**Step 2: FeedList 透传 payload**

在 `FeedList.tsx` 中 `AddFeedDialog` 的 `onSubmit` 透传到 `addFeed(...)`：

```ts
addFeed({ title, url, categoryId, fullTextOnOpenEnabled });
```

**Step 3: 更新单测 stub 返回 + 断言请求 body**

在 `AddFeedDialog.test.tsx` 的 `POST /api/feeds` stub：

- 响应 data 增加 `fullTextOnOpenEnabled: Boolean(body.fullTextOnOpenEnabled ?? false)`
- 增加断言（新增 test 或在已有 test 中断言）：
  - 默认提交时请求 body 带 `fullTextOnOpenEnabled: false`
  - 切换为“开启”后请求 body 带 `fullTextOnOpenEnabled: true`

**Step 4: 运行单测**

Run:

```bash
pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx
```

Expected: PASS。

**Step 5: Commit**

```bash
git add src/features/feeds/AddFeedDialog.tsx src/features/feeds/FeedList.tsx src/features/feeds/AddFeedDialog.test.tsx
git commit -m "feat(feeds): 添加订阅源支持全文开关"
```

### Task 10: `EditFeedDialog` 支持编辑全文开关 + 修复 FeedList 单测

**Files:**

- Modify: `src/features/feeds/EditFeedDialog.tsx`
- Test: `src/features/feeds/FeedList.test.tsx`

**Step 1: UI 增加字段并在提交透传**

在 `EditFeedDialog` 的表单里新增 Select（与 Add 保持一致）：

- 初始值：`feed.fullTextOnOpenEnabled ? 'enabled' : 'disabled'`
- submit payload 增加：`fullTextOnOpenEnabled`

**Step 2: 修复 FeedList 单测 fixture/stub**

在 `FeedList.test.tsx`：

- `useAppStore.setState({ feeds: [...] })` 的 feed 增加 `fullTextOnOpenEnabled: false`
- `PATCH /api/feeds/feed-1` stub 返回增加 `fullTextOnOpenEnabled`（可取 body 值回显）

（可选增强）增加一个断言：在编辑弹窗将“全文抓取”切到开启并保存后，store 内对应 feed 字段为 `true`。

**Step 3: 运行单测**

Run:

```bash
pnpm run test:unit -- src/features/feeds/FeedList.test.tsx
```

Expected: PASS。

**Step 4: Commit**

```bash
git add src/features/feeds/EditFeedDialog.tsx src/features/feeds/FeedList.test.tsx
git commit -m "feat(feeds): 编辑订阅源支持全文开关"
```

---

## Phase 6：全文入队 gating（后端 + 前端）

### Task 11: 为 feedsRepo 增加查询开关的轻量函数

**Files:**

- Modify: `src/server/repositories/feedsRepo.ts`

**Step 1: 新增函数（供全文入队路由使用）**

```ts
export async function getFeedFullTextOnOpenEnabled(
  pool: Pool,
  id: string,
): Promise<boolean | null> {
  const { rows } = await pool.query<{ fullTextOnOpenEnabled: boolean }>(
    `
      select full_text_on_open_enabled as "fullTextOnOpenEnabled"
      from feeds
      where id = $1
      limit 1
    `,
    [id],
  );
  return typeof rows[0]?.fullTextOnOpenEnabled === 'boolean' ? rows[0].fullTextOnOpenEnabled : null;
}
```

**Step 2: 提交（可与下一 Task 合并提交以减少碎片）**

（建议与 Task 12 一起提交）

### Task 12: 修改 `POST /api/articles/:id/fulltext` 的 gating，并更新单测

**Files:**

- Modify: `src/app/api/articles/[id]/fulltext/route.ts`
- Modify: `src/app/api/articles/routes.test.ts`
- Modify: `src/server/repositories/feedsRepo.ts`

**Step 1: 先改 tests（先红）**

在 `src/app/api/articles/routes.test.ts`：

- 删除对 `settingsRepo.getUiSettings` 的 mock 与 `getUiSettingsMock`
- 增加对 `feedsRepo.getFeedFullTextOnOpenEnabled` 的 mock（新增 `getFeedFullTextOnOpenEnabledMock`）
- 将 “returns enqueued=false when disabled” 改为：
  - `getFeedFullTextOnOpenEnabledMock.mockResolvedValue(false)`
  - 断言 `{ enqueued: false }` 且 `enqueueMock` 未被调用
- 其他入队测试用例中，将开关置为 `true`：
  - `getFeedFullTextOnOpenEnabledMock.mockResolvedValue(true)`

**Step 2: 运行测试确认失败**

Run:

```bash
pnpm run test:unit -- src/app/api/articles/routes.test.ts
```

Expected: FAIL（route 仍在读全局 UI settings）。

**Step 3: 修改 route（转绿）**

在 `src/app/api/articles/[id]/fulltext/route.ts`：

- 移除 `getUiSettings` / `normalizePersistedSettings` / 全局开关判断
- 在读取文章后，基于 `article.feedId` 调用 `getFeedFullTextOnOpenEnabled(...)`
- 若返回不为 `true`：`return ok({ enqueued: false })`
- 其余逻辑保持现状（link/contentFullHtml/rssContentLooksFull/singleton enqueue）

**Step 4: 运行测试确认通过**

Run:

```bash
pnpm run test:unit -- src/app/api/articles/routes.test.ts
```

Expected: PASS。

**Step 5: Commit**

```bash
git add src/server/repositories/feedsRepo.ts src/app/api/articles/[id]/fulltext/route.ts src/app/api/articles/routes.test.ts
git commit -m "feat(api): 全文入队按订阅源开关控制"
```

### Task 13: 前端 `ArticleView` 改为按 feed 开关触发

**Files:**

- Modify: `src/features/articles/ArticleView.tsx`

**Step 1: 替换旧全局读取**

移除：

```ts
const fullTextOnOpenEnabled = useSettingsStore(
  (state) => state.persistedSettings.rss.fullTextOnOpenEnabled,
);
```

替换为：

```ts
const feedFullTextOnOpenEnabled = feed?.fullTextOnOpenEnabled ?? false;
```

并在 effect gating 中使用 `feedFullTextOnOpenEnabled`，依赖项相应替换。

**Step 2: 运行 lint/单测（快速回归）**

Run:

```bash
pnpm run lint
pnpm run test:unit
```

Expected: PASS。

**Step 3: Commit**

```bash
git add src/features/articles/ArticleView.tsx
git commit -m "refactor(reader): 全文抓取按订阅源开关触发"
```

---

## Phase 7：移除全局开关（settings schema/UI/tests 清理）

### Task 14: 先删/改 settings 相关测试（先红）

**Files:**

- Modify: `src/features/settings/settingsSchema.test.ts`
- Modify: `src/features/settings/SettingsCenterModal.test.tsx`
- Modify: `src/store/settingsStore.test.ts`

**Step 1: 删除 `supports rss.fullTextOnOpenEnabled` 测试用例**

`src/features/settings/settingsSchema.test.ts` 删除该 `it(...)`。

**Step 2: 删除 SettingsCenter 中“切换全文开关”的测试**

`src/features/settings/SettingsCenterModal.test.tsx` 删除 `toggles fulltext on open setting` 这个 `it(...)`（因为 UI 不再提供该全局开关）。

**Step 3: 修复 settingsStore legacy fixture**

`src/store/settingsStore.test.ts` 的 legacy 数据里移除：

```ts
fullTextOnOpenEnabled: false,
```

**Step 4: 运行相关测试确认失败**

Run:

```bash
pnpm run test:unit -- src/features/settings/settingsSchema.test.ts
pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx
pnpm run test:unit -- src/store/settingsStore.test.ts
```

Expected: FAIL（实现尚未移除该字段/UI）。

### Task 15: 移除全局开关字段与 UI（转绿）

**Files:**

- Modify: `src/types/index.ts`
- Modify: `src/features/settings/settingsSchema.ts`
- Modify: `src/features/settings/panels/RssSettingsPanel.tsx`
- Test: `src/features/settings/settingsSchema.test.ts`
- Test: `src/features/settings/SettingsCenterModal.test.tsx`
- Test: `src/store/settingsStore.test.ts`

**Step 1: 类型移除**

在 `src/types/index.ts`：

- `RssSettings` 移除 `fullTextOnOpenEnabled`

**Step 2: settingsSchema 移除字段**

在 `src/features/settings/settingsSchema.ts`：

- `defaultRssSettings` 移除 `fullTextOnOpenEnabled`
- `normalizeRssSettings(...)` 移除对该字段的 `readBoolean` 读取与返回

**Step 3: RSS 面板移除全局开关 UI**

在 `src/features/settings/panels/RssSettingsPanel.tsx`：

- 删除“打开文章时抓取全文”这一整块 row（只保留抓取间隔）
- （可选）替换为一行说明文案：全文抓取在订阅源编辑中逐个设置

**Step 4: 运行测试确认通过**

Run:

```bash
pnpm run test:unit -- src/features/settings/settingsSchema.test.ts
pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx
pnpm run test:unit -- src/store/settingsStore.test.ts
```

Expected: PASS。

**Step 5: Commit**

```bash
git add src/types/index.ts src/features/settings/settingsSchema.ts src/features/settings/panels/RssSettingsPanel.tsx src/features/settings/settingsSchema.test.ts src/features/settings/SettingsCenterModal.test.tsx src/store/settingsStore.test.ts
git commit -m "refactor(settings): 移除全文抓取全局开关"
```

---

## Phase 8：最终验证

### Task 16: 全量回归（lint + unit + build）

**Files:** 无

Run:

```bash
pnpm run lint
pnpm run test:unit
pnpm run build
```

Expected: 全部 PASS。

### Task 17: 手动冒烟（可选）

1) 添加一个 feed：默认全文开关关闭 → 打开文章不触发全文抓取（Network 中 `POST /api/articles/:id/fulltext` 不应返回 `enqueued: true`）。
2) 编辑该 feed：将全文开关打开 → 打开同一 feed 的文章应触发入队并出现全文抓取 loading，随后自动切换为全文内容。
3) 在 Settings Center 的 RSS 面板确认不再出现“打开文章时抓取全文”的全局开关。

---

## 执行交接（必选其一）

实现计划已完成后有两个执行选项：

1) **Sequential（本 session 执行）**：我留在当前会话，按 Task 逐个执行并在关键点停下来让你确认。
2) **Sequential（单独 session 执行）**：你在 worktree 新开会话，然后用 `workflow-executing-plans` 按 Task 逐个执行。

你选哪一种？


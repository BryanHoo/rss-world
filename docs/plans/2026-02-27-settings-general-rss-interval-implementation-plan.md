# 设置中心 `general` 迁移 + RSS 全局抓取间隔 + 通用行为设置 Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 将设置中心 `appearance` 全量迁移为 `general`（含前后端兼容迁移），新增 `rss` 分组与“全局抓取间隔（固定档位，写回所有 feeds）”，并补齐 3 个通用行为设置（自动标记已读、all 默认仅未读、侧边栏折叠记忆）。

**Architecture:** 前端设置中心继续走 `useSettingsStore` 草稿 + 自动保存，设置通过 `PUT /api/settings` 写入 `app_settings.ui_settings`；当 `rss.fetchIntervalMinutes` 变化时后端在事务内同时批量更新 `feeds.fetch_interval_minutes`。worker 将 `JOB_REFRESH_ALL` 改为每分钟触发，并在 refresh_all 与 feed.fetch 两处做“到期判定”，手动刷新通过 `force: true` 跳过到期拦截。

**Tech Stack:** TypeScript, Next.js App Router Route Handlers, Zustand, shadcn/ui (Radix), Postgres (`pg`), `pg-boss`, Vitest, pnpm.

---

## 我在用的 skill

我在用 `workflow-writing-plans` 来创建实现计划（Implementation Plan）。

## Inputs（先读这些再动手）

- 设计文档：`docs/plans/2026-02-27-settings-general-rss-interval-design.md`
- 相关 prior art（可直接复用测试/结构习惯）：
  - `docs/plans/2026-02-26-rss-fulltext-implementation-plan.md`（`/api/settings` + settings normalize 的既有模式）
  - `docs/plans/2026-02-24-feedfuse-backend-design.md`（`fetch_interval_minutes` 与 worker “到期判定”）
- 关键代码入口（调用链）：
  - 设置 normalize：`src/features/settings/settingsSchema.ts`
  - 设置存储：`src/store/settingsStore.ts`
  - 设置中心 UI：`src/features/settings/SettingsCenterDrawer.tsx`
  - 通用面板（现 `AppearanceSettingsPanel`）：`src/features/settings/panels/AppearanceSettingsPanel.tsx`
  - RSS 校验：`src/app/api/rss/validate/route.ts`
  - 设置 API：`src/app/api/settings/route.ts`
  - feeds repo：`src/server/repositories/feedsRepo.ts`
  - worker：`src/worker/index.ts`
  - 手动刷新：`src/app/api/feeds/[id]/refresh/route.ts`
  - 阅读/文章列表：`src/features/articles/ArticleView.tsx`、`src/features/articles/ArticleList.tsx`
  - 主题 hook：`src/hooks/useTheme.ts`
  - Reader 入口：`src/app/(reader)/ReaderApp.tsx`、`src/features/reader/ReaderLayout.tsx`
- 验证命令：
  - 单测：`pnpm run test:unit`
  - Lint：`pnpm run lint`
  - 构建：`pnpm run build`

## Key Risks / Pitfalls（实现时别踩）

1) **前后端双存量迁移**：后端 `app_settings.ui_settings` + 前端 `localStorage(feedfuse-settings)` 都可能有旧 `appearance` 结构；必须做到“读旧写新”，否则会丢用户偏好。
2) **`PUT /api/settings` 自动保存频繁触发**：必须只在 `rss.fetchIntervalMinutes` 发生变化时才批量更新 feeds，避免每次调整主题/字号都全表更新。
3) **事务正确性**：批量更新 feeds 必须和更新 `ui_settings` 在同一事务里，避免半成功状态。
4) **worker 调度误差**：`*/5` cron 会导致 `5min` 档位在非对齐时接近 `10min`；需要 `* * * * *` + 到期判定。
5) **到期判定的“跳过”不能写 `last_fetched_at`**：跳过意味着不抓取，不应更新抓取时间，否则会导致永远不抓。

---

## Phase 0：准备工作（隔离变更 + 建立基线）

### Task 1: 在独立 worktree/分支上执行（推荐）

**Files:** 无

**Step 1: 创建 worktree**

Run:

```bash
git fetch
git worktree add -b codex/settings-general-rss-interval ../feedfuse-settings-general-rss-interval
```

Expected: 生成目录 `../feedfuse-settings-general-rss-interval`，后续步骤在该目录执行。

**Step 2: 基线验证（改动前先全绿）**

Run:

```bash
pnpm run lint
pnpm run test:unit
pnpm run build
```

Expected: 全部 PASS。

---

## Phase 1：设置模型迁移（`appearance` → `general`）+ normalize（读旧写新）

### Task 2: 先把 normalize 测试改成新结构（先红）

**Files:**

- Modify: `src/features/settings/settingsSchema.test.ts`

**Step 1: 更新断言为 `general`**

把所有 `normalized.appearance.*` 替换为 `normalized.general.*`，并新增一个用旧 `appearance` 输入也能迁移到 `general` 的断言：

```ts
const normalized = normalizePersistedSettings({ appearance: { theme: 'dark' } });
expect(normalized.general.theme).toBe('dark');
```

并为新字段 `rss.fetchIntervalMinutes` 增加一条回退测试（非法值回退默认 `30`）：

```ts
const normalized = normalizePersistedSettings({ rss: { fetchIntervalMinutes: 999 } });
expect(normalized.rss.fetchIntervalMinutes).toBe(30);
```

**Step 2: 运行该测试确认失败**

Run:

```bash
pnpm run test:unit -- src/features/settings/settingsSchema.test.ts
```

Expected: FAIL（因为还没实现 `general`/`rss.fetchIntervalMinutes`）。

**Step 3: Commit**

先不提交，等实现转绿后一起提交（避免中间主线红）。

---

### Task 3: 实现 `general` / `rss.fetchIntervalMinutes` 的 schema（转绿）

**Files:**

- Modify: `src/types/index.ts`
- Modify: `src/features/settings/settingsSchema.ts`
- Test: `src/features/settings/settingsSchema.test.ts`

**Step 1: 更新类型（`PersistedSettings.general`）**

在 `src/types/index.ts`：

- 新增 `GeneralSettings`（包含原主题/字号/字体/行高 + 新增 1/2/5 三个配置）：

```ts
export interface GeneralSettings {
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: 'sans' | 'serif';
  lineHeight: 'compact' | 'normal' | 'relaxed';
  autoMarkReadEnabled: boolean;
  autoMarkReadDelayMs: 0 | 2000 | 5000;
  defaultUnreadOnlyInAll: boolean;
  sidebarCollapsed: boolean;
}
```

- 更新 `RssSettings` 增加 `fetchIntervalMinutes`：

```ts
fetchIntervalMinutes: 5 | 15 | 30 | 60 | 120;
```

- 更新 `PersistedSettings`：把 `appearance` 改成 `general`。

**Step 2: 更新默认值与 normalize（读旧写新）**

在 `src/features/settings/settingsSchema.ts`：

- `defaultAppearanceSettings` 改为 `defaultGeneralSettings`
- `normalizeAppearanceSettings` 改为 `normalizeGeneralSettings`
- 兼容读取来源（优先级）：
  1) `input.general`
  2) `input.appearance`（旧）
  3) legacy flat（`theme/fontSize/fontFamily/lineHeight` 在顶层）
- `normalizeRssSettings` 增加 `fetchIntervalMinutes`：
  - 允许档位：`[5, 15, 30, 60, 120]`
  - 非法值回退 `30`

**Step 3: 运行测试确认通过**

Run:

```bash
pnpm run test:unit -- src/features/settings/settingsSchema.test.ts
```

Expected: PASS。

**Step 4: Commit**

```bash
git add src/types/index.ts src/features/settings/settingsSchema.ts src/features/settings/settingsSchema.test.ts
git commit -m "refactor(settings): 迁移appearance到general"
```

---

## Phase 2：前端读写 `general` + 新增 `rss` Tab + 通用行为设置（1/2/5）

### Task 4: 更新主题 hook 与阅读页排版来源（先红）

**Files:**

- Modify: `src/hooks/useTheme.test.tsx`
- Modify: `src/hooks/useTheme.ts`
- Modify: `src/features/articles/ArticleView.tsx`

**Step 1: 先改测试（如果有）指向 `persistedSettings.general.theme`**

将测试/代码中对 `persistedSettings.appearance.theme` 的引用迁移为 `persistedSettings.general.theme`。

**Step 2: 运行相关测试确认失败**

Run:

```bash
pnpm run test:unit -- src/hooks/useTheme.test.tsx
```

Expected: FAIL（代码未更新时）。

**Step 3: 实现迁移并跑过测试**

- `useTheme.ts`：改为读取 `state.persistedSettings.general.theme`
- `ArticleView.tsx`：排版读取 `state.persistedSettings.general`（字号/行高/字体）

Run:

```bash
pnpm run test:unit -- src/hooks/useTheme.test.tsx
```

Expected: PASS。

**Step 4: Commit**

```bash
git add src/hooks/useTheme.ts src/hooks/useTheme.test.tsx src/features/articles/ArticleView.tsx
git commit -m "refactor(reader): 使用general读取主题与排版"
```

---

### Task 5: 新增通用行为设置（1/2/5）并接入阅读/列表/侧边栏（先红 → 转绿）

**Files:**

- Modify: `src/features/articles/ArticleView.tsx`
- Modify: `src/features/articles/ArticleList.tsx`
- Modify: `src/app/(reader)/ReaderApp.tsx`
- Modify: `src/store/appStore.ts`

**Step 1: 自动标记已读（1）**

在 `ArticleView.tsx`：

- 读取：

```ts
const autoMarkReadEnabled = useSettingsStore((s) => s.persistedSettings.general.autoMarkReadEnabled);
const autoMarkReadDelayMs = useSettingsStore((s) => s.persistedSettings.general.autoMarkReadDelayMs);
```

- 将原先固定 `2000ms` 的 effect 改为：
  - 关闭：不触发
  - 开启：`setTimeout(..., autoMarkReadDelayMs)`；`0` 表示立即标记

**Step 2: all 默认仅未读（2）**

在 `ArticleList.tsx`：

- 读取：

```ts
const defaultUnreadOnlyInAll = useSettingsStore((s) => s.persistedSettings.general.defaultUnreadOnlyInAll);
```

- 规则：当 `selectedView === 'all'` 时，把 `showUnreadOnly` 的初始/重置值设为该设置；切换到其它 view 时默认设为 `false`。
  - 建议通过 `useEffect` 监听 `selectedView/defaultUnreadOnlyInAll` 来重置：

```ts
useEffect(() => {
  if (selectedView === 'all') setShowUnreadOnly(defaultUnreadOnlyInAll);
  else setShowUnreadOnly(false);
}, [selectedView, defaultUnreadOnlyInAll]);
```

**Step 3: 侧边栏折叠记忆（5）**

新增 `general.sidebarCollapsed` 后，需要在 app 初始化/设置变更时让 `useAppStore.sidebarCollapsed` 跟随设置：

在 `ReaderApp.tsx` 里新增：

```ts
const sidebarCollapsed = useSettingsStore((s) => s.persistedSettings.general.sidebarCollapsed);
useEffect(() => {
  useAppStore.setState({ sidebarCollapsed });
}, [sidebarCollapsed]);
```

> 说明：当前代码没有 UI 触发 `toggleSidebar()`；此处以“用户在设置里配置默认折叠”为主，未来若新增 UI toggle，再补齐双向同步。

**Step 4: 运行单测（最小回归）**

Run:

```bash
pnpm run test:unit
```

Expected: PASS（若有相关测试失败，按失败点补齐断言/更新 fixture）。

**Step 5: Commit**

```bash
git add src/features/articles/ArticleView.tsx src/features/articles/ArticleList.tsx src/app/(reader)/ReaderApp.tsx src/store/appStore.ts
git commit -m "feat(reader): 增加通用阅读行为设置"
```

---

### Task 6: 重构设置中心 Tabs（新增 `rss`）并改名“通用”（先红 → 转绿）

**Files:**

- Modify: `src/features/settings/SettingsCenterDrawer.tsx`
- Modify: `src/features/settings/SettingsCenterModal.test.tsx`

**Step 1: 更新 tab key**

- `SettingsSectionKey`：从 `'appearance' | 'ai' | 'categories'` 改为 `'general' | 'rss' | 'ai' | 'categories'`
- `sectionItems` 文案：`外观` → `通用`，新增 `RSS`
- `activeSection` 默认值：`'general'`

**Step 2: 更新测试断言**

`SettingsCenterModal.test.tsx` 如有依赖旧 tab key，需要同步为新 key，并确保 `data-testid`/`aria-label` 不变。

**Step 3: 运行设置中心相关测试**

Run:

```bash
pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx
```

Expected: PASS。

**Step 4: Commit**

```bash
git add src/features/settings/SettingsCenterDrawer.tsx src/features/settings/SettingsCenterModal.test.tsx
git commit -m "refactor(settings): 设置中心新增rss分组"
```

---

### Task 7: 将 `AppearanceSettingsPanel` 改为 `GeneralSettingsPanel` 并补齐 1/2/5 的 UI 配置项

**Files:**

- Move: `src/features/settings/panels/AppearanceSettingsPanel.tsx` → `src/features/settings/panels/GeneralSettingsPanel.tsx`
- Modify: `src/features/settings/SettingsCenterDrawer.tsx`

**Step 1: 面板读写改为 `draft.persisted.general`**

把 `draft.persisted.appearance.*` 改为 `draft.persisted.general.*`。

**Step 2: 新增 3 个设置项 UI（固定档位/开关）**

建议以 card 分隔的形式新增三个区块：

- 自动标记已读：开关 + 延迟档位（0/2s/5s）
- all 默认仅未读：开关
- 侧边栏默认折叠：开关

控件建议：
- 开关：沿用现有 `Button` 两态（`开启/关闭`）
- 延迟：使用 `Select`（固定档位）

**Step 3: 运行设置中心测试**

Run:

```bash
pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx
```

Expected: PASS。

**Step 4: Commit**

```bash
git add src/features/settings/panels/GeneralSettingsPanel.tsx src/features/settings/SettingsCenterDrawer.tsx
git commit -m "feat(settings): 通用面板增加阅读行为设置"
```

---

### Task 8: 新增 `RssSettingsPanel`，并把全文开关挪入 RSS 面板

**Files:**

- Create: `src/features/settings/panels/RssSettingsPanel.tsx`
- Modify: `src/features/settings/SettingsCenterDrawer.tsx`
- Modify: `src/features/settings/panels/GeneralSettingsPanel.tsx`

**Step 1: RSS 抓取间隔 Select**

在 `RssSettingsPanel.tsx`：
- 读取 `draft.persisted.rss.fetchIntervalMinutes`
- 档位：`5/15/30/60/120`
- 文案：`每 5 分钟` 等

**Step 2: 全文开关迁移**

将原先在通用面板里的 `rss.fullTextOnOpenEnabled` UI 删除，并在 RSS 面板内实现同样的开关。

**Step 3: 运行设置中心测试**

Run:

```bash
pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx
```

Expected: PASS。

**Step 4: Commit**

```bash
git add src/features/settings/panels/RssSettingsPanel.tsx src/features/settings/panels/GeneralSettingsPanel.tsx src/features/settings/SettingsCenterDrawer.tsx
git commit -m "feat(settings): 增加rss抓取间隔配置"
```

---

### Task 9: settingsStore 持久化迁移（localStorage version bump）

**Files:**

- Modify: `src/store/settingsStore.ts`
- Modify: `src/store/settingsStore.test.ts`

**Step 1: bump `version` 并迁移旧 key**

在 persist config：
- `version: 2` → `version: 3`
- `migrate/merge` 中确保旧结构可被 `normalizePersistedSettings(extractNormalizeInput(...))` 转成新结构（重点：`appearance` → `general`）。

**Step 2: 修复/更新单测**

`settingsStore.test.ts` 里目前在 beforeEach 写死 `defaultPersistedSettings.appearance`，需要改为 `defaultPersistedSettings.general`，并补一条 migration smoke：
- localStorage 写入旧结构（含 `appearance`） → store merge 后变成 `general`

**Step 3: 运行单测确认通过**

Run:

```bash
pnpm run test:unit -- src/store/settingsStore.test.ts
```

Expected: PASS。

**Step 4: Commit**

```bash
git add src/store/settingsStore.ts src/store/settingsStore.test.ts
git commit -m "refactor(settings): 持久化迁移到general"
```

---

## Phase 3：后端设置保存（事务内批量更新所有 feeds 的抓取间隔）

### Task 10: 为 `PUT /api/settings` 增加“间隔变化才批量更新”的 route 测试（先红）

**Files:**

- Modify: `src/app/api/settings/routes.test.ts`

**Step 1: mock Pool.connect + client.query**

因为实现会使用事务，需要把 `pool` mock 改成：
- `connect(): Promise<{ query: fn; release: fn }>`
- client.query 需要能识别 `BEGIN/COMMIT/ROLLBACK`（可直接 resolve）

**Step 2: mock 新增的 feedsRepo 批量更新函数**

在 test 里 mock `updateAllFeedsFetchIntervalMinutes`（名称以实现为准），并断言：
- 当 `fetchIntervalMinutes` 变化时：被调用一次
- 当仅修改 `general.theme` 时：不调用

**Step 3: 运行该测试确认失败**

Run:

```bash
pnpm run test:unit -- src/app/api/settings/routes.test.ts
```

Expected: FAIL（实现未完成）。

---

### Task 11: 实现 `PUT /api/settings` 事务 + 批量更新 repo（转绿）

**Files:**

- Modify: `src/app/api/settings/route.ts`
- Modify: `src/server/repositories/settingsRepo.ts`
- Modify: `src/server/repositories/feedsRepo.ts`
- Test: `src/app/api/settings/routes.test.ts`

**Step 1: repo 支持 `PoolClient`（最小改动）**

将 `getUiSettings/updateUiSettings` 的第一个参数类型放宽为 `Pool | PoolClient`（两者都有 `query`）。

同理，feedsRepo 新增：

```ts
export async function updateAllFeedsFetchIntervalMinutes(
  pool: Pool | PoolClient,
  minutes: number,
): Promise<{ updatedCount: number }>
```

**Step 2: route.ts 中实现事务**

伪代码结构：

```ts
const pool = getPool();
const prevRaw = await getUiSettings(pool);
const prev = normalizePersistedSettings(prevRaw);
const next = normalizePersistedSettings(json);

const client = await pool.connect();
try {
  await client.query('begin');
  const saved = await updateUiSettings(client, next);
  if (prev.rss.fetchIntervalMinutes !== next.rss.fetchIntervalMinutes) {
    await updateAllFeedsFetchIntervalMinutes(client, next.rss.fetchIntervalMinutes);
  }
  await client.query('commit');
  return ok(normalizePersistedSettings(saved));
} catch (err) {
  await client.query('rollback');
  throw err;
} finally {
  client.release();
}
```

**Step 3: 运行测试确认通过**

Run:

```bash
pnpm run test:unit -- src/app/api/settings/routes.test.ts
```

Expected: PASS。

**Step 4: Commit**

```bash
git add src/app/api/settings/route.ts src/server/repositories/settingsRepo.ts src/server/repositories/feedsRepo.ts src/app/api/settings/routes.test.ts
git commit -m "feat(api): 设置保存时写回抓取间隔"
```

---

## Phase 4：worker 按 interval 抓取（refresh_all 每分钟 + 到期判定 + force）

### Task 12: 更新 `/api/feeds/:id/refresh` 测试，要求 payload 带 `force: true`（先红）

**Files:**

- Modify: `src/app/api/feeds/routes.test.ts`

**Step 1: 更新断言**

在 `POST /refresh enqueues feed.fetch` 测试里，增加：

```ts
expect(enqueueMock.mock.calls[0][1]).toEqual({ feedId, force: true });
```

**Step 2: 运行该测试确认失败**

Run:

```bash
pnpm run test:unit -- src/app/api/feeds/routes.test.ts
```

Expected: FAIL（实现未改）。

---

### Task 13: 实现 refresh route / worker 到期判定（转绿）

**Files:**

- Modify: `src/app/api/feeds/[id]/refresh/route.ts`
- Modify: `src/server/repositories/feedsRepo.ts`
- Modify: `src/worker/index.ts`
- Test: `src/app/api/feeds/routes.test.ts`

**Step 1: refresh route 带上 `force: true`**

将 enqueue 的 data 改为：

```ts
enqueue('feed.fetch', { feedId: paramsParsed.data.id, force: true })
```

**Step 2: feedsRepo 为到期判定补齐字段**

扩展 `FeedFetchRow`/查询列：
- `fetch_interval_minutes as "fetchIntervalMinutes"`
- `last_fetched_at as "lastFetchedAt"`

同样扩展 `getFeedForFetch` 返回这些字段（供 `feed.fetch` 兜底判定使用）。

**Step 3: worker 修改**

- `JOB_REFRESH_ALL` 的 schedule：`'*/5 * * * *'` → `'* * * * *'`
- `enqueueRefreshAll`：
  - 读取 enabled feeds（含 interval + lastFetchedAt）
  - 仅对“到期”的 feed `boss.send(JOB_FEED_FETCH, { feedId })`
- `JOB_FEED_FETCH` worker：
  - 解析 `force?: boolean`
  - 在 `fetchAndIngestFeed(feedId, { force })` 的开头做兜底到期判断（`force` 为 true 则跳过）

**Step 4: 运行 `/api/feeds` 测试确认通过**

Run:

```bash
pnpm run test:unit -- src/app/api/feeds/routes.test.ts
```

Expected: PASS。

**Step 5: Commit**

```bash
git add src/app/api/feeds/[id]/refresh/route.ts src/server/repositories/feedsRepo.ts src/worker/index.ts src/app/api/feeds/routes.test.ts
git commit -m "feat(worker): 按抓取间隔调度feed抓取"
```

---

## Phase 5：整体回归与交付

### Task 14: 全量回归（lint + unit + build）

**Files:** 无

Run:

```bash
pnpm run lint
pnpm run test:unit
pnpm run build
```

Expected: 全部 PASS。

### Task 15: 最终 commit 整理（如有零散修复）

如果有漏网的测试更新/类型修正，合并为 1 个小提交：

```bash
git status --porcelain
git add -A
git commit -m "chore(settings): 完成设置迁移与抓取间隔收尾"
```

---

## 执行交接（选择一种）

计划已完成并保存到 `docs/plans/2026-02-27-settings-general-rss-interval-implementation-plan.md`。两种执行方式：

1) **Sequential（本 session）**：我留在当前 session，用 `workflow-executing-plans` 按 Task 逐个执行并在关键点停下来让你确认
2) **Sequential（新 session）**：你开一个新 session / worktree，我用 `workflow-executing-plans` 严格按文档执行

你选 1 还是 2？


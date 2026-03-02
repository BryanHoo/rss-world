# 中栏顶部刷新订阅源（单源/全局）Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:workflow-executing-plans to implement this plan task-by-task.

**Goal:** 在中栏 `ArticleList` 顶部增加刷新按钮：feed 视图刷新单源；`all/unread/starred` 刷新全部已启用源，并在前端短轮询 snapshot 让列表尽快更新。

**Architecture:** 前端通过 `src/lib/apiClient.ts` 调用 refresh API；后端新增 `POST /api/feeds/refresh` enqueue `feed.refresh_all` 且 `force:true`；worker 扩展 `feed.refresh_all` 支持 `force`，强制刷新时对所有 enabled feeds enqueue `feed.fetch` 并传 `force:true`。

**Tech Stack:** Next.js App Router route handlers、Zustand、Vitest、Testing Library、pg-boss worker。

---

### Task 1: 新增 `POST /api/feeds/refresh`（刷新全部启用源）

**Files:**
- Create: `src/app/api/feeds/refresh/route.ts`
- Modify: `src/app/api/feeds/routes.test.ts`

**Step 1: 写失败用例（routes.test.ts）**

在 `src/app/api/feeds/routes.test.ts` 新增测试：
- import `./refresh/route`
- 调用 `mod.POST(new Request('http://localhost/api/feeds/refresh', { method: 'POST' }))`
- 断言 `enqueueMock` 被调用，且参数为：
  - name: `feed.refresh_all`
  - data: `{ force: true }`

**Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/app/api/feeds/routes.test.ts`  
Expected: FAIL（module not found 或 handler 未实现）

**Step 3: 实现 route handler**

在 `src/app/api/feeds/refresh/route.ts`：
- `export const runtime = 'nodejs'`
- `export const dynamic = 'force-dynamic'`
- `POST()` 中调用 `enqueue(JOB_REFRESH_ALL, { force: true })` 并 `return ok({ enqueued: true, jobId })`

**Step 4: 补齐 test mock 路径并重跑**

在 `routes.test.ts` 增加对 `../../../../server/queue/queue` 的 mock（与新 route 的 import 路径一致）。  
Run: `pnpm vitest run src/app/api/feeds/routes.test.ts`  
Expected: PASS

**Step 5: Commit（可选）**

```bash
git add src/app/api/feeds/refresh/route.ts src/app/api/feeds/routes.test.ts
git commit -m "feat(api): add refresh-all feeds route"
```

---

### Task 2: Worker 支持 `feed.refresh_all` 的 `force:true`

**Files:**
- Modify: `src/worker/index.ts`

**Step 1: 实现最小修改**

- 调整 `enqueueRefreshAll(boss, { force })`：当 `force=true` 时不做 due 判断，直接对所有 enabled feeds enqueue `JOB_FEED_FETCH` 并带 `force:true`
- 在 `boss.work(JOB_REFRESH_ALL, ...)` 中读取 batch jobs 的 `job.data.force`：
  - 若 batch 内任一 job `force=true`，本次按 `force=true` 执行一次即可（避免重复 enqueue）

**Step 2: 运行单测回归**

Run: `pnpm run test:unit`  
Expected: PASS

**Step 3: Commit（可选）**

```bash
git add src/worker/index.ts
git commit -m "feat(worker): support force refresh_all"
```

---

### Task 3: 前端 API client 增加 `refreshAllFeeds`

**Files:**
- Modify: `src/lib/apiClient.ts`

**Step 1: 增加函数**

新增导出：
- `export async function refreshAllFeeds(): Promise<{ enqueued: true; jobId: string }>`
- `POST /api/feeds/refresh`

**Step 2: 运行单测回归**

Run: `pnpm run test:unit`  
Expected: PASS

**Step 3: Commit（可选）**

```bash
git add src/lib/apiClient.ts
git commit -m "feat(apiClient): add refreshAllFeeds"
```

---

### Task 4: `ArticleList` 顶部增加刷新按钮 + 轮询 snapshot

**Files:**
- Modify: `src/features/articles/ArticleList.tsx`
- Modify: `src/features/articles/ArticleList.test.tsx`

**Step 1: 写失败用例（ArticleList.test.tsx）**

新增测试覆盖：
- 在 `selectedView='all'` 时渲染刷新按钮；点击后会调用 `/api/feeds/refresh`，并调用 `loadSnapshot({ view: 'all' })`
- 在 `selectedView='unread'|'starred'` 时同上（仍调用刷新全部）
- 在 `selectedView='feed-1'` 时点击会调用 `/api/feeds/feed-1/refresh`，并调用 `loadSnapshot({ view: 'feed-1' })`
- feed `enabled=false` 时按钮禁用
- 刷新中切换 `selectedView` 会退出 loading（避免一直禁用）

测试实现建议：
- 用 `NotificationProvider` 包裹 `ArticleList`（因为实现会用 `useNotify()`）
- 将 `useAppStore.getState().loadSnapshot` 覆盖为 `vi.fn().mockResolvedValue(undefined)`，避免真实 fetch snapshot
- `fetch` 用 `vi.fn()` 返回 `{ ok: true, data: { enqueued: true, jobId: 'job-1' } }`

**Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/features/articles/ArticleList.test.tsx`  
Expected: FAIL（按钮/逻辑未实现）

**Step 3: 实现 UI 与轮询逻辑（ArticleList.tsx）**

- header actions 增加刷新 `Button`：
  - icon：`RefreshCw`
  - refreshing 时 `className="animate-spin"`
- 点击 handler：
  - 若 `selectedView` 是 feedId：调用 `refreshFeed(selectedView)`
  - 否则：调用 `refreshAllFeeds()`
  - 成功后对当前 view 执行轮询：立即 `await loadSnapshot({ view })`，随后最多 N 次 `await sleep(1000); await loadSnapshot({ view })`
  - 用 `requestIdRef` + `viewAtStart` 防止重复点击与切换视图导致的串台
- 禁用条件：
  - refreshing 中
  - feed view 且 feed `enabled=false`
  - global view 且没有 enabled feeds

**Step 4: 运行测试验证通过**

Run: `pnpm vitest run src/features/articles/ArticleList.test.tsx`  
Expected: PASS

**Step 5: 运行全量单测回归**

Run: `pnpm run test:unit`  
Expected: PASS

**Step 6: Commit（可选）**

```bash
git add src/features/articles/ArticleList.tsx src/features/articles/ArticleList.test.tsx
git commit -m "feat(reader): add refresh button to article list header"
```


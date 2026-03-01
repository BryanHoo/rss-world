# RSS URL 可编辑 + 地址变更强制重取名称 + 原站 Icon 实现计划

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 让新增与编辑 RSS 源都支持修改 URL，且 URL 每次变更后必须重新校验并刷新名称，同时左侧订阅源 icon 基于 RSS channel 原站链接而非中转 RSS 地址。

**Architecture:** 以“校验接口返回元数据（title + siteUrl）”为单一真相源，前端在新增/编辑表单复用统一验证门禁并在校验成功后覆盖名称。保存时由 API 层统一推导并持久化 `icon_url`，前端列表只消费持久化 icon 字段，避免 UI 临时推导与后端数据漂移。所有改动按 TDD 分批推进并频繁提交。

**Tech Stack:** Next.js App Router, TypeScript, React 19, Zustand, Zod, Vitest, Testing Library, Postgres (`pg`)。

---

## 输入收集记录（按 workflow-writing-plans 顺序）

### Step 1: Prior Art Scan

执行命令：

```bash
ls -la docs/solutions
ls -la ~/.agents/docs/solutions
```

结果：项目与全局均无 `docs/solutions` 可复用记录，本计划不复用 solution 文档。

补充参考（设计上下文）：

- `docs/plans/2026-03-01-rss-url-edit-auto-title-site-icon-design.md`
- `docs/plans/2026-02-28-add-feed-url-first-auto-title-design.md`
- `docs/plans/2026-02-25-feeds-manage-design.md`

风险与坑点（纳入实现约束）：

1. 编辑 URL 放开后，若不做“已验证 URL 与当前 URL 一致”门禁，容易提交过期验证结果。
2. `title` 覆盖策略一旦实现不彻底，会出现新增与编辑行为不一致。
3. 若 icon 仍在前端按 `feed.url` 推导，会和后端 `site_url/icon_url` 持久化链路冲突。

### Step 2: Entry Points & Call Chains

关键入口与链路：

1. 新增表单链路：
`src/features/feeds/AddFeedDialog.tsx` → `validateRssUrl` (`src/features/feeds/services/rssValidationService.ts`) → `/api/rss/validate` (`src/app/api/rss/validate/route.ts`)。

2. 编辑保存链路：
`src/features/feeds/EditFeedDialog.tsx` → `useAppStore.updateFeed` (`src/store/appStore.ts`) → `patchFeed` (`src/lib/apiClient.ts`) → `PATCH /api/feeds/:id` (`src/app/api/feeds/[id]/route.ts`) → `updateFeed` (`src/server/repositories/feedsRepo.ts`)。

3. 新增保存链路：
`AddFeedDialog` → `useAppStore.addFeed` → `createFeed` (`src/lib/apiClient.ts`) → `POST /api/feeds` (`src/app/api/feeds/route.ts`) → `createFeed` (`feedsRepo.ts`)。

4. 列表展示链路：
`listFeeds` (`feedsRepo.ts`) → `readerSnapshotService` (`src/server/services/readerSnapshotService.ts`) → `mapFeedDto` (`src/lib/apiClient.ts`) → `FeedList` (`src/features/feeds/FeedList.tsx`)。

风险与坑点（纳入实现约束）：

1. `Feed` 前端类型当前未可靠承接 `iconUrl/siteUrl`，需统一映射策略。
2. `updateFeed` 目前不支持 `url` 字段，API 放开后若 repo 不同步会导致“前端成功、DB不变”。
3. `api/rss/validate` 当前无独立测试，扩展返回字段容易回归。
4. `FeedList` 现有 `google s2` 推导函数与新持久化字段并存时，优先级需明确。

### Step 3: Existing Verify Commands

可用命令：

```bash
pnpm run test:unit -- src/app/api/feeds/routes.test.ts
pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx
pnpm run test:unit -- src/features/feeds/FeedList.test.tsx
pnpm run test:unit -- src/store/appStore.test.ts
pnpm run test:unit -- src/server/repositories/feedsRepo.fulltextOnOpen.test.ts src/server/repositories/feedsRepo.aiSummaryOnOpen.test.ts
pnpm run test:unit
```

风险与坑点（纳入实现约束）：

1. `route` 层测试大量使用 mock，断言应聚焦“调用参数 + envelope”，避免假阳性。
2. `FeedList.test.tsx` 依赖 UI 文案与 aria-label，改动时要保留可访问性标识稳定。
3. 新增 `api/rss/validate` 测试文件需要避免真实网络请求。

---

## Preflight（执行前置）

### Task 0: 建立独立工作树与基线

**Files:**

- Modify: 无（环境准备）

**Step 1: 创建 worktree**

Run:

```bash
git worktree add -b codex/rss-url-edit-site-icon ../feedfuse-rss-url-edit-site-icon
```

Expected: 新目录 `../feedfuse-rss-url-edit-site-icon` 创建成功。

**Step 2: 进入 worktree 并确认依赖**

Run:

```bash
cd ../feedfuse-rss-url-edit-site-icon
pnpm install
```

Expected: 依赖安装完成，无锁文件冲突。

**Step 3: 跑一次基线目标测试**

Run:

```bash
pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx src/features/feeds/FeedList.test.tsx src/app/api/feeds/routes.test.ts
```

Expected: 当前基线通过（用于后续回归对比）。

---

### Task 1: 为 `/api/rss/validate` 增加 `siteUrl` 返回与测试

**Files:**

- Create: `src/app/api/rss/validate/route.test.ts`
- Modify: `src/app/api/rss/validate/route.ts`

**Step 1: 写失败测试（先定义目标行为）**

```ts
it('returns siteUrl from parsed feed.link when validation succeeds', async () => {
  // mock parser.parseString => { title: 'Feed', link: 'https://example.com/' }
  // expect json.data/siteUrl === 'https://example.com/'
});

it('returns success without siteUrl when feed.link missing', async () => {
  // mock parser.parseString => { title: 'Feed' }
  // expect json.siteUrl toBeUndefined()
});
```

**Step 2: 运行测试确认失败**

Run:

```bash
pnpm run test:unit -- src/app/api/rss/validate/route.test.ts
```

Expected: FAIL（`siteUrl` 未返回或断言不匹配）。

**Step 3: 最小实现通过测试**

```ts
const parsedSiteUrl = normalizeHttpUrl(feed.link);
return toJson({ ok: true, kind, title: safeTitle, siteUrl: parsedSiteUrl ?? undefined });
```

**Step 4: 再跑测试确认通过**

Run:

```bash
pnpm run test:unit -- src/app/api/rss/validate/route.test.ts
```

Expected: PASS。

**Step 5: 提交**

```bash
git add src/app/api/rss/validate/route.ts src/app/api/rss/validate/route.test.ts
git commit -m "test(api): cover rss validate siteUrl response"
```

---

### Task 2: 新增 `deriveFeedIconUrl` 工具并覆盖测试

**Files:**

- Create: `src/server/rss/deriveFeedIconUrl.ts`
- Create: `src/server/rss/deriveFeedIconUrl.test.ts`

**Step 1: 写失败测试**

```ts
it('returns google s2 favicon url from site origin', () => {
  expect(deriveFeedIconUrl('https://example.com/blog')).toContain('domain_url=https%3A%2F%2Fexample.com');
});

it('returns null for empty/invalid siteUrl', () => {
  expect(deriveFeedIconUrl(null)).toBeNull();
  expect(deriveFeedIconUrl('')).toBeNull();
  expect(deriveFeedIconUrl('not-a-url')).toBeNull();
});
```

**Step 2: 跑测试确认失败**

Run:

```bash
pnpm run test:unit -- src/server/rss/deriveFeedIconUrl.test.ts
```

Expected: FAIL（文件/函数不存在）。

**Step 3: 最小实现**

```ts
export function deriveFeedIconUrl(siteUrl: string | null | undefined): string | null {
  if (!siteUrl) return null;
  try {
    const { origin } = new URL(siteUrl);
    return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(origin)}`;
  } catch {
    return null;
  }
}
```

**Step 4: 跑测试确认通过**

Run:

```bash
pnpm run test:unit -- src/server/rss/deriveFeedIconUrl.test.ts
```

Expected: PASS。

**Step 5: 提交**

```bash
git add src/server/rss/deriveFeedIconUrl.ts src/server/rss/deriveFeedIconUrl.test.ts
git commit -m "feat(rss): add siteUrl-to-iconUrl helper"
```

---

### Task 3: 扩展 feeds API 与 repo 支持 `url/siteUrl/iconUrl`

**Files:**

- Modify: `src/app/api/feeds/route.ts`
- Modify: `src/app/api/feeds/[id]/route.ts`
- Modify: `src/server/repositories/feedsRepo.ts`
- Modify: `src/app/api/feeds/routes.test.ts`
- Modify: `src/server/repositories/feedsRepo.fulltextOnOpen.test.ts`
- Modify: `src/server/repositories/feedsRepo.aiSummaryOnOpen.test.ts`

**Step 1: 先写/改失败测试**

```ts
it('POST /api/feeds forwards siteUrl and derived iconUrl', async () => {
  // expect createFeed called with { siteUrl, iconUrl }
});

it('PATCH /api/feeds/:id accepts url and siteUrl', async () => {
  // expect updateFeed called with { url, siteUrl, iconUrl }
});
```

repo 侧补一个断言：`updateFeed` SQL 包含 `url = $n` 分支。

**Step 2: 跑测试确认失败**

Run:

```bash
pnpm run test:unit -- src/app/api/feeds/routes.test.ts src/server/repositories/feedsRepo.fulltextOnOpen.test.ts src/server/repositories/feedsRepo.aiSummaryOnOpen.test.ts
```

Expected: FAIL（schema 不接收字段或 repo 不支持 url patch）。

**Step 3: 最小实现通过**

```ts
// POST schema
siteUrl: z.string().trim().url().nullable().optional()

// PATCH schema
url: z.string().trim().min(1).url().optional(),
siteUrl: z.string().trim().url().nullable().optional(),

// route layer
const iconUrl = deriveFeedIconUrl(parsed.data.siteUrl ?? null);

// repo updateFeed input
url?: string;
if (typeof input.url !== 'undefined') {
  fields.push(`url = $${paramIndex++}`);
  values.push(input.url);
}
```

**Step 4: 重新运行测试**

Run:

```bash
pnpm run test:unit -- src/app/api/feeds/routes.test.ts src/server/repositories/feedsRepo.fulltextOnOpen.test.ts src/server/repositories/feedsRepo.aiSummaryOnOpen.test.ts
```

Expected: PASS。

**Step 5: 提交**

```bash
git add src/app/api/feeds/route.ts src/app/api/feeds/[id]/route.ts src/server/repositories/feedsRepo.ts src/app/api/feeds/routes.test.ts src/server/repositories/feedsRepo.fulltextOnOpen.test.ts src/server/repositories/feedsRepo.aiSummaryOnOpen.test.ts
git commit -m "feat(api): support feed url/site metadata updates"
```

---

### Task 4: 打通前端 API DTO 与 store（承接 icon/url 更新）

**Files:**

- Modify: `src/lib/apiClient.ts`
- Modify: `src/types/index.ts`
- Modify: `src/store/appStore.ts`
- Modify: `src/store/appStore.test.ts`

**Step 1: 先写失败测试**

```ts
it('updateFeed updates url and icon in store while keeping unreadCount', async () => {
  // mock patchFeed => returns new url + iconUrl
  // expect feed.url updated
  // expect feed.icon updated from iconUrl
  // expect unreadCount unchanged
});
```

**Step 2: 跑测试确认失败**

Run:

```bash
pnpm run test:unit -- src/store/appStore.test.ts
```

Expected: FAIL（store 当前未更新 `url/icon`）。

**Step 3: 最小实现**

```ts
// apiClient input extensions
patchFeed(feedId, { url?: string, siteUrl?: string | null, ... })
createFeed({ ..., siteUrl?: string | null })

// DTO -> Feed
icon: dto.iconUrl ?? undefined

// appStore.updateFeed
url: updated.url,
icon: updated.iconUrl ?? undefined,
```

**Step 4: 跑测试确认通过**

Run:

```bash
pnpm run test:unit -- src/store/appStore.test.ts
```

Expected: PASS。

**Step 5: 提交**

```bash
git add src/lib/apiClient.ts src/types/index.ts src/store/appStore.ts src/store/appStore.test.ts
git commit -m "refactor(store): map feed icon/url from api dto"
```

---

### Task 5: 新增弹窗改为“校验成功即覆盖名称并携带 siteUrl”

**Files:**

- Modify: `src/features/feeds/services/rssValidationService.ts`
- Modify: `src/features/feeds/AddFeedDialog.tsx`
- Modify: `src/features/feeds/AddFeedDialog.test.tsx`

**Step 1: 先改失败测试**

```ts
it('overwrites title when validation succeeds even if title already has value', async () => {
  // old: keeps Custom Title
  // new: expect Mock Feed Title
});

it('submits validated siteUrl in create payload', async () => {
  // expect lastCreateFeedBody.siteUrl === 'https://example.com/'
});
```

**Step 2: 跑测试确认失败**

Run:

```bash
pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx
```

Expected: FAIL（当前逻辑为仅空值填充；payload 无 siteUrl）。

**Step 3: 最小实现**

```ts
const [validatedSiteUrl, setValidatedSiteUrl] = useState<string | null>(null);

if (result.ok) {
  const suggestedTitle = typeof result.title === 'string' ? result.title.trim() : '';
  if (suggestedTitle) setTitle(suggestedTitle);
  setValidatedSiteUrl(typeof result.siteUrl === 'string' ? result.siteUrl : null);
}

await onSubmit({ ..., siteUrl: validatedSiteUrl });
```

URL `onChange` 时同步清空 `validatedSiteUrl`，防止旧值串用。

**Step 4: 跑测试确认通过**

Run:

```bash
pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx
```

Expected: PASS。

**Step 5: 提交**

```bash
git add src/features/feeds/services/rssValidationService.ts src/features/feeds/AddFeedDialog.tsx src/features/feeds/AddFeedDialog.test.tsx
git commit -m "feat(feeds): force refresh title and persist siteUrl on add"
```

---

### Task 6: 编辑弹窗支持 URL 编辑 + 强制复验 + 覆盖名称

**Files:**

- Modify: `src/features/feeds/EditFeedDialog.tsx`
- Modify: `src/features/feeds/FeedList.tsx`
- Modify: `src/features/feeds/FeedList.test.tsx`

**Step 1: 先写失败测试**

```ts
it('disables save after edit url until validation succeeds', async () => {
  // change url -> expect save disabled
  // blur + mock validate success -> expect save enabled
});

it('overwrites title on url validation success in edit flow', async () => {
  // title initially custom -> after validate expect fetched title
});
```

并在提交断言中检查 PATCH body 包含 `url` 与 `siteUrl`。

**Step 2: 跑测试确认失败**

Run:

```bash
pnpm run test:unit -- src/features/feeds/FeedList.test.tsx
```

Expected: FAIL（当前 URL 只读且无验证门禁）。

**Step 3: 最小实现**

```ts
// EditFeedDialog local states
const [url, setUrl] = useState(feed.url);
const [validationState, setValidationState] = useState<'idle'|'validating'|'verified'|'failed'>('verified');
const [lastVerifiedUrl, setLastVerifiedUrl] = useState(feed.url.trim());
const [validatedSiteUrl, setValidatedSiteUrl] = useState<string | null>(feed.siteUrl ?? null);

const canSave = Boolean(trimmedTitle) && validationState === 'verified' && lastVerifiedUrl === trimmedUrl && !saving;

// validate success
if (suggestedTitle) setTitle(suggestedTitle);
setValidatedSiteUrl(result.siteUrl ?? null);

await onSubmit({ title: trimmedTitle, url: trimmedUrl, siteUrl: validatedSiteUrl, ... });
```

**Step 4: 跑测试确认通过**

Run:

```bash
pnpm run test:unit -- src/features/feeds/FeedList.test.tsx
```

Expected: PASS。

**Step 5: 提交**

```bash
git add src/features/feeds/EditFeedDialog.tsx src/features/feeds/FeedList.tsx src/features/feeds/FeedList.test.tsx
git commit -m "feat(feeds): enable url edit with mandatory revalidation"
```

---

### Task 7: 左侧列表 icon 切到持久化 `icon` 字段

**Files:**

- Modify: `src/features/feeds/FeedList.tsx`
- Modify: `src/features/feeds/FeedList.test.tsx`

**Step 1: 先写失败测试**

```ts
it('renders feed icon from persisted icon url instead of feed url derived value', async () => {
  // seed feed.icon = 'https://www.google.com/s2/favicons?...example.com'
  // expect <img src> equals feed.icon
});
```

**Step 2: 跑测试确认失败**

Run:

```bash
pnpm run test:unit -- src/features/feeds/FeedList.test.tsx
```

Expected: FAIL（当前仍用 `getFeedFaviconUrl(feed.url)`）。

**Step 3: 最小实现**

```tsx
<img src={feed.icon ?? ''} ... />
{!feed.icon ? <FallbackIcon /> : null}
```

删除或降级 `getFeedFaviconUrl`，确保主路径不再依赖 `feed.url`。

**Step 4: 跑测试确认通过**

Run:

```bash
pnpm run test:unit -- src/features/feeds/FeedList.test.tsx
```

Expected: PASS。

**Step 5: 提交**

```bash
git add src/features/feeds/FeedList.tsx src/features/feeds/FeedList.test.tsx
git commit -m "refactor(feeds): render list icon from persisted metadata"
```

---

### Task 8: 回归验证与收尾

**Files:**

- Modify: 若测试驱动下存在 snapshot/fixture 修正，按实际提交

**Step 1: 跑聚合目标测试**

Run:

```bash
pnpm run test:unit -- \
  src/app/api/rss/validate/route.test.ts \
  src/app/api/feeds/routes.test.ts \
  src/server/rss/deriveFeedIconUrl.test.ts \
  src/store/appStore.test.ts \
  src/features/feeds/AddFeedDialog.test.tsx \
  src/features/feeds/FeedList.test.tsx
```

Expected: 全 PASS。

**Step 2: 运行全量单测（可选但推荐）**

Run:

```bash
pnpm run test:unit
```

Expected: 全 PASS；如失败，记录与本改动无关项。

**Step 3: 手工冒烟核对（本地）**

Run:

```bash
pnpm run dev
```

检查：

1. Add：改 URL 后 blur 成功，名称会刷新；保存可用。
2. Edit：URL 可编辑；改 URL 后需复验；成功后名称刷新。
3. FeedList：icon 变化与 `siteUrl` 对应域名一致。

**Step 4: 最终提交**

```bash
git add -A
git commit -m "feat(feeds): editable rss url with validated title refresh and site-based icon"
```

---

## 完成定义（DoD）

1. 新增与编辑均支持修改 RSS URL。
2. 新增与编辑均要求 URL 验证通过后保存。
3. URL 验证成功后，名称在新增/编辑中都按返回 title 覆盖（title 非空）。
4. 列表 icon 来源为持久化站点元数据，不再依赖中转 RSS URL。
5. 目标测试集全部通过。


# Feed Category Inline Management Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 移除独立分类管理入口与弹窗，将分类管理收敛到 RSS 源添加/编辑流程和左栏分类右键菜单，并保证分类生命周期与 feed 生命周期保持一致。

**Architecture:** 服务端新增一层事务服务，统一处理分类名归并、新建分类、feed 创建/更新、旧空分类清理、删除最后一个 feed 时的分类清理。前端将 `FeedDialog` 的分类字段改成可输入型下拉，`FeedList` 改为通过分类右键菜单处理重命名、上移、下移、删除，并在可能影响分类集合的动作后以快照刷新为最终事实来源。

**Tech Stack:** Next.js 16、React 19、TypeScript、Zustand、PostgreSQL、Vitest、Testing Library、shadcn/ui

---

## Prior Art / Learned Lessons

- 参考：[`docs/summaries/2026-03-05-categories-settings-table-reorder.md`](../summaries/2026-03-05-categories-settings-table-reorder.md)
  - 分类顺序已经驱动 `FeedList` 与 `AddFeedDialog`，本次不能引入第二套顺序状态。
  - 现有 `reorderCategories` 已稳定，不要重写排序协议。
- 参考：[`docs/summaries/2026-03-05-rss-feed-dialog-policy-split.md`](../summaries/2026-03-05-rss-feed-dialog-policy-split.md)
  - `FeedDialog` 应继续只处理基础字段，不要把完整分类 CRUD 面板塞回弹窗。
  - 高频动作要贴近主流程，而不是经由额外设置或管理容器。
- 设计文档：[`docs/plans/2026-03-06-feed-category-inline-management-design.md`](./2026-03-06-feed-category-inline-management-design.md)

## Constraints / Implementation Rules

1. 按 TDD 执行，每个任务先写失败测试，再写最小实现。
2. 保留 `categories` 表与 `reorderCategories` 协议，不将分类退化成 feed 上的自由字符串。
3. `未分类` 继续是系统保底项，不支持重命名、排序或普通删除。
4. 分类名归并规则固定为 `trim + lower`。
5. 新分类只有在 feed 保存成功后才算真正存在；空分类立即清理。
6. 优先使用 feature-local 组件完成“输入型下拉”，不要为了这次需求顺手引入一整套新的共享 UI primitive。
7. 相关技能：@vitest @nodejs-best-practices @vercel-react-best-practices @workflow-verification-before-completion @workflow-summary

### Task 1: 落地服务端分类生命周期服务

**Files:**

- Create: `src/server/services/feedCategoryLifecycleService.ts`
- Create: `src/server/services/feedCategoryLifecycleService.test.ts`
- Modify: `src/server/repositories/categoriesRepo.ts`
- Modify: `src/server/repositories/categoriesRepo.test.ts`
- Modify: `src/server/repositories/feedsRepo.ts`

**Step 1: Write the failing test**

```ts
// src/server/services/feedCategoryLifecycleService.test.ts
it('creates a new category at the end and binds it when categoryName does not exist', async () => {
  const pool = createMockPool();

  await createFeedWithCategoryResolution(pool, {
    title: 'Example',
    url: 'https://example.com/feed.xml',
    siteUrl: null,
    categoryName: 'Tech',
  });

  expect(pool.query).toHaveBeenCalledWith(
    expect.stringContaining('insert into categories'),
    expect.arrayContaining(['Tech']),
  );
  expect(pool.query).toHaveBeenCalledWith(
    expect.stringContaining('insert into feeds'),
    expect.arrayContaining([expect.any(String)]),
  );
});

it('removes the previous category when an update leaves it empty', async () => {
  // 断言 updateFeedWithCategoryResolution 在旧分类 feed 数量归零时执行 delete categories
});

it('deletes the category when deleting the last feed in it', async () => {
  // 断言 deleteFeedAndCleanupCategory 会清理最后一个普通分类
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/server/services/feedCategoryLifecycleService.test.ts`

Expected: FAIL with module not found for `./feedCategoryLifecycleService` and missing repo helpers.

**Step 3: Write minimal implementation**

```ts
// src/server/services/feedCategoryLifecycleService.ts
export async function createFeedWithCategoryResolution(pool: Pool, input: CreateFeedWithCategoryInput) {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const resolvedCategoryId = await resolveCategoryId(client, {
      categoryId: input.categoryId ?? null,
      categoryName: input.categoryName ?? null,
    });

    const created = await createFeed(client, {
      ...input,
      categoryId: resolvedCategoryId,
    });

    await client.query('commit');
    return created;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function resolveCategoryId(client: PoolClient, input: { categoryId: string | null; categoryName: string | null }) {
  if (input.categoryId) return input.categoryId;
  const normalized = input.categoryName?.trim();
  if (!normalized || normalized === '未分类') return null;

  const existing = await findCategoryByNormalizedName(client, normalized);
  if (existing) return existing.id;

  const position = await getNextCategoryPosition(client);
  const created = await createCategory(client, { name: normalized, position });
  return created.id;
}
```

同时补最小 repo helper：

```ts
// src/server/repositories/categoriesRepo.ts
export async function findCategoryByNormalizedName(
  db: Pool | PoolClient,
  name: string,
): Promise<CategoryRow | null> {
  const { rows } = await db.query<CategoryRow>(
    'select id, name, position from categories where lower(name) = lower($1) limit 1',
    [name.trim()],
  );
  return rows[0] ?? null;
}

export async function getNextCategoryPosition(db: Pool | PoolClient): Promise<number> {
  const { rows } = await db.query<{ nextPosition: number }>(
    'select coalesce(max(position), -1) + 1 as "nextPosition" from categories',
  );
  return rows[0]?.nextPosition ?? 0;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/server/services/feedCategoryLifecycleService.test.ts src/server/repositories/categoriesRepo.test.ts`

Expected: PASS，且覆盖“创建新分类”“复用同名分类”“更新后清理旧空分类”“删除最后一个 feed 清理分类”。

**Step 5: Commit**

```bash
git add src/server/services/feedCategoryLifecycleService.ts src/server/services/feedCategoryLifecycleService.test.ts src/server/repositories/categoriesRepo.ts src/server/repositories/categoriesRepo.test.ts src/server/repositories/feedsRepo.ts
git commit -m "feat(server): 新增订阅分类生命周期服务"
```

### Task 2: 接入 feed 路由的新分类输入契约

**Files:**

- Modify: `src/app/api/feeds/route.ts`
- Modify: `src/app/api/feeds/[id]/route.ts`
- Modify: `src/app/api/feeds/routes.test.ts`

**Step 1: Write the failing test**

```ts
// src/app/api/feeds/routes.test.ts
it('POST /api/feeds accepts categoryName and delegates to lifecycle service', async () => {
  createFeedWithCategoryResolutionMock.mockResolvedValue({ ...baseFeedRow, categoryId: categoryId });

  const mod = await import('./route');
  const res = await mod.POST(
    new Request('http://localhost/api/feeds', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Example',
        url: 'https://1.1.1.1/rss.xml',
        categoryName: 'Tech',
      }),
    }),
  );

  expect(createFeedWithCategoryResolutionMock).toHaveBeenCalledWith(
    pool,
    expect.objectContaining({ categoryName: 'Tech' }),
  );
  expect((await res.json()).ok).toBe(true);
});

it('PATCH /api/feeds/:id rejects payloads that send both categoryId and categoryName', async () => {
  // 断言 zod/body refine 返回 validation_error
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/app/api/feeds/routes.test.ts`

Expected: FAIL because routes only accept `categoryId` and still call `createFeed/updateFeed/deleteFeed` directly.

**Step 3: Write minimal implementation**

```ts
// src/app/api/feeds/route.ts
const categoryInputSchema = z
  .object({
    categoryId: z.string().uuid().nullable().optional(),
    categoryName: z.string().trim().min(1).nullable().optional(),
  })
  .refine((value) => !(value.categoryId && value.categoryName), {
    path: ['categoryName'],
    message: 'categoryId and categoryName are mutually exclusive',
  });

const createFeedBodySchema = z.object({
  title: z.string().trim().min(1),
  url: z.string().trim().min(1).url(),
  siteUrl: z.string().trim().url().nullable().optional(),
  ...categoryInputSchema.shape,
});

const created = await createFeedWithCategoryResolution(pool, {
  ...parsed.data,
  siteUrl,
  iconUrl: deriveFeedIconUrl(siteUrl),
});
```

`PATCH` 与 `DELETE` 同理改为调用：

```ts
await updateFeedWithCategoryResolution(pool, paramsParsed.data.id, input);
await deleteFeedAndCleanupCategory(pool, paramsParsed.data.id);
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/app/api/feeds/routes.test.ts src/server/services/feedCategoryLifecycleService.test.ts`

Expected: PASS，且已有 duplicate url / invalid category / unsafe url 用例保持绿色。

**Step 5: Commit**

```bash
git add src/app/api/feeds/route.ts src/app/api/feeds/[id]/route.ts src/app/api/feeds/routes.test.ts
git commit -m "refactor(api): 接入订阅分类解析服务"
```

### Task 3: 更新客户端 API 与 store，同步 `categoryName` 和快照刷新

**Files:**

- Modify: `src/lib/apiClient.ts`
- Modify: `src/store/appStore.ts`
- Modify: `src/store/appStore.test.ts`

**Step 1: Write the failing test**

```ts
// src/store/appStore.test.ts
it('updateFeed reloads snapshot after changing category so category list stays current', async () => {
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (url.includes('/api/feeds/feed-1') && method === 'PATCH') {
      return jsonResponse({ ok: true, data: { ...updatedFeedRow, categoryId: 'cat-new' } });
    }
    if (url.includes('/api/reader/snapshot') && method === 'GET') {
      return jsonResponse({
        ok: true,
        data: {
          categories: [{ id: 'cat-new', name: '新分类', position: 0 }],
          feeds: [{ ...updatedFeedSnapshot, categoryId: 'cat-new' }],
          articles: { items: [], nextCursor: null },
        },
      });
    }
    throw new Error(`Unexpected fetch: ${method} ${url}`);
  });

  await useAppStore.getState().updateFeed('feed-1', { categoryName: '新分类' });

  expect(useAppStore.getState().categories.some((item) => item.name === '新分类')).toBe(true);
});

it('removeFeed reloads snapshot after deleting the last feed in a category', async () => {
  // 断言删除后 categories 已不含旧分类
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/store/appStore.test.ts`

Expected: FAIL because `patchFeed` payload不支持 `categoryName`，且 `updateFeed/removeFeed` 不会刷新 snapshot。

**Step 3: Write minimal implementation**

```ts
// src/lib/apiClient.ts
export async function createFeed(input: {
  title: string;
  url: string;
  siteUrl?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
}) { /* 过滤 undefined 后发送 */ }

export async function patchFeed(feedId: string, input: {
  categoryId?: string | null;
  categoryName?: string | null;
}) { /* 同样过滤 undefined */ }
```

```ts
// src/store/appStore.ts
await useAppStore.getState().loadSnapshot({ view: get().selectedView });

// updateFeed
const updated = await patchFeed(feedId, patch);
set(...);
await get().loadSnapshot({ view: get().selectedView });

// removeFeed
await deleteFeed(feedId);
set(...nextSelectedView...);
await get().loadSnapshot({ view: nextSelectedView });
```

实现时保持：

- `addFeed` 继续保留现有 refresh + poll 行为。
- `updateFeed` 和 `removeFeed` 统一在成功后刷新快照，以快照中的 `categories` 为最终事实来源。

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/store/appStore.test.ts`

Expected: PASS，且原有 addFeed poll / partial patch / unreadCount 用例不回归。

**Step 5: Commit**

```bash
git add src/lib/apiClient.ts src/store/appStore.ts src/store/appStore.test.ts
git commit -m "refactor(store): 同步订阅分类新契约与快照刷新"
```

### Task 4: 将 FeedDialog 分类字段改为输入型下拉

**Files:**

- Create: `src/features/feeds/CreatableCategoryField.tsx`
- Modify: `src/features/feeds/FeedDialog.tsx`
- Modify: `src/features/feeds/AddFeedDialog.test.tsx`
- Modify: `src/features/feeds/FeedDialog.translationFlags.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/features/feeds/AddFeedDialog.test.tsx
it('submits categoryName when user enters a new category', async () => {
  renderWithNotifications();
  fireEvent.click(screen.getByLabelText('add-feed'));

  fireEvent.change(screen.getByLabelText('分类'), {
    target: { value: '新分类' },
  });

  fireEvent.change(screen.getByLabelText('名称'), { target: { value: 'My Feed' } });
  const urlInput = screen.getByLabelText('URL');
  fireEvent.change(urlInput, { target: { value: 'https://example.com/success.xml' } });
  fireEvent.blur(urlInput);

  fireEvent.click(await screen.findByRole('button', { name: '添加' }));

  await waitFor(() => {
    expect(lastCreateFeedBody).toMatchObject({ categoryName: '新分类' });
    expect(lastCreateFeedBody?.categoryId).toBeUndefined();
  });
});

it('reuses existing categoryId when input only differs by case or spaces', async () => {
  // 输入 "  科技  " 仍提交 cat-tech
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx src/features/feeds/FeedDialog.translationFlags.test.tsx`

Expected: FAIL because current `Select` 不能直接输入新值，只会提交 `categoryId`。

**Step 3: Write minimal implementation**

```tsx
// src/features/feeds/CreatableCategoryField.tsx
export default function CreatableCategoryField({
  value,
  options,
  onChange,
}: CreatableCategoryFieldProps) {
  return (
    <>
      <Input
        id="feed-category"
        list="feed-category-options"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="输入分类或选择已有分类"
      />
      <datalist id="feed-category-options">
        {options.map((option) => (
          <option key={option.id} value={option.name} />
        ))}
      </datalist>
    </>
  );
}
```

```tsx
// src/features/feeds/FeedDialog.tsx
const [categoryInput, setCategoryInput] = useState(resolveInitialCategoryInput(...));
const matchedCategory = resolveCategoryTarget(categories, categoryInput);

await onSubmit({
  title: trimmedTitle,
  url: trimmedUrl,
  siteUrl: validatedSiteUrl,
  ...(isUncategorized(categoryInput)
    ? { categoryId: null }
    : matchedCategory
      ? { categoryId: matchedCategory.id }
      : { categoryName: categoryInput.trim() }),
});
```

实现约束：

- 使用 feature-local `Input + datalist` 即可，不为这次需求引入共享 `Popover/Command` 基元。
- `FeedDialog` 仍然只暴露基础字段，不额外承载完整分类管理能力。

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx src/features/feeds/FeedDialog.translationFlags.test.tsx`

Expected: PASS，且“Add dialog only shows URL/名称/分类 fields”这类现有断言保持成立。

**Step 5: Commit**

```bash
git add src/features/feeds/CreatableCategoryField.tsx src/features/feeds/FeedDialog.tsx src/features/feeds/AddFeedDialog.test.tsx src/features/feeds/FeedDialog.translationFlags.test.tsx
git commit -m "feat(feeds): 支持输入型订阅分类选择"
```

### Task 5: 用左栏分类右键菜单替换独立管理入口

**Files:**

- Create: `src/features/feeds/RenameCategoryDialog.tsx`
- Modify: `src/features/feeds/FeedList.tsx`
- Modify: `src/features/feeds/FeedList.test.tsx`
- Delete: `src/features/categories/CategoryManagerDialog.tsx`
- Delete: `src/features/categories/CategoryManagerPanel.tsx`
- Delete: `src/features/categories/CategoryManagerPanel.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/features/feeds/FeedList.test.tsx
it('does not render the standalone 管理分类 entry anymore', () => {
  renderWithNotifications();
  expect(screen.queryByRole('button', { name: '管理分类' })).not.toBeInTheDocument();
});

it('opens rename dialog from category context menu', async () => {
  renderWithNotifications();

  fireEvent.contextMenu(screen.getByRole('button', { name: '设计' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: '编辑' }));

  expect(screen.getByRole('dialog', { name: '重命名分类' })).toBeInTheDocument();
});

it('moves category down from the context menu', async () => {
  // 断言调用 /api/categories/reorder 且 headers 顺序交换
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/feeds/FeedList.test.tsx`

Expected: FAIL because `管理分类` 入口和独立弹窗仍存在，分类标题还没有右键菜单行为。

**Step 3: Write minimal implementation**

```tsx
// src/features/feeds/FeedList.tsx
<ContextMenu>
  <ContextMenuTrigger asChild>
    <button type="button" onClick={() => toggleCategory(category.id)}>
      {category.name}
    </button>
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem onSelect={() => setRenameCategoryId(category.id)}>编辑</ContextMenuItem>
    <ContextMenuItem
      disabled={index === 0}
      onSelect={() => void moveCategory(category.id, 'up')}
    >
      上移
    </ContextMenuItem>
    <ContextMenuItem
      disabled={index === movableCategories.length - 1}
      onSelect={() => void moveCategory(category.id, 'down')}
    >
      下移
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem onSelect={() => setDeleteCategoryId(category.id)}>删除</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

```tsx
// src/features/feeds/RenameCategoryDialog.tsx
export default function RenameCategoryDialog({ open, category, onSubmit, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>重命名分类</DialogTitle>
        </DialogHeader>
        {/* Input + 保存按钮；冲突时显示“分类已存在” */}
      </DialogContent>
    </Dialog>
  );
}
```

实现时保持：

- `删除分类` 继续复用当前“feeds 回落到未分类”的语义。
- `未分类` 不挂右键菜单。
- 排序只做相邻交换，然后调用 `reorderCategories`。

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/features/feeds/FeedList.test.tsx`

Expected: PASS，且现有 feed 右键菜单里的 `编辑 / AI摘要配置 / 翻译配置 / 停用 / 删除` 用例不回归。

**Step 5: Commit**

```bash
git add src/features/feeds/RenameCategoryDialog.tsx src/features/feeds/FeedList.tsx src/features/feeds/FeedList.test.tsx
git add -u src/features/categories/CategoryManagerDialog.tsx src/features/categories/CategoryManagerPanel.tsx src/features/categories/CategoryManagerPanel.test.tsx
git commit -m "refactor(feeds): 改为左栏分类右键管理"
```

### Task 6: 跑回归验证并沉淀总结

**Files:**

- Create: `docs/summaries/2026-03-06-feed-category-inline-management.md`
- Modify: `docs/plans/2026-03-06-feed-category-inline-management-implementation-plan.md`（仅在执行过程中需要记录调整时）

**Step 1: Run the focused regression suite**

Run:

```bash
pnpm run test:unit -- src/server/services/feedCategoryLifecycleService.test.ts src/app/api/feeds/routes.test.ts src/store/appStore.test.ts src/features/feeds/AddFeedDialog.test.tsx src/features/feeds/FeedDialog.translationFlags.test.tsx src/features/feeds/FeedList.test.tsx
```

Expected: PASS with the new category lifecycle, dialog input, and sidebar context menu coverage all green.

**Step 2: Run lint**

Run: `pnpm run lint`

Expected: PASS with 0 errors.

**Step 3: Run full unit tests**

Run: `pnpm run test:unit`

Expected: PASS; if flakes appear, capture exact failing file and rerun before claiming completion.

**Step 4: Write summary**

```md
# 订阅分类内联管理总结

## 变更
- 移除独立分类管理入口与弹窗
- `FeedDialog` 改为输入型分类下拉
- 服务端统一处理分类解析、新建和空分类清理

## 验证
- `pnpm run test:unit -- ...`
- `pnpm run lint`
- `pnpm run test:unit`
```

**Step 5: Commit**

```bash
git add docs/summaries/2026-03-06-feed-category-inline-management.md
git commit -m "docs(summary): 记录订阅分类内联管理验证结果"
```

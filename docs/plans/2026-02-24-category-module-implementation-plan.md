# Category Module Replacement Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 移除设置中的 RSS 源管理，新增分类 CRUD 模块，并让 `AddFeedDialog` 与 `FeedList` 全局复用同一份分类数据（仅前端 + mock）。

**Architecture:** 采用 `settingsStore` 作为分类主数据来源，`appStore` 只保留阅读态与分类展开态。`Feed` 从 `category`（字符串）迁移到 `categoryId`（引用），`FeedList` 渲染时通过分类表 join 显示名称；删除分类时将关联 feed 自动归未分类（`categoryId = null`）。

**Tech Stack:** Next.js 16、React 19、TypeScript、Zustand、Vitest、Testing Library

---

## 0. 约束与先决条件

1. 仅实现前端逻辑与 UI，不接后端 API。
2. 全局分类唯一性：`trim + lowercase` 唯一。
3. 删除分类后，关联 feed 自动设为未分类。
4. 重命名分类后，所有 UI 通过 `categoryId` 关联自动显示新名称。
5. 计划执行建议在独立 worktree 中进行。

## 1. Prior Art Scan（solutions）

- 项目级：`docs/solutions` 不存在（`NO_PROJECT_SOLUTIONS`）
- 全局级：`~/.agents/docs/solutions` 不存在（`NO_GLOBAL_SOLUTIONS`）
- 结论：无可复用 solution 文档，按当前设计文档直接实施。

## 2. 风险与防错清单

1. `Feed` 改为 `categoryId` 后，`src/features/*` 与 `src/components/*` 双路径都要同步，避免 TS 编译残留报错。
2. 设置中心移除 RSS 面板后，`SettingsCenterModal.test.tsx` 需要重写相关断言，否则回归测试会持续失败。
3. 删除分类的副作用跨 store（`settingsStore` 与 `appStore`），要明确 action 归属，防止状态不同步。
4. “未分类”必须保持为虚拟分组，不应进入可编辑分类列表。
5. 迁移逻辑要兼容历史 `category`/`folder` 字符串数据，避免 localStorage 升级后丢失分类信息。

### Task 1: Migrate Core Model to `categoryId`

**Files:**

- Modify: `src/types/index.ts`
- Modify: `src/mock/data.ts`
- Modify: `src/data/provider/readerDataProvider.ts`
- Modify: `src/data/mock/mockProvider.ts`
- Modify: `src/store/appStore.ts`
- Test: `src/store/appStore.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { useAppStore } from './appStore';

describe('appStore categoryId model', () => {
  it('adds feed with categoryId and keeps unread count', () => {
    const before = useAppStore.getState().feeds.length;
    useAppStore.getState().addFeed({
      id: 'feed-test',
      title: 'Test Feed',
      url: 'https://example.com/feed.xml',
      unreadCount: 0,
      categoryId: 'cat-tech',
    });

    const state = useAppStore.getState();
    expect(state.feeds).toHaveLength(before + 1);
    expect(state.feeds.find((f) => f.id === 'feed-test')?.categoryId).toBe('cat-tech');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/store/appStore.test.ts`
Expected: FAIL with type errors around `Feed.categoryId` / missing property mappings.

**Step 3: Write minimal implementation**

```ts
// src/types/index.ts
export interface Category {
  id: string;
  name: string;
}

export interface Feed {
  id: string;
  title: string;
  url: string;
  icon?: string;
  unreadCount: number;
  categoryId?: string | null;
}
```

```ts
// src/mock/data.ts (example)
export const mockCategories: Category[] = [
  { id: 'cat-tech', name: '科技' },
  { id: 'cat-design', name: '设计' },
  { id: 'cat-dev', name: '开发' },
];

// feed seed
{ id: 'feed-1', ..., categoryId: 'cat-tech' }
```

```ts
// src/data/mock/mockProvider.ts (example)
state.feeds.push({
  ...feed,
  categoryId: feed.categoryId ?? null,
  unreadCount: feed.unreadCount ?? 0,
});
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/store/appStore.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/types/index.ts src/mock/data.ts src/data/provider/readerDataProvider.ts src/data/mock/mockProvider.ts src/store/appStore.ts src/store/appStore.test.ts
git commit -m "refactor(core): 迁移Feed分类字段到categoryId模型"
```

### Task 2: Add Persisted Categories Schema + Migration

**Files:**

- Modify: `src/types/index.ts`
- Modify: `src/features/settings/settingsSchema.ts`
- Test: `src/features/settings/settingsSchema.test.ts`

**Step 1: Write the failing test**

```ts
it('normalizes categories and maps legacy rss source category/folder names', () => {
  const normalized = normalizePersistedSettings({
    categories: [{ id: 'cat-tech', name: '科技' }],
    rss: {
      sources: [
        { id: '1', name: 'A', url: 'https://example.com/rss.xml', category: '科技', enabled: true },
        { id: '2', name: 'B', url: 'https://example.com/rss2.xml', folder: '设计', enabled: true },
      ],
    },
  });

  expect(normalized.categories.length).toBeGreaterThanOrEqual(2);
  expect(normalized.categories.some((c) => c.name === '科技')).toBe(true);
  expect(normalized.categories.some((c) => c.name === '设计')).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/settings/settingsSchema.test.ts`
Expected: FAIL with `categories` field missing in normalized settings.

**Step 3: Write minimal implementation**

```ts
// types
export interface PersistedSettings {
  appearance: AppearanceSettings;
  ai: AIPersistedSettings;
  categories: Category[];
}

// settingsSchema normalize
function normalizeCategories(input: Record<string, unknown>): Category[] {
  const raw = Array.isArray(input.categories) ? input.categories : [];
  const seen = new Set<string>();
  const result: Category[] = [];

  for (const item of raw) {
    if (!isRecord(item)) continue;
    const name = readString(item.name, '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ id: readString(item.id, `cat-${result.length}`), name });
  }

  return result;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/features/settings/settingsSchema.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/types/index.ts src/features/settings/settingsSchema.ts src/features/settings/settingsSchema.test.ts
git commit -m "feat(settings): 引入分类主数据Schema与历史迁移"
```

### Task 3: Remove RSS Validation Gate and Add Category Validation

**Files:**

- Modify: `src/features/settings/validateSettingsDraft.ts`
- Test: `src/features/settings/validateSettingsDraft.test.ts`
- Modify: `src/store/settingsStore.ts`
- Test: `src/store/settingsStore.test.ts`

**Step 1: Write the failing test**

```ts
it('rejects duplicate category names case-insensitively', () => {
  const draft: SettingsDraft = {
    persisted: {
      ...structuredClone(defaultPersistedSettings),
      categories: [
        { id: 'cat-1', name: 'Tech' },
        { id: 'cat-2', name: ' tech ' },
      ],
    },
    session: { ai: { apiKey: '' } },
  };

  const result = validateSettingsDraft(draft);
  expect(result.valid).toBe(false);
  expect(result.errors['categories.1.name']).toContain('duplicate');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/settings/validateSettingsDraft.test.ts src/store/settingsStore.test.ts`
Expected: FAIL because categories validation path does not exist.

**Step 3: Write minimal implementation**

```ts
function validateCategories(draft: SettingsDraft, errors: Record<string, string>) {
  const seen = new Set<string>();
  draft.persisted.categories.forEach((item, index) => {
    const trimmed = item.name.trim();
    if (!trimmed) {
      errors[`categories.${index}.name`] = 'Category name is required.';
      return;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      errors[`categories.${index}.name`] = 'Category name is duplicate.';
      return;
    }
    seen.add(key);
  });
}
```

```ts
// settingsStore session cleanup
interface SessionSettings {
  ai: { apiKey: string };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/features/settings/validateSettingsDraft.test.ts src/store/settingsStore.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/settings/validateSettingsDraft.ts src/features/settings/validateSettingsDraft.test.ts src/store/settingsStore.ts src/store/settingsStore.test.ts
git commit -m "refactor(settings): 移除RSS保存门禁并新增分类校验"
```

### Task 4: Build `CategoriesSettingsPanel` and Replace RSS Tab

**Files:**

- Create: `src/features/settings/panels/CategoriesSettingsPanel.tsx`
- Create: `src/features/settings/panels/CategoriesSettingsPanel.test.tsx`
- Modify: `src/features/settings/SettingsCenterDrawer.tsx`
- Delete: `src/features/settings/panels/RssSourcesSettingsPanel.tsx`

**Step 1: Write the failing test**

```tsx
it('supports category create/rename/delete in settings', async () => {
  render(<ReaderLayout />);
  fireEvent.click(screen.getByLabelText('open-settings'));
  fireEvent.click(screen.getByTestId('settings-section-tab-categories'));

  fireEvent.change(screen.getByLabelText('新分类名称'), { target: { value: 'Tech' } });
  fireEvent.click(screen.getByRole('button', { name: '添加分类' }));
  expect(screen.getByDisplayValue('Tech')).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/settings/panels/CategoriesSettingsPanel.test.tsx`
Expected: FAIL with file/component missing.

**Step 3: Write minimal implementation**

```tsx
export default function CategoriesSettingsPanel({ draft, onChange, errors }: Props) {
  const [newName, setNewName] = useState('');
  return (
    <section>
      <input aria-label="新分类名称" value={newName} onChange={(e) => setNewName(e.target.value)} />
      <button
        type="button"
        onClick={() =>
          onChange((nextDraft) => {
            nextDraft.persisted.categories.push({
              id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `cat-${Date.now()}`,
              name: newName.trim(),
            });
            setNewName('');
          })
        }
      >
        添加分类
      </button>
    </section>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/features/settings/panels/CategoriesSettingsPanel.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/settings/panels/CategoriesSettingsPanel.tsx src/features/settings/panels/CategoriesSettingsPanel.test.tsx src/features/settings/SettingsCenterDrawer.tsx
git rm src/features/settings/panels/RssSourcesSettingsPanel.tsx
git commit -m "feat(settings): 设置中心替换为分类管理面板"
```

### Task 5: Update Settings Modal Integration Tests

**Files:**

- Modify: `src/features/settings/SettingsCenterModal.test.tsx`

**Step 1: Write/adjust failing assertions**

```tsx
expect(screen.queryByTestId('settings-section-tab-rss')).not.toBeInTheDocument();
expect(screen.getByTestId('settings-section-tab-categories')).toBeInTheDocument();
```

Remove assertions bound to:

- `验证链接-0`
- `rss.sources.*`
- `修复错误以保存` (RSS 验证导致的路径)

**Step 2: Run test to verify it fails first**

Run: `pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx`
Expected: FAIL with outdated RSS tab assertions.

**Step 3: Write minimal implementation**

```tsx
it('renders categories tab and no rss tab', async () => {
  fireEvent.click(screen.getByLabelText('open-settings'));
  await waitFor(() => expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument());
  expect(screen.getByTestId('settings-section-tab-categories')).toBeInTheDocument();
  expect(screen.queryByTestId('settings-section-tab-rss')).not.toBeInTheDocument();
});
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/settings/SettingsCenterModal.test.tsx
git commit -m "test(settings): 更新设置中心集成测试到分类模块"
```

### Task 6: Wire `AddFeedDialog` and `FeedList` to Category Master Data

**Files:**

- Modify: `src/features/feeds/AddFeedDialog.tsx`
- Modify: `src/features/feeds/AddFeedDialog.test.tsx`
- Modify: `src/features/feeds/FeedList.tsx`
- Modify: `src/components/FeedList/index.tsx`
- Modify: `src/store/appStore.ts`

**Step 1: Write the failing test**

```tsx
it('submits categoryId from category dropdown', async () => {
  render(<ReaderLayout />);
  fireEvent.click(screen.getByLabelText('add-feed'));
  fireEvent.change(screen.getByPlaceholderText('例如：The Verge'), { target: { value: 'My Feed' } });
  fireEvent.change(screen.getByPlaceholderText('https://example.com/feed.xml'), {
    target: { value: 'https://example.com/success.xml' },
  });
  fireEvent.click(screen.getByRole('button', { name: '验证链接' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '添加' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '添加' }));
  expect(useAppStore.getState().feeds.at(-1)?.categoryId ?? null).not.toBeUndefined();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx`
Expected: FAIL on payload/type mismatch (`category` vs `categoryId`).

**Step 3: Write minimal implementation**

```tsx
// AddFeedDialog props
onSubmit: (payload: { title: string; url: string; categoryId: string | null }) => void;

// submit payload
onSubmit({
  title: trimmedTitle,
  url: trimmedUrl,
  categoryId: categoryId || null,
});
```

```tsx
// FeedList submit
addFeed({
  id,
  title,
  url,
  icon: '📰',
  unreadCount: 0,
  categoryId,
});
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx src/store/appStore.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/feeds/AddFeedDialog.tsx src/features/feeds/AddFeedDialog.test.tsx src/features/feeds/FeedList.tsx src/components/FeedList/index.tsx src/store/appStore.ts
git commit -m "feat(feeds): 添加源与侧栏改为分类主数据驱动"
```

### Task 7: Implement Category Delete Side-Effects (`delete -> uncategorized`)

**Files:**

- Modify: `src/store/appStore.ts`
- Modify: `src/store/appStore.test.ts`
- Modify: `src/features/settings/panels/CategoriesSettingsPanel.tsx`
- Modify: `src/features/settings/panels/CategoriesSettingsPanel.test.tsx`

**Step 1: Write the failing test**

```ts
it('clears feed categoryId when category is deleted', () => {
  const feedId = useAppStore.getState().feeds[0].id;
  const categoryId = useAppStore.getState().feeds[0].categoryId;
  expect(categoryId).toBeTruthy();

  useAppStore.getState().clearCategoryFromFeeds(categoryId!);
  expect(useAppStore.getState().feeds.find((f) => f.id === feedId)?.categoryId ?? null).toBeNull();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/store/appStore.test.ts src/features/settings/panels/CategoriesSettingsPanel.test.tsx`
Expected: FAIL because `clearCategoryFromFeeds` action missing.

**Step 3: Write minimal implementation**

```ts
clearCategoryFromFeeds: (categoryId) =>
  set((state) => ({
    feeds: state.feeds.map((feed) => (feed.categoryId === categoryId ? { ...feed, categoryId: null } : feed)),
  })),
```

```tsx
// panel delete handler
onChange((nextDraft) => {
  nextDraft.persisted.categories = nextDraft.persisted.categories.filter((c) => c.id !== targetId);
});
useAppStore.getState().clearCategoryFromFeeds(targetId);
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/store/appStore.test.ts src/features/settings/panels/CategoriesSettingsPanel.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/store/appStore.ts src/store/appStore.test.ts src/features/settings/panels/CategoriesSettingsPanel.tsx src/features/settings/panels/CategoriesSettingsPanel.test.tsx
git commit -m "feat(settings): 删除分类时自动归并未分类"
```

### Task 8: Cleanup Obsolete RSS Settings Artifacts and Final Verification

**Files:**

- Delete: `src/components/common/CategorySelectField.tsx`
- Delete: `src/components/common/CategorySelectField.test.tsx`
- Modify: `src/features/settings/SettingsCenterDrawer.tsx` (remove unused imports/section hints)
- Modify: `src/features/settings/useSettingsAutosave.test.ts` (if assertions depend on old RSS error paths)

**Step 1: Write failing smoke test (optional if no compile fail yet)**

Run a TypeScript-aware unit pass first to expose dead references.

**Step 2: Run test to verify failures**

Run: `pnpm run test:unit`
Expected: FAIL only on obsolete RSS/category-select references.

**Step 3: Write minimal implementation**

Remove dead files/imports and any stale test assertions.

**Step 4: Run full verification**

Run: `pnpm run test:unit`
Expected: PASS.

Run: `pnpm run lint`
Expected: PASS (or only pre-existing warnings).

**Step 5: Commit**

```bash
git add src/features/settings/SettingsCenterDrawer.tsx src/features/settings/useSettingsAutosave.test.ts
git rm src/components/common/CategorySelectField.tsx src/components/common/CategorySelectField.test.tsx
git commit -m "chore(settings): 清理废弃RSS配置遗留代码"
```

## 3. 执行顺序建议

1. Task 1-3（模型与存储）
2. Task 4-5（设置 UI 与测试）
3. Task 6-7（Feed 侧联动）
4. Task 8（清理与全量验证）

## 4. 验收检查清单

1. 设置中心无 RSS 源 CRUD UI。
2. 设置中心分类模块支持增删改查，且重名校验生效。
3. `AddFeedDialog` 分类来源为分类主数据，提交使用 `categoryId`。
4. `FeedList` 按 `categoryId` 分组显示，失效/空值归“未分类”。
5. 删除分类后，关联 feed 自动归未分类。
6. `pnpm run test:unit` 与 `pnpm run lint` 通过。

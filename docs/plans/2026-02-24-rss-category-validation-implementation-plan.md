# RSS Category + Link Validation Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 重构 RSS 添加与设置管理流程：统一 `folder -> category`，并在前端 mock 链接验证通过前禁止保存。

**Architecture:** 以 `validateRssUrl` 前端 mock 服务作为唯一验证入口；`AddFeedDialog` 与 `RssSourcesSettingsPanel` 共用该服务。通过 `settingsStore` 的 session 验证状态和 `validateSettingsDraft` 门禁实现“未验证不可保存”，并将左侧分组改为按 `category` 动态聚合。

**Tech Stack:** Next.js App Router、React 19、TypeScript、Zustand、Vitest、Testing Library

---

## 0. 约束与先决条件

1. 本计划只实现前端逻辑和 UI；不新增真实后端接口。
2. 保留现有设置抽屉关键语义：`settings-center-modal`、`settings-center-overlay`、既有 `aria-label`。
3. 每个任务遵循 Red-Green-Refactor，并单独提交。
4. 执行时请使用 [$workflow-test-driven-development](/Users/bryanhu/Develop/workflow/skills/workflow-test-driven-development/SKILL.md) 与 [$workflow-verification-before-completion](/Users/bryanhu/Develop/workflow/skills/workflow-verification-before-completion/SKILL.md)。

## 1. Prior Art Scan（快速）

- 扫描范围：`docs/solutions/`（project first）
- 命令：`ls -la docs/solutions`
- 结果：当前仓库无可复用 solution 索引，计划不复用历史 solution 文档。

## 2. 风险与防错清单

1. `url` 修改后必须立即失效验证状态，否则会出现“旧验证误通过新 URL”。
2. 设置中心是 autosave 模式，验证失败必须通过 `validationErrors` 阻断保存，不能仅靠按钮禁用。
3. 删除 RSS source 行时需同步清理验证状态 map，避免脏状态干扰新行。
4. 当前仓库存在 `src/components/*` 与 `src/features/*` 双路径历史文件，执行时仅变更运行时主路径，必要时补齐兼容修改。
5. `folder -> category` 迁移必须兼容旧 localStorage 数据。

### Task 1: Build Mock RSS Validation Service

**Files:**

- Create: `src/features/feeds/services/rssValidationService.ts`
- Test: `src/features/feeds/services/rssValidationService.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { validateRssUrl } from './rssValidationService';

describe('validateRssUrl', () => {
  it('returns ok=true for success urls', async () => {
    const result = await validateRssUrl('https://example.com/success.xml');
    expect(result.ok).toBe(true);
    expect(result.kind).toBe('rss');
  });

  it('maps 401/403/timeout/not-feed to deterministic error codes', async () => {
    await expect(validateRssUrl('https://example.com/401.xml')).resolves.toMatchObject({ ok: false, errorCode: 'unauthorized' });
    await expect(validateRssUrl('https://example.com/403.xml')).resolves.toMatchObject({ ok: false, errorCode: 'unauthorized' });
    await expect(validateRssUrl('https://example.com/timeout.xml')).resolves.toMatchObject({ ok: false, errorCode: 'timeout' });
    await expect(validateRssUrl('https://example.com/invalid.xml')).resolves.toMatchObject({ ok: false, errorCode: 'not_feed' });
  });

  it('rejects invalid protocol', async () => {
    const result = await validateRssUrl('ftp://example.com/feed.xml');
    expect(result).toMatchObject({ ok: false, errorCode: 'invalid_url' });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/feeds/services/rssValidationService.test.ts`
Expected: FAIL with module/function missing errors.

**Step 3: Write minimal implementation**

```ts
export type RssValidationErrorCode = 'invalid_url' | 'unauthorized' | 'timeout' | 'not_feed' | 'network_error';

export interface RssValidationResult {
  ok: boolean;
  kind?: 'rss' | 'atom';
  title?: string;
  errorCode?: RssValidationErrorCode;
  message?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function validateRssUrl(url: string): Promise<RssValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, errorCode: 'invalid_url', message: 'URL is invalid.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, errorCode: 'invalid_url', message: 'URL must use http or https.' };
  }

  await delay(350);

  const normalized = url.toLowerCase();
  if (normalized.includes('401') || normalized.includes('403')) {
    return { ok: false, errorCode: 'unauthorized', message: 'Source requires authorization.' };
  }
  if (normalized.includes('timeout')) {
    return { ok: false, errorCode: 'timeout', message: 'Validation timed out.' };
  }
  if (normalized.includes('network')) {
    return { ok: false, errorCode: 'network_error', message: 'Network error.' };
  }
  if (normalized.includes('success') || normalized.includes('rss') || normalized.includes('atom')) {
    return { ok: true, kind: normalized.includes('atom') ? 'atom' : 'rss', title: 'Mock Feed' };
  }

  return { ok: false, errorCode: 'not_feed', message: 'Response is not a valid RSS/Atom feed.' };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/features/feeds/services/rssValidationService.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/feeds/services/rssValidationService.ts src/features/feeds/services/rssValidationService.test.ts
git commit -m "feat(feeds): 新增RSS链接前端mock验证服务"
```

### Task 2: Migrate Types and Schema from folder to category (with backward compatibility)

**Files:**

- Modify: `src/types/index.ts`
- Modify: `src/features/settings/settingsSchema.ts`
- Modify: `src/features/settings/settingsSchema.test.ts`
- Modify: `src/features/settings/validateSettingsDraft.test.ts`

**Step 1: Write the failing test**

```ts
it('maps legacy rss source folder to category', () => {
  const normalized = normalizePersistedSettings({
    rss: {
      sources: [{ id: '1', name: 'Tech', url: 'https://example.com/rss.xml', folder: '科技', enabled: true }],
    },
  });

  expect(normalized.rss.sources[0].category).toBe('科技');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/settings/settingsSchema.test.ts`
Expected: FAIL with `category` not found.

**Step 3: Write minimal implementation**

```ts
// src/types/index.ts
export interface Feed {
  id: string;
  title: string;
  url: string;
  icon?: string;
  unreadCount: number;
  category?: string | null;
}

export interface RssSourceSetting {
  id: string;
  name: string;
  url: string;
  category: string | null;
  enabled: boolean;
}

// src/features/settings/settingsSchema.ts
const legacyFolder = typeof source.folder === 'string' ? source.folder : null;
const category = typeof source.category === 'string' ? source.category : legacyFolder;
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit -- src/features/settings/settingsSchema.test.ts src/features/settings/validateSettingsDraft.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/types/index.ts src/features/settings/settingsSchema.ts src/features/settings/settingsSchema.test.ts src/features/settings/validateSettingsDraft.test.ts
git commit -m "refactor(settings): 将RSS分组字段统一为category"
```

### Task 3: Add Session-Level RSS Verification State + Save Gate Validation

**Files:**

- Modify: `src/store/settingsStore.ts`
- Modify: `src/features/settings/validateSettingsDraft.ts`
- Modify: `src/features/settings/validateSettingsDraft.test.ts`

**Step 1: Write the failing test**

```ts
it('rejects rss url when source is not verified', () => {
  const draft: SettingsDraft = {
    persisted: {
      ...structuredClone(defaultPersistedSettings),
      rss: {
        sources: [{ id: '1', name: 'A', url: 'https://example.com/success.xml', category: null, enabled: true }],
      },
    },
    session: { ai: { apiKey: '' }, rssValidation: {} },
  };

  const result = validateSettingsDraft(draft);
  expect(result.valid).toBe(false);
  expect(result.errors['rss.sources.0.url']).toContain('validate');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/settings/validateSettingsDraft.test.ts`
Expected: FAIL because draft/session model has no `rssValidation` gating.

**Step 3: Write minimal implementation**

```ts
// src/store/settingsStore.ts
interface SessionSettings {
  ai: { apiKey: string };
  rssValidation: Record<string, { status: 'idle' | 'validating' | 'verified' | 'failed'; verifiedUrl: string | null }>;
}

// src/features/settings/validateSettingsDraft.ts
const status = draft.session?.rssValidation?.[source.id];
if (!status || status.status !== 'verified' || status.verifiedUrl !== url) {
  errors[urlKey] = 'Please validate this URL before saving.';
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit -- src/features/settings/validateSettingsDraft.test.ts src/store/settingsStore.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/store/settingsStore.ts src/features/settings/validateSettingsDraft.ts src/features/settings/validateSettingsDraft.test.ts src/store/settingsStore.test.ts
git commit -m "feat(settings): 增加RSS链接验证状态并接入保存门禁"
```

### Task 4: Build Reusable Category Dropdown with Manual Create

**Files:**

- Create: `src/components/common/CategorySelectField.tsx`
- Test: `src/components/common/CategorySelectField.test.tsx`

**Step 1: Write the failing test**

```tsx
it('supports selecting existing category, creating new category, and clearing', () => {
  // render CategorySelectField with options ['科技', '设计']
  // select '科技' => onChange('科技')
  // select '__create__', input '安全', confirm => onChange('安全')
  // select empty => onChange(null)
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/components/common/CategorySelectField.test.tsx`
Expected: FAIL with file/component missing.

**Step 3: Write minimal implementation**

```tsx
export default function CategorySelectField(props: {
  id: string;
  label: string;
  value: string | null;
  options: string[];
  onChange: (value: string | null) => void;
}) {
  // select: "", existing options, "__create__"
  // when "__create__" selected, show input + confirm button
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/components/common/CategorySelectField.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/common/CategorySelectField.tsx src/components/common/CategorySelectField.test.tsx
git commit -m "feat(ui): 新增可新建分类下拉控件"
```

### Task 5: Refactor AddFeedDialog to enforce validation-before-save

**Files:**

- Modify: `src/features/feeds/AddFeedDialog.tsx`
- Modify: `src/features/feeds/AddFeedDialog.test.tsx`
- Modify: `src/features/feeds/FeedList.tsx`

**Step 1: Write the failing test**

```tsx
it('requires successful validation before save', async () => {
  // fill name + url
  // click 保存 => disabled
  // click 验证链接 (mock success)
  // expect 保存 enabled
  // change URL => expect 保存 disabled again
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx`
Expected: FAIL because current dialog has no verify flow.

**Step 3: Write minimal implementation**

```tsx
const [validationState, setValidationState] = useState<'idle' | 'validating' | 'verified' | 'failed'>('idle');
const [lastVerifiedUrl, setLastVerifiedUrl] = useState<string | null>(null);

const canSave = !!name.trim() && !!url.trim() && validationState === 'verified' && lastVerifiedUrl === url.trim();

async function handleValidate() {
  setValidationState('validating');
  const result = await validateRssUrl(url.trim());
  if (result.ok) {
    setValidationState('verified');
    setLastVerifiedUrl(url.trim());
  } else {
    setValidationState('failed');
    setLastVerifiedUrl(null);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/feeds/AddFeedDialog.tsx src/features/feeds/AddFeedDialog.test.tsx src/features/feeds/FeedList.tsx
git commit -m "feat(feeds): 添加源弹窗接入验证后保存门禁"
```

### Task 6: Replace sidebar grouping model from folders to categories

**Files:**

- Modify: `src/mock/data.ts`
- Modify: `src/data/provider/readerDataProvider.ts`
- Modify: `src/data/mock/mockProvider.ts`
- Modify: `src/store/appStore.ts`
- Modify: `src/features/feeds/FeedList.tsx`
- Test: `src/features/reader/ReaderLayout.test.tsx`

**Step 1: Write the failing test**

```tsx
it('groups feeds by category with uncategorized fallback', () => {
  render(<ReaderLayout />);
  expect(screen.getByText('科技')).toBeInTheDocument();
  expect(screen.getByText('未分类')).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/reader/ReaderLayout.test.tsx`
Expected: FAIL because list is folder-driven.

**Step 3: Write minimal implementation**

```ts
// src/mock/data.ts: feed entries use category instead of folderId
{ id: 'feed-1', title: 'Hacker News', category: '科技', ... }

// src/features/feeds/FeedList.tsx
const categories = groupBy(feeds, (feed) => feed.category?.trim() || '未分类');
// render categories with local expanded state map
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit -- src/features/reader/ReaderLayout.test.tsx src/store/appStore.test.ts src/data/provider/readerDataProvider.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/mock/data.ts src/data/provider/readerDataProvider.ts src/data/mock/mockProvider.ts src/store/appStore.ts src/features/feeds/FeedList.tsx src/features/reader/ReaderLayout.test.tsx
git commit -m "refactor(reader): 侧栏订阅分组切换为category模型"
```

### Task 7: Refactor RSS Settings Panel with row-level validation and category dropdown

**Files:**

- Modify: `src/features/settings/panels/RssSourcesSettingsPanel.tsx`
- Modify: `src/features/settings/SettingsCenterModal.test.tsx`
- Modify: `src/features/settings/SettingsCenterDrawer.tsx` (if section status text/guard logic needs sync)

**Step 1: Write the failing test**

```tsx
it('blocks autosave until rss row is verified and stores category', async () => {
  // open settings -> rss tab
  // add row, fill name/url/category
  // without verify => expect validationErrors['rss.sources.0.url'] exists
  // click 验证链接 (mock success)
  // expect persistedSettings.rss.sources[0].category === 'Tech'
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx`
Expected: FAIL because panel has no verify button and no category field.

**Step 3: Write minimal implementation**

```tsx
// each row adds validate button and per-row status badge
<button type="button" onClick={() => handleValidateSource(index)}>
  {status === 'validating' ? '验证中...' : '验证链接'}
</button>

// URL/category change resets row validation
nextDraft.session.rssValidation[source.id] = { status: 'idle', verifiedUrl: null };
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx src/features/settings/validateSettingsDraft.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/settings/panels/RssSourcesSettingsPanel.tsx src/features/settings/SettingsCenterModal.test.tsx src/features/settings/SettingsCenterDrawer.tsx src/features/settings/validateSettingsDraft.test.ts
git commit -m "feat(settings): RSS面板接入逐行验证与分类下拉"
```

### Task 8: Full Verification and Documentation Sync

**Files:**

- Modify: `README.md` (RSS capability wording from folder to category)

**Step 1: Write/adjust documentation assertion first**

```md
- `rss`：RSS 源新增 / 编辑 / 删除 / 启停 / 链接验证 / 分类管理
```

**Step 2: Run lint + unit tests**

Run: `pnpm run lint`
Expected: PASS with no new lint errors.

Run: `pnpm run test:unit`
Expected: PASS for full suite.

**Step 3: Run focused grep verification**

Run: `rg -n "folderId|rss\.sources\..*\.folder|\bfolder\b" src`
Expected: only legacy intentional references (if any) with explicit comments; no active runtime path uses old rss `folder` field.

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): 更新RSS分类与链接验证能力说明"
```

## 3. Final Acceptance Checklist

1. AddFeedDialog：必须验证通过后才能保存。
2. Settings RSS：每行 URL 必须验证通过，autosave 才能成功。
3. URL 修改后必须重验。
4. 所有 `rss source` 字段使用 `category`，并兼容历史 `folder` 持久化数据。
5. 左侧订阅按分类动态分组，未分类分组可见。
6. `pnpm run lint` 与 `pnpm run test:unit` 全量通过。


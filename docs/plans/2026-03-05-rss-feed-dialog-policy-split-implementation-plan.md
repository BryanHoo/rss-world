# RSS 源弹窗拆分与策略配置 Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 将 RSS 源新增/编辑主弹窗精简为 URL/名称/分类，并把 AI 摘要与翻译触发策略拆到右键独立弹窗配置。

**Architecture:** 维持现有 `FeedDialog` 作为基础信息弹窗，只负责 feed 基础字段保存；在 `FeedList` 右键菜单新增两个策略入口，分别打开摘要策略与翻译策略弹窗，弹窗保存时只 patch 对应策略字段。通过前端初始化映射处理历史 `bodyTranslateEnabled` 到 `bodyTranslateOnOpenEnabled`，避免旧字段长期回流。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Zustand, shadcn/ui (Radix), Vitest, Testing Library

---

## Relevant Prior Learnings

- `docs/summaries/2026-03-05-ai-summary-translation-trigger-strategy-refactor.md`
- `docs/summaries/2026-03-05-translation-preserve-html-structure.md`
- `docs/summaries/2026-03-04-async-tasks-refactor.md`

## Execution Rules

- 执行时使用 @workflow-test-driven-development：先写失败测试，再实现最小改动。
- UI 相关 Task（Task 1/3/4）必须应用 @frontend-design：聚焦信息分层、可读性、交互效率，不做无关视觉重构。
- 每个 Task 完成后立即小步提交。
- 最终执行 @workflow-verification-before-completion：仅在有命令输出证据时声明完成。

---

### Task 1: 引入 shadcn `Switch` 组件并补齐 UI 基础能力

**Files:**

- Modify: `package.json`
- Create: `src/components/ui/switch.tsx`
- Modify: `src/components/ui/ui-smoke.test.tsx`
- Test: `src/components/ui/ui-smoke.test.tsx`

**Step 1: Write the failing test**

```tsx
import { Switch } from './switch';

it('renders Switch and can be toggled', () => {
  render(<Switch aria-label="test-switch" checked={false} onCheckedChange={() => {}} />);
  expect(screen.getByRole('switch', { name: 'test-switch' })).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/components/ui/ui-smoke.test.tsx -t "Switch"`  
Expected: FAIL（`./switch` 不存在）

**Step 3: Write minimal implementation**

```tsx
import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

const Switch = React.forwardRef(...);
export { Switch };
```

并在 `package.json` 添加 `@radix-ui/react-switch` 依赖。

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/components/ui/ui-smoke.test.tsx -t "Switch"`  
Expected: PASS

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/ui/switch.tsx src/components/ui/ui-smoke.test.tsx
git commit -m "feat(ui): 新增shadcn开关组件"
```

---

### Task 2: 精简主弹窗字段为 URL/名称/分类并保持验证链路

**Files:**

- Modify: `src/features/feeds/FeedDialog.tsx`
- Modify: `src/features/feeds/AddFeedDialog.tsx`
- Modify: `src/features/feeds/EditFeedDialog.tsx`
- Modify: `src/features/feeds/AddFeedDialog.test.tsx`
- Test: `src/features/feeds/AddFeedDialog.test.tsx`

**Step 1: Write the failing test**

```tsx
it('add dialog only shows URL 名称 分类 fields', () => {
  // assert URL / 名称 / 分类存在
  // assert 获取文章后自动获取摘要 等旧策略控件不存在
});

it('submit add feed payload excludes policy flags', async () => {
  // assert create payload only contains title/url/siteUrl/categoryId
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx -t "only shows|excludes policy"`  
Expected: FAIL（当前主弹窗仍包含策略字段并提交策略 payload）

**Step 3: Write minimal implementation**

```tsx
export interface FeedDialogSubmitPayload {
  title: string;
  url: string;
  siteUrl: string | null;
  categoryId: string | null;
}

// remove policy state/select controls, keep validateRssUrl + title auto-fill
```

`AddFeedDialog/EditFeedDialog` 对应改为只传递基础字段。

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/feeds/FeedDialog.tsx src/features/feeds/AddFeedDialog.tsx src/features/feeds/EditFeedDialog.tsx src/features/feeds/AddFeedDialog.test.tsx
git commit -m "refactor(feed-dialog): 精简新增编辑字段并保留URL验证"
```

---

### Task 3: 新增 `AI摘要配置` 与 `翻译配置` 弹窗组件（含迁移初始化）

**Files:**

- Create: `src/features/feeds/FeedSummaryPolicyDialog.tsx`
- Create: `src/features/feeds/FeedTranslationPolicyDialog.tsx`
- Create: `src/features/feeds/FeedPolicyDialogs.test.tsx`
- Test: `src/features/feeds/FeedPolicyDialogs.test.tsx`

**Step 1: Write the failing test**

```tsx
it('summary policy dialog saves aiSummaryOnFetchEnabled and aiSummaryOnOpenEnabled', async () => {
  // toggle 2 switches and assert onSubmit patch fields
});

it('translation policy dialog saves 3 translation switches', async () => {
  // assert titleTranslateEnabled/bodyTranslateOnFetchEnabled/bodyTranslateOnOpenEnabled
});

it('maps legacy bodyTranslateEnabled into bodyTranslateOnOpenEnabled on initial render', () => {
  // bodyTranslateEnabled=true + bodyTranslateOnOpenEnabled=false -> initial switch true
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/feeds/FeedPolicyDialogs.test.tsx`  
Expected: FAIL（新组件尚未创建）

**Step 3: Write minimal implementation**

```tsx
// FeedSummaryPolicyDialog: 2 switches + save button
onSubmit({ aiSummaryOnFetchEnabled, aiSummaryOnOpenEnabled });
```

```tsx
// FeedTranslationPolicyDialog: 3 switches + legacy migration mapping
const initialBodyOnOpen = feed.bodyTranslateOnOpenEnabled || (!feed.bodyTranslateOnOpenEnabled && feed.bodyTranslateEnabled);
onSubmit({ titleTranslateEnabled, bodyTranslateOnFetchEnabled, bodyTranslateOnOpenEnabled });
```

弹窗说明文案明确“仅保存自动触发策略，不会立即执行”。

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/features/feeds/FeedPolicyDialogs.test.tsx`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/feeds/FeedSummaryPolicyDialog.tsx src/features/feeds/FeedTranslationPolicyDialog.tsx src/features/feeds/FeedPolicyDialogs.test.tsx
git commit -m "feat(feed-policy): 新增摘要与翻译策略配置弹窗"
```

---

### Task 4: 在 `FeedList` 右键菜单接入策略入口与弹窗状态管理

**Files:**

- Modify: `src/features/feeds/FeedList.tsx`
- Modify: `src/features/feeds/FeedList.test.tsx`
- Test: `src/features/feeds/FeedList.test.tsx`

**Step 1: Write the failing test**

```tsx
it('shows AI摘要配置 and 翻译配置 in feed context menu', async () => {
  // assert two menuitems present
});

it('opens summary policy dialog from context menu and saves patch', async () => {
  // click menuitem -> dialog open -> save -> assert PATCH body fields
});

it('opens translation policy dialog from context menu and saves patch', async () => {
  // same for translation
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/feeds/FeedList.test.tsx -t "AI摘要配置|翻译配置|policy dialog"`  
Expected: FAIL（菜单项和弹窗未接入）

**Step 3: Write minimal implementation**

```tsx
<ContextMenuItem onSelect={() => setSummaryPolicyFeedId(feed.id)}>AI摘要配置</ContextMenuItem>
<ContextMenuItem onSelect={() => setTranslationPolicyFeedId(feed.id)}>翻译配置</ContextMenuItem>
```

```tsx
<FeedSummaryPolicyDialog
  open={Boolean(summaryPolicyFeed)}
  feed={summaryPolicyFeed}
  onSubmit={(patch) => updateFeed(summaryPolicyFeed.id, patch)}
/>
```

```tsx
<FeedTranslationPolicyDialog
  open={Boolean(translationPolicyFeed)}
  feed={translationPolicyFeed}
  onSubmit={(patch) => updateFeed(translationPolicyFeed.id, patch)}
/>
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/features/feeds/FeedList.test.tsx`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/feeds/FeedList.tsx src/features/feeds/FeedList.test.tsx
git commit -m "feat(feed-list): 右键新增摘要翻译策略配置入口"
```

---

### Task 5: 清理旧策略测试与类型约束，防止回写旧字段

**Files:**

- Modify: `src/features/feeds/FeedDialog.translationFlags.test.tsx`
- Modify: `src/lib/apiClient.ts`
- Modify: `src/store/appStore.ts`
- Modify: `src/store/appStore.test.ts`
- Test: `src/features/feeds/FeedDialog.translationFlags.test.tsx`
- Test: `src/store/appStore.test.ts`

**Step 1: Write the failing test**

```tsx
it('FeedDialog no longer renders policy controls', () => {
  // assert old policy comboboxes are absent
});
```

```ts
it('base feed update does not require policy flags in patch payload', async () => {
  // assert update path accepts partial base fields only
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/feeds/FeedDialog.translationFlags.test.tsx src/store/appStore.test.ts -t "no longer|partial"`  
Expected: FAIL（旧测试仍依赖主弹窗策略控件）

**Step 3: Write minimal implementation**

- 将 `FeedDialog.translationFlags.test.tsx` 改为“主弹窗不再出现策略控件”回归测试。
- 确认 `updateFeed` patch 类型继续允许 partial，不强制传入策略字段。
- 确认 `apiClient.patchFeed` 不注入未提供字段。

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/features/feeds/FeedDialog.translationFlags.test.tsx src/store/appStore.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/feeds/FeedDialog.translationFlags.test.tsx src/lib/apiClient.ts src/store/appStore.ts src/store/appStore.test.ts
git commit -m "test(feed): 更新主弹窗与策略字段回归约束"
```

---

### Task 6: 全量回归、lint 与总结文档

**Files:**

- Create: `docs/summaries/2026-03-05-rss-feed-dialog-policy-split.md`
- Test: `src/features/feeds/AddFeedDialog.test.tsx`
- Test: `src/features/feeds/FeedList.test.tsx`
- Test: `src/features/feeds/FeedPolicyDialogs.test.tsx`
- Test: `src/features/feeds/FeedDialog.translationFlags.test.tsx`

**Step 1: Run focused unit tests**

Run: `pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx src/features/feeds/FeedList.test.tsx src/features/feeds/FeedPolicyDialogs.test.tsx src/features/feeds/FeedDialog.translationFlags.test.tsx src/store/appStore.test.ts`
Expected: PASS

**Step 2: Run lint**

Run: `pnpm run lint`
Expected: PASS

**Step 3: Write summary doc**

```md
# RSS 源弹窗拆分与策略配置总结
- 症状
- 根因
- 修复
- 验证命令与结果
- 后续建议
```

**Step 4: Commit docs and any remaining fixes**

```bash
git add docs/summaries/2026-03-05-rss-feed-dialog-policy-split.md
git commit -m "docs(summary): 记录RSS源弹窗拆分与策略配置改造"
```

**Step 5: Final verification snapshot**

Run: `git status --short`  
Expected: clean worktree

---

## Notes For Implementer

- 不要在策略弹窗中触发 `enqueueArticleAiSummary` / `enqueueArticleAiTranslate`，仅调用 `updateFeed`。
- `bodyTranslateEnabled` 仅作为迁移输入，提交 patch 时不要回写该字段。
- 若 `pnpm-lock.yaml` 未变化但 `package.json` 新增依赖，必须执行一次 `pnpm install` 后再提交。

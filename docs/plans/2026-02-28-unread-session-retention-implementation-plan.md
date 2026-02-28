# Unread Session Retention Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 让中栏在“仅显示未读”语义下保留“当前会话已显示文章”，这些文章即使变已读也不立即消失；在下一次刷新边界（`loadSnapshot`、`selectedView`、`showUnreadOnly`）后再按未读规则收敛。

**Architecture:** 仅在 `ArticleList` 引入会话级可见集合（`Set<string>`）并调整过滤流程，不修改后端与 `appStore` 数据模型。过滤逻辑拆成“视图范围过滤”与“未读语义过滤（含会话保留）”两段。刷新边界通过 `selectedView`、`showUnreadOnly` 和 `snapshotLoading` 过渡（`true -> false`）触发集合重建。

**Tech Stack:** React 19, Zustand, TypeScript, Vitest, Testing Library

---

## Inputs Collected (Sequential)

### 1) Prior Art Scan

- `docs/solutions`（项目）不存在
- `~/.agents/docs/solutions`（全局）不存在
- 本次不复用 solution 文档，采用当前设计文档与现有源码

参考输入：

- 设计文档：`docs/plans/2026-02-28-unread-session-retention-design.md`
- 调用链入口：
  - `src/app/(reader)/ReaderApp.tsx`
  - `src/features/reader/ReaderLayout.tsx`
  - `src/features/articles/ArticleList.tsx`
  - `src/features/articles/ArticleView.tsx`
  - `src/store/appStore.ts`

### 2) Entry Points + Call Chain

1. `ReaderApp` 在 `selectedView` 变化时触发 `loadSnapshot`，并重置 `showUnreadOnly` 默认值。
2. `ReaderLayout` 以 `key={selectedView}` 挂载 `ArticleList`，视图切换会重建中栏组件实例。
3. `ArticleView` 自动阅读效果调用 `markAsRead`。
4. `appStore.markAsRead` 立即更新本地 `articles[].isRead`（optimistic），导致中栏即时重渲染。
5. `ArticleList` 当前仅保留“选中文章”而非“当前会话已显示文章”。

### 3) Existing Verify Commands

- 目标测试：`pnpm vitest run src/features/articles/ArticleList.test.tsx`
- 全量单测：`pnpm test:unit`

---

## Risks / Pitfalls (Must Guard)

1. 不要把“任意 `articles` 变化”都当作刷新边界，否则 `markAsRead` 会误清空会话集合，导致条目再次瞬时消失。
2. `unread` 视图要按“未读语义过滤 + 会话保留”处理，不能继续把 `selectedArticleId` 当成唯一保留条件。
3. `showUnreadOnly` 关闭时集合应失效（至少不参与过滤），重新开启后应按新会话重建。
4. 测试中如果直接渲染 `ArticleList`，不要依赖 `ReaderLayout` 的 `key` 重挂载副作用，要显式验证边界行为。
5. 保持改动最小：不新增 `appStore` 字段，不改 API 层。

---

### Task 1: 用 TDD 固化“会话内已显示文章不消失”行为

**Files:**

- Modify: `src/features/articles/ArticleList.test.tsx`
- Test: `src/features/articles/ArticleList.test.tsx`

**Step 1: Write the failing test**

在现有测试后新增两个 `it`，覆盖：

1. `selectedView='unread'` 下，已显示的两篇文章都变已读后仍可见。
2. `selectedView='all' + showUnreadOnly=true` 下，非选中但已显示的文章变已读后仍可见。

```tsx
it('retains all currently visible articles in unread view after marking them read', () => {
  useAppStore.setState({
    selectedView: 'unread',
    showUnreadOnly: false,
    selectedArticleId: 'art-1',
  });

  render(<ArticleList />);

  act(() => {
    useAppStore.getState().markAsRead('art-1');
    useAppStore.getState().markAsRead('art-2');
  });

  expect(screen.getByText('Selected Article')).toBeInTheDocument();
  expect(screen.getByText('Other Article')).toBeInTheDocument();
});

it('retains a non-selected article that was already visible in unread-only mode', () => {
  useAppStore.setState({
    selectedView: 'all',
    showUnreadOnly: true,
    selectedArticleId: 'art-1',
  });

  render(<ArticleList />);

  act(() => {
    useAppStore.getState().markAsRead('art-2');
  });

  expect(screen.getByText('Other Article')).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/articles/ArticleList.test.tsx`  
Expected: FAIL（`Other Article` 在变已读后无法找到）

**Step 3: Write minimal implementation**

先实现“会话保留核心过滤”，不处理刷新边界：

```tsx
import { useMemo, useRef } from "react";

const showUnreadFilterActive =
  selectedView === "unread" || (showUnreadOnly && showHeaderActions);

const sessionVisibleArticleIdsRef = useRef<Set<string>>(new Set());

const viewScopedArticles = useMemo(() => {
  if (selectedView === "all") return articles;
  if (selectedView === "unread") return articles;
  if (selectedView === "starred") return articles.filter((article) => article.isStarred);
  return articles.filter((article) => article.feedId === selectedView);
}, [articles, selectedView]);

const filteredArticles = useMemo(() => {
  if (!showUnreadFilterActive) return viewScopedArticles;

  const retained = sessionVisibleArticleIdsRef.current;
  const visible = viewScopedArticles.filter(
    (article) => !article.isRead || retained.has(article.id),
  );

  visible.forEach((article) => retained.add(article.id));
  return visible;
}, [viewScopedArticles, showUnreadFilterActive]);
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/articles/ArticleList.test.tsx`  
Expected: PASS（本任务新增的 2 条测试通过）

**Step 5: Commit**

```bash
git add src/features/articles/ArticleList.tsx src/features/articles/ArticleList.test.tsx
git commit -m "feat(reader): 实现未读会话可见文章保留"
```

---

### Task 2: 用 TDD 实现刷新边界重建（selectedView/showUnreadOnly/loadSnapshot）

**Files:**

- Modify: `src/features/articles/ArticleList.test.tsx`
- Modify: `src/features/articles/ArticleList.tsx`
- Test: `src/features/articles/ArticleList.test.tsx`

**Step 1: Write the failing test**

新增三条测试，覆盖三类刷新边界：

1. 切换 `selectedView` 后，旧会话已读保留项消失。
2. 关闭再开启 `showUnreadOnly` 后，旧会话已读保留项消失。
3. `snapshotLoading` 从 `true -> false` 后，旧会话已读保留项消失。

```tsx
it('drops retained read items after selectedView changes', () => {
  useAppStore.setState({ selectedView: 'all', showUnreadOnly: true });
  render(<ArticleList />);

  act(() => {
    useAppStore.getState().markAsRead('art-1');
    useAppStore.getState().markAsRead('art-2');
  });
  expect(screen.getByText('Selected Article')).toBeInTheDocument();
  expect(screen.getByText('Other Article')).toBeInTheDocument();

  act(() => {
    useAppStore.setState({ selectedView: 'unread', showUnreadOnly: false });
    useAppStore.setState({ selectedView: 'all', showUnreadOnly: true });
  });

  expect(screen.queryByText('Selected Article')).not.toBeInTheDocument();
  expect(screen.queryByText('Other Article')).not.toBeInTheDocument();
});

it('drops retained read items after unread-only toggle off and on', () => {
  useAppStore.setState({ selectedView: 'all', showUnreadOnly: true });
  render(<ArticleList />);

  act(() => {
    useAppStore.getState().markAsRead('art-1');
    useAppStore.getState().markAsRead('art-2');
    useAppStore.setState({ showUnreadOnly: false });
    useAppStore.setState({ showUnreadOnly: true });
  });

  expect(screen.queryByText('Selected Article')).not.toBeInTheDocument();
  expect(screen.queryByText('Other Article')).not.toBeInTheDocument();
});

it('drops retained read items when snapshot loading completes', () => {
  useAppStore.setState({ selectedView: 'all', showUnreadOnly: true });
  render(<ArticleList />);

  act(() => {
    useAppStore.getState().markAsRead('art-1');
    useAppStore.getState().markAsRead('art-2');
    useAppStore.setState({ snapshotLoading: true });
    useAppStore.setState({ snapshotLoading: false });
  });

  expect(screen.queryByText('Selected Article')).not.toBeInTheDocument();
  expect(screen.queryByText('Other Article')).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/articles/ArticleList.test.tsx`  
Expected: FAIL（边界后条目仍残留）

**Step 3: Write minimal implementation**

在 `ArticleList` 增加会话重建逻辑：

```tsx
import { useEffect, useMemo, useRef } from "react";

const snapshotLoading = useAppStore((state) => state.snapshotLoading);
const previousSnapshotLoadingRef = useRef(snapshotLoading);

useEffect(() => {
  sessionVisibleArticleIdsRef.current.clear();
}, [selectedView, showUnreadOnly]);

useEffect(() => {
  const previous = previousSnapshotLoadingRef.current;
  if (previous && !snapshotLoading) {
    sessionVisibleArticleIdsRef.current.clear();
  }
  previousSnapshotLoadingRef.current = snapshotLoading;
}, [snapshotLoading]);

useEffect(() => {
  if (!showUnreadFilterActive) {
    sessionVisibleArticleIdsRef.current.clear();
  }
}, [showUnreadFilterActive]);
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/articles/ArticleList.test.tsx`  
Expected: PASS（含新增边界测试）

**Step 5: Commit**

```bash
git add src/features/articles/ArticleList.tsx src/features/articles/ArticleList.test.tsx
git commit -m "tests(reader): 补齐未读会话边界重建用例"
```

---

### Task 3: 回归验证与交付检查

**Files:**

- Verify: `src/features/articles/ArticleList.tsx`
- Verify: `src/features/articles/ArticleList.test.tsx`
- Verify: `src/features/articles/ArticleView.tsx`
- Verify: `src/store/appStore.ts`

**Step 1: Run focused reader tests**

Run: `pnpm vitest run src/features/articles/ArticleList.test.tsx`  
Expected: PASS（所有 ArticleList 用例通过）

**Step 2: Run broader unit tests**

Run: `pnpm test:unit`  
Expected: PASS（如失败，记录受影响测试并回滚最小改动修复）

**Step 3: Manual behavior checklist**

1. `unread` 视图阅读当前列表文章后不瞬时消失。
2. `all/feed + showUnreadOnly` 下阅读当前列表文章后不瞬时消失。
3. 切换 `selectedView`、切换“仅显示未读”、触发一次快照加载后，旧会话已读项不再保留。

**Step 4: Run lint (optional if unit pass is slow)**

Run: `pnpm lint`  
Expected: PASS（若出现历史 lint 噪音，记录并最小化处理）

**Step 5: Commit**

若 Task 2 后无新增改动，可跳过；若有补丁：

```bash
git add src/features/articles/ArticleList.tsx src/features/articles/ArticleList.test.tsx
git commit -m "fix(reader): 校准未读会话保留与刷新边界行为"
```

---

## Skills / References

- `workflow-test-driven-development`：`/Users/bryanhu/Develop/workflow/skills/workflow-test-driven-development/SKILL.md`
- `workflow-verification-before-completion`：`/Users/bryanhu/Develop/workflow/skills/workflow-verification-before-completion/SKILL.md`
- 设计输入：`/Users/bryanhu/Develop/feedfuse/docs/plans/2026-02-28-unread-session-retention-design.md`


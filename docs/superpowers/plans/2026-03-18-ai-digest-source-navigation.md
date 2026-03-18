# AI 解读来源底部展示与导航历史 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI 解读来源模块移动到正文末尾，并按左栏/中栏/来源跳转语义区分 URL history 写入方式，使浏览器返回可恢复阅读上下文。

**Architecture:** 保持现有 `view/article` URL 参数与 Zustand store 同步模型，不引入新路由层。`setSelectedView` 默认走 `replace`，`setSelectedArticle`（非空）默认走 `push`，并新增 `none` 模式用于初始化恢复与 `popstate` 恢复，避免恢复流程反向污染历史栈。右栏来源跳转继续沿用 `setSelectedView -> loadSnapshot -> setSelectedArticle`，仅调整最终 history 语义和来源模块在 DOM 中的位置。

**Tech Stack:** Next.js 16 + React 19 + TypeScript + Zustand + Vitest + Testing Library

---

## Context Snapshot

- Approved spec: `docs/superpowers/specs/2026-03-18-ai-digest-source-navigation-design.md`
- Relevant existing implementation:
  - `src/store/appStore.ts`
  - `src/store/appStore.test.ts`
  - `src/features/articles/ArticleView.tsx`
  - `src/features/articles/ArticleView.aiDigestSources.test.tsx`
  - `src/features/feeds/FeedList.tsx`
  - `src/features/articles/ArticleList.tsx`
- Existing behavioral baseline:
  - URL 持久化由 `useAppStore.subscribe` 统一触发，当前固定 `replaceState`。
  - 左栏点击调用 `setSelectedView`，中栏点击调用 `setSelectedArticle`，右栏来源跳转在 `ArticleView` 中调用 `setSelectedView -> loadSnapshot -> setSelectedArticle`。
  - `ArticleView` 中来源模块当前位于 `data-testid="article-html-content"` 之前。
- Project constraints:
  - 不自动做浏览器测试。
  - 验证必须执行 `pnpm build`。
  - 使用 `pnpm` 作为 Node 包管理命令。

## Scope Check

该规格覆盖“来源模块位置”和“导航 history 语义”两个点，但两者都围绕同一条 AI 解读阅读流（来源跳转 + 浏览器返回）耦合验证，因此保持单计划实现；不再拆分子计划。

## File Structure Plan

Planned creates:
- 无新增文件（遵循最小改动，延续现有模块边界）。

Planned modifies:
- `src/store/appStore.ts` - 为 URL 同步引入 `replace/push/none` 模式，扩展 `setSelectedView`/`setSelectedArticle` 语义，补齐 `popstate` 恢复链路。
- `src/store/appStore.test.ts` - 新增 history 模式、去重写入、`popstate` 顺序恢复、初始化无 history 写入分支测试。
- `src/features/articles/ArticleView.tsx` - 将 AI 解读来源模块移动到正文 HTML 容器之后，并保留原交互。
- `src/features/articles/ArticleView.aiDigestSources.test.tsx` - 增加来源模块 DOM 顺序断言（位于正文容器之后）。

Skills reference for implementers:
- `@vitest`
- `@nodejs-best-practices`
- `@verification-before-completion`

## Chunk 1: URL History 模式语义（TDD）

### Task 1: 为 `setSelectedView`/`setSelectedArticle` 建立 history 模式契约

**Files:**
- Modify: `src/store/appStore.test.ts`
- Modify: `src/store/appStore.ts`

- [ ] **Step 1: 先写失败测试，锁定 replace/push/去重行为**

```ts
it('uses replaceState for selected view changes and pushState for article selection', async () => {
  const replaceSpy = vi.spyOn(window.history, 'replaceState');
  const pushSpy = vi.spyOn(window.history, 'pushState');

  useAppStore.getState().setSelectedView('feed-1');
  expect(replaceSpy).toHaveBeenCalled();
  expect(pushSpy).not.toHaveBeenCalled();

  replaceSpy.mockClear();
  pushSpy.mockClear();

  useAppStore.setState({
    articles: [
      {
        id: 'art-1',
        feedId: 'feed-1',
        title: 'A1',
        content: '<p>x</p>',
        summary: '',
        publishedAt: '2026-03-18T00:00:00.000Z',
        link: null,
        isRead: false,
        isStarred: false,
      },
    ],
  });
  useAppStore.getState().setSelectedArticle('art-1');

  expect(pushSpy).toHaveBeenCalled();
  expect(replaceSpy).not.toHaveBeenCalled();
});

it('skips history write when next URL is exactly the same', () => {
  const replaceSpy = vi.spyOn(window.history, 'replaceState');
  useAppStore.getState().setSelectedView('all');
  expect(replaceSpy).not.toHaveBeenCalled();
});

it('does not trigger article push when setSelectedView clears selectedArticleId', () => {
  const replaceSpy = vi.spyOn(window.history, 'replaceState');
  const pushSpy = vi.spyOn(window.history, 'pushState');

  useAppStore.setState({ selectedView: 'all', selectedArticleId: 'art-9' });
  useAppStore.getState().setSelectedView('feed-2');

  expect(replaceSpy).toHaveBeenCalledTimes(1);
  expect(pushSpy).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行定向测试确认失败**

Run: `pnpm test:unit src/store/appStore.test.ts -t "history"`
Expected: FAIL（当前实现只有 `replaceState`，文章选择不会触发 `pushState`）。

- [ ] **Step 3: 在 store 中实现 history 模式与默认语义**

```ts
type ReaderSelectionHistoryMode = 'replace' | 'push' | 'none';

function persistReaderSelectionToUrl(
  selectedView: ViewType,
  selectedArticleId: string | null,
  mode: ReaderSelectionHistoryMode,
): void {
  if (typeof window === 'undefined' || mode === 'none') return;
  // ...构建 nextUrl
  if (nextUrl === currentPathWithQueryAndHash) return;
  if (mode === 'push') {
    window.history.pushState(window.history.state, '', nextUrl);
    return;
  }
  window.history.replaceState(window.history.state, '', nextUrl);
}

let pendingReaderSelectionHistoryMode: ReaderSelectionHistoryMode = 'replace';

function queueReaderSelectionHistoryMode(mode: ReaderSelectionHistoryMode): void {
  pendingReaderSelectionHistoryMode = mode;
}

setSelectedView: (view, options) =>
  set(() => {
    queueReaderSelectionHistoryMode(options?.history ?? 'replace');
    // 原有 selectedView / selectedArticleId / cache 更新逻辑保持不变
  }),

setSelectedArticle: (id, options) => {
  queueReaderSelectionHistoryMode(options?.history ?? (id ? 'push' : 'replace'));
  set({ selectedArticleId: id });
  // 原有详情补拉逻辑保持不变
},

useAppStore.subscribe((state, previousState) => {
  if (
    state.selectedView === previousState.selectedView &&
    state.selectedArticleId === previousState.selectedArticleId
  ) {
    return;
  }

  const mode = pendingReaderSelectionHistoryMode;
  pendingReaderSelectionHistoryMode = 'replace';
  persistReaderSelectionToUrl(state.selectedView, state.selectedArticleId, mode);
});
```

- [ ] **Step 4: 重新运行定向测试确认通过**

Run: `pnpm test:unit src/store/appStore.test.ts -t "history"`
Expected: PASS（新增 history 契约测试通过）。

- [ ] **Step 5: 提交**

```bash
git add src/store/appStore.ts src/store/appStore.test.ts
git commit -m "feat(store): 区分视图与文章选择的历史写入模式" \
  -m "- 添加 replace/push/none 三种 URL history 写入模式" \
  -m "- 更新 setSelectedView 与 setSelectedArticle 的默认写入语义" \
  -m "- 确保 URL 未变化时跳过 history API 调用"
```

## Chunk 2: 浏览器返回/前进恢复链路（TDD）

### Task 2: 补齐 `popstate` 恢复，且恢复流程不再写入 history

**Files:**
- Modify: `src/store/appStore.test.ts`
- Modify: `src/store/appStore.ts`

- [ ] **Step 1: 先写失败测试，锁定 `view -> loadSnapshot -> article` 恢复顺序与无 history 写入**

```ts
it('restores selection on popstate in view -> snapshot -> article order without writing history', async () => {
  const replaceSpy = vi.spyOn(window.history, 'replaceState');
  const pushSpy = vi.spyOn(window.history, 'pushState');
  const transitions: Array<string> = [];

  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = getFetchCallUrl(input);
    if (url.includes('/api/reader/snapshot')) {
      return jsonResponse({
        ok: true,
        data: {
          categories: [],
          feeds: [createSnapshotFeed('feed-rss-1', 'RSS 1', 1)],
          articles: {
            items: [createSnapshotArticle('src-1', 'feed-rss-1', 'Source 1')],
            nextCursor: null,
          },
        },
      });
    }
    if (url.includes('/api/articles/src-1')) {
      return jsonResponse({ ok: true, data: { id: 'src-1', feedId: 'feed-rss-1', contentHtml: '<p>body</p>' } });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });

  const unsubscribe = useAppStore.subscribe((state, previous) => {
    if (
      state.selectedView !== previous.selectedView ||
      state.selectedArticleId !== previous.selectedArticleId
    ) {
      transitions.push(`${state.selectedView}:${state.selectedArticleId ?? 'null'}`);
    }
  });

  try {
    window.history.pushState({}, '', '/?view=feed-rss-1&article=src-1');
    replaceSpy.mockClear();
    pushSpy.mockClear();

    window.dispatchEvent(new PopStateEvent('popstate'));

    await vi.waitFor(() => {
      expect(useAppStore.getState().selectedView).toBe('feed-rss-1');
      expect(useAppStore.getState().selectedArticleId).toBe('src-1');
    });
  } finally {
    unsubscribe();
  }

  expect(transitions.indexOf('feed-rss-1:null')).toBeGreaterThanOrEqual(0);
  expect(transitions.indexOf('feed-rss-1:src-1')).toBeGreaterThan(
    transitions.indexOf('feed-rss-1:null'),
  );
  expect(replaceSpy).not.toHaveBeenCalled();
  expect(pushSpy).not.toHaveBeenCalled();
});

it('does not write history when loading selected article from URL hydration', async () => {
  const replaceSpy = vi.spyOn(window.history, 'replaceState');
  const pushSpy = vi.spyOn(window.history, 'pushState');

  window.history.replaceState({}, '', '/?view=feed-1&article=art-1');
  vi.resetModules();
  ({ useAppStore } = await import('./appStore'));

  // mock snapshot + article detail...
  await useAppStore.getState().loadSnapshot({ view: 'feed-1' });
  await flushPromises();

  expect(replaceSpy).not.toHaveBeenCalled();
  expect(pushSpy).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行定向测试确认失败**

Run: `pnpm test:unit src/store/appStore.test.ts -t "popstate|hydration"`
Expected: FAIL（当前未监听 `popstate`，且恢复路径未显式区分 `none` 模式）。

- [ ] **Step 3: 实现恢复分支与监听器**

```ts
async function restoreReaderSelectionFromUrl(): Promise<void> {
  const { selectedView, selectedArticleId } = readReaderSelectionFromUrl();
  const store = useAppStore.getState();

  store.setSelectedView(selectedView, { history: 'none' });
  await store.loadSnapshot({ view: selectedView });
  store.setSelectedArticle(selectedArticleId, { history: 'none' });
}

// loadSnapshot 内部补拉详情逻辑改为无 history 写入
if (selectedArticleId) {
  const selectedArticle = get().articles.find((item) => item.id === selectedArticleId);
  if (!selectedArticle?.content) {
    get().setSelectedArticle(selectedArticleId, { history: 'none' });
  }
}

if (typeof window !== 'undefined') {
  const onPopState = () => {
    void restoreReaderSelectionFromUrl().catch((err) => {
      console.error(err);
    });
  };

  window.addEventListener('popstate', onPopState);
}
```

- [ ] **Step 4: 重新运行定向测试确认通过**

Run: `pnpm test:unit src/store/appStore.test.ts -t "popstate|hydration|history"`
Expected: PASS（恢复顺序与无 history 写入断言全部通过）。

- [ ] **Step 5: 提交**

```bash
git add src/store/appStore.ts src/store/appStore.test.ts
git commit -m "feat(store): 补齐浏览器返回前进的阅读状态恢复" \
  -m "- 添加 popstate 监听并按 view 到 snapshot 到 article 顺序恢复" \
  -m "- 增加无 history 写入分支用于初始化与回退恢复" \
  -m "- 保持现有 snapshot 与详情补拉机制不变"
```

## Chunk 3: 来源模块位置调整（TDD）

### Task 3: 将 AI 解读来源模块移动到正文 HTML 之后

**Files:**
- Modify: `src/features/articles/ArticleView.aiDigestSources.test.tsx`
- Modify: `src/features/articles/ArticleView.tsx`

- [ ] **Step 1: 先写失败测试，锁定 DOM 顺序**

```tsx
it('renders source section after article html container for ai_digest article', async () => {
  seedState({
    feed: { id: 'feed-digest', kind: 'ai_digest', title: 'AI解读' },
    article: {
      id: 'digest-order-1',
      feedId: 'feed-digest',
      content: '<p>digest body</p>',
      aiDigestSources: [
        {
          articleId: 'src-1',
          feedId: 'feed-rss-1',
          feedTitle: 'RSS 1',
          title: '来源 1',
          link: null,
          publishedAt: null,
          position: 0,
        },
      ],
    },
  });

  render(<ArticleView />);

  const articleHtml = await screen.findByTestId('article-html-content');
  const sourceSection = screen.getByTestId('ai-digest-sources-section');
  expect(
    articleHtml.compareDocumentPosition(sourceSection) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});
```

- [ ] **Step 2: 运行定向测试确认失败**

Run: `pnpm test:unit src/features/articles/ArticleView.aiDigestSources.test.tsx`
Expected: FAIL（当前来源模块位于正文容器之前，且无 `ai-digest-sources-section` 标识）。

- [ ] **Step 3: 最小实现移动来源模块**

```tsx
<div
  ref={articleContentRef}
  className={cn('prose max-w-none dark:prose-invert', fontSizeClass, lineHeightClass, fontFamilyClass)}
  data-testid="article-html-content"
  onClickCapture={onArticleContentClick}
  onKeyDownCapture={onArticleContentKeyDown}
  dangerouslySetInnerHTML={articleBodyMarkup}
/>

{isAiDigestArticle ? (
  <section
    data-testid="ai-digest-sources-section"
    className="mt-6 rounded-xl border border-border/65 bg-muted/20 px-4 py-3"
    aria-label="来源"
  >
    {/* 保留原有来源标题/空态/点击逻辑 */}
  </section>
) : null}
```

- [ ] **Step 4: 重新运行定向测试确认通过**

Run: `pnpm test:unit src/features/articles/ArticleView.aiDigestSources.test.tsx`
Expected: PASS（来源显示、隐藏、跳转链路与 DOM 顺序断言全部通过）。

- [ ] **Step 5: 提交**

```bash
git add src/features/articles/ArticleView.tsx src/features/articles/ArticleView.aiDigestSources.test.tsx
git commit -m "fix(article-view): 将AI解读来源模块下移到正文末尾" \
  -m "- 更新 ArticleView 布局顺序使来源位于正文 HTML 之后" \
  -m "- 保持来源空态与跳转交互不变" \
  -m "- 补充来源模块 DOM 顺序测试"
```

## Chunk 4: 回归验证与交付检查

### Task 4: 执行完整验证（包含强制构建）

**Files:**
- Modify: 无（验证任务）

- [ ] **Step 1: 运行核心单测集合**

Run: `pnpm test:unit src/store/appStore.test.ts src/features/articles/ArticleView.aiDigestSources.test.tsx`
Expected: PASS。

- [ ] **Step 2: 运行受影响视图链路测试（防回归）**

Run: `pnpm test:unit src/features/feeds/FeedList.test.tsx src/features/articles/ArticleList.test.tsx`
Expected: PASS（左栏/中栏交互未回归）。

- [ ] **Step 3: 执行构建验证（必做）**

Run: `pnpm build`
Expected: PASS（类型检查与生产构建成功，无新增错误）。

- [ ] **Step 4: 审查最终行为清单**

Run: `pnpm test:unit src/store/appStore.test.ts -t "popstate|history|hydrates and persists"`
Expected: PASS，并人工确认以下行为：
- 左栏切换只 `replace`；
- 中栏文章点击与来源跳转最终 `push`；
- 初始化恢复与 `popstate` 恢复不写 history；
- 来源模块在正文后。

- [ ] **Step 5: 记录验证结果（无代码改动可不提交）**

```bash
git status --short
```
Expected: 工作区仅包含计划内变更；若无新增改动则跳过提交。

## 风险与缓解

- 风险：`popstate` 恢复与 `ReaderApp` 自动 `loadSnapshot` 形成重复请求。
  - 缓解：保持恢复链路最小化，不新增额外轮询；测试只约束最终状态与顺序，不绑定请求次数。
- 风险：`setSelectedArticle(null)` 在移动端返回列表时产生不必要 history 记录。
  - 缓解：默认仅非空文章 ID 走 `push`，空值使用 `replace`。
- 风险：来源模块顺序测试对结构调整过敏。
  - 缓解：使用 `data-testid` + DOM 位置关系断言，不绑定 className。

## Acceptance Mapping

- `ai_digest` 文章来源模块位于正文 HTML 后面：由 `ArticleView.aiDigestSources.test.tsx` 的顺序断言覆盖。
- 左栏 smart views/订阅源切换使用 `replace`：由 `appStore.test.ts` history 模式测试覆盖。
- 中栏文章与来源跳转最终使用 `push`：由 `appStore.test.ts` + `ArticleView.aiDigestSources.test.tsx` 覆盖。
- 初始化与 `popstate` 恢复不新增 history：由 `appStore.test.ts` 无 history 写入断言覆盖。
- 浏览器返回恢复按 `view -> loadSnapshot -> article` 顺序：由 `appStore.test.ts` transitions 断言覆盖。
- 构建验证通过：由 `pnpm build` gate 覆盖。

# Reader Middle Column Virtualized Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: 由于仓库策略禁止 subagent，实现时使用 `superwork-executing-plans` 按任务顺序内联执行。步骤使用 checkbox (`- [ ]`) 语法跟踪。

**Goal:** 让阅读页中栏支持按需滚动加载全部文章，并通过虚拟化控制 DOM 数量，避免随着已加载文章增多而出现明显卡顿。

**Architecture:** 保留现有 `/api/reader/snapshot` 作为单一数据入口，将其扩展为支持 `unreadOnly`、`totalCount` 和稳定的游标分页。前端 store 负责维护当前视图的分页会话状态，`ArticleList` 则从“全量分组渲染”调整为“扁平虚拟行 + 底部按需加载 + 顶部插入补偿”，并把虚拟窗口算法拆到独立辅助模块，避免继续膨胀单文件组件。

**Tech Stack:** Next.js 16、React 19、TypeScript、Zustand、Vitest、Testing Library、pnpm

---

## Planned File Structure

- `src/server/services/readerSnapshotService.ts`
  责任：扩展 snapshot 过滤条件、总数统计和分页返回结构。
- `src/server/services/readerSnapshotService.test.ts`
  责任：锁定 `buildArticleFilter` 对 `unreadOnly`、`includeFiltered` 和 cursor 的过滤约束。
- `src/app/api/reader/snapshot/route.ts`
  责任：解析并透传新的 query 参数。
- `src/app/api/reader/snapshot/route.test.ts`
  责任：锁定 route 对 `unreadOnly` 和新返回字段的透传行为。
- `src/lib/apiClient.ts`
  责任：扩展前端 snapshot DTO 与请求参数。
- `src/store/appStore.ts`
  责任：引入当前视图分页会话状态，拆分“第一页加载”和“下一页追加”。
- `src/store/appStore.test.ts`
  责任：覆盖分页状态追加、切换视图重置、过期请求丢弃和加载失败保持已有内容。
- `src/features/articles/articleListModel.ts`
  责任：继续输出 section 数据，并新增虚拟行拍平结果与总高度元信息。
- `src/features/articles/articleListModel.test.ts`
  责任：锁定拍平规则、未读保留边界和两种模式下的行高模型。
- `src/features/articles/articleVirtualWindow.ts`
  责任：封装虚拟窗口区间计算、spacer 高度和锚点补偿所需的纯函数。
- `src/features/articles/articleVirtualWindow.test.ts`
  责任：锁定可视窗口、overscan 和锚点补偿计算。
- `src/features/articles/ArticleList.tsx`
  责任：接入分页会话、滚动触发加载、虚拟化渲染、底部错误态和顶部插入补偿。
- `src/features/articles/ArticleList.test.tsx`
  责任：覆盖加载更多、虚拟渲染、card/list 双模式、顶部插入稳定和现有交互回归。

### Task 1: 扩展 snapshot 契约与服务端分页语义

**Files:**
- Modify: `src/server/services/readerSnapshotService.ts`
- Modify: `src/server/services/readerSnapshotService.test.ts`
- Modify: `src/app/api/reader/snapshot/route.ts`
- Modify: `src/app/api/reader/snapshot/route.test.ts`
- Modify: `src/lib/apiClient.ts`
- Check: `docs/superwork/specs/2026-03-21-reader-middle-column-virtualized-pagination-design.md`

- [ ] **Step 1: 写失败测试，先锁定 `unreadOnly` 过滤与 route 透传**

```ts
it('adds unreadOnly filter on top of aggregate and feed views', () => {
  const filter = buildArticleFilter({ view: 'all', unreadOnly: true });
  expect(filter.whereSql).toContain('is_read = false');
  expect(filter.params[0]).toEqual(['passed', 'error']);
});

it('forwards unreadOnly query param', async () => {
  await mod.GET(
    new Request('http://localhost/api/reader/snapshot?view=feed-1&unreadOnly=true'),
  );

  expect(getReaderSnapshotMock).toHaveBeenCalledWith(
    pool,
    expect.objectContaining({ view: 'feed-1', unreadOnly: true }),
  );
});
```

- [ ] **Step 2: 运行服务端与 route 单测，确认新契约尚未实现**

Run: `pnpm test:unit -- src/server/services/readerSnapshotService.test.ts src/app/api/reader/snapshot/route.test.ts`
Expected: FAIL，提示 `unreadOnly` 相关断言不成立或 query schema 未识别该参数。

- [ ] **Step 3: 以最小实现扩展 service、route 和前端 DTO**

```ts
const querySchema = z.object({
  view: z.string().optional().default('all'),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().optional(),
  unreadOnly: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  includeFiltered: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
});

export interface ReaderSnapshotDto {
  articles: {
    items: SnapshotArticleDto[];
    nextCursor: string | null;
    totalCount: number;
  };
}
```

实现要求：

- `buildArticleFilter()` 支持对任意视图叠加 `unreadOnly`
- `getReaderSnapshot()` 除分页查询外，再返回当前条件下的 `totalCount`
- `totalCount` 必须和 `cursor` 无关，只反映当前筛选条件总数
- `getReaderSnapshot()` 客户端请求支持传 `unreadOnly`
- 在关键 SQL 分支加简短注释，说明为什么总数统计不能复用分页 `limit`

- [ ] **Step 4: 重跑服务端与 route 单测，确认新契约通过**

Run: `pnpm test:unit -- src/server/services/readerSnapshotService.test.ts src/app/api/reader/snapshot/route.test.ts`
Expected: PASS

- [ ] **Step 5: 提交 snapshot 契约改动**

```bash
git add src/server/services/readerSnapshotService.ts src/server/services/readerSnapshotService.test.ts src/app/api/reader/snapshot/route.ts src/app/api/reader/snapshot/route.test.ts src/lib/apiClient.ts
git commit -m "feat(reader): 扩展快照分页契约" -m "- 添加 unreadOnly 与 totalCount 的快照语义
- 更新 reader snapshot route 和前端 DTO 透传新字段
- 锁定服务端过滤规则与接口契约测试"
```

### Task 2: 为 appStore 引入当前视图分页会话状态

**Files:**
- Modify: `src/store/appStore.ts`
- Modify: `src/store/appStore.test.ts`
- Reuse: `src/lib/apiClient.ts`
- Check: `docs/superwork/specs/2026-03-21-reader-middle-column-virtualized-pagination-design.md`

- [ ] **Step 1: 写失败测试，锁定分页追加、视图切换重置和失败保持已有内容**

```ts
it('appends next snapshot page into the visible view session', async () => {
  getReaderSnapshotMock
    .mockResolvedValueOnce(makeSnapshotPage({ items: [article('a1')], nextCursor: 'c1', totalCount: 3 }))
    .mockResolvedValueOnce(makeSnapshotPage({ items: [article('a2')], nextCursor: 'c2', totalCount: 3 }));

  await useAppStore.getState().loadSnapshot({ view: 'all' });
  await useAppStore.getState().loadMoreSnapshot();

  expect(useAppStore.getState().articles.map((item) => item.id)).toEqual(['a1', 'a2']);
  expect(useAppStore.getState().articleListTotalCount).toBe(3);
});

it('resets pagination session when selectedView changes', async () => {
  await useAppStore.getState().loadSnapshot({ view: 'feed-1' });
  useAppStore.getState().setSelectedView('feed-2');
  expect(useAppStore.getState().articleListNextCursor).toBeNull();
});
```

- [ ] **Step 2: 运行 store 单测，确认新状态和动作尚未存在**

Run: `pnpm test:unit -- src/store/appStore.test.ts`
Expected: FAIL，提示找不到新增状态字段或 `loadMoreSnapshot` 动作。

- [ ] **Step 3: 用最小实现扩展 store 会话状态与加载动作**

```ts
interface AppState {
  articleListNextCursor: string | null;
  articleListHasMore: boolean;
  articleListTotalCount: number;
  articleListInitialLoading: boolean;
  articleListLoadingMore: boolean;
  articleListLoadMoreError: boolean;
  loadMoreSnapshot: () => Promise<void>;
}

function mergeSnapshotPage(previous: Article[], incoming: Article[]) {
  const byId = new Map(previous.map((item) => [item.id, item]));
  for (const article of incoming) {
    byId.set(article.id, mergeSnapshotArticleWithExistingDetails(article, byId.get(article.id)));
  }
  return Array.from(byId.values());
}
```

实现要求：

- 首次加载和追加加载分成独立状态位，避免一个 loading 覆盖另一个
- 视图切换时同步重置 `nextCursor`、`hasMore`、`totalCount`、`loadingMore`
- 追加失败不清空已有 `articles`
- 过期响应继续沿用 `requestId` 机制丢弃
- `showUnreadOnly` 打开时通过 `unreadOnly` 请求服务端，不再依赖一次拉全量再前端裁剪
- 在状态合并分支加简短注释，说明为何要保持已展开文章的详情字段

- [ ] **Step 4: 重跑 store 单测，确认分页会话行为通过**

Run: `pnpm test:unit -- src/store/appStore.test.ts`
Expected: PASS

- [ ] **Step 5: 提交 store 分页状态改动**

```bash
git add src/store/appStore.ts src/store/appStore.test.ts src/lib/apiClient.ts
git commit -m "feat(store): 添加中栏分页会话状态" -m "- 添加当前视图的 cursor、总数和加载更多状态
- 拆分第一页加载与下一页追加动作并处理过期响应
- 锁定视图切换重置和失败保留内容的回归测试"
```

### Task 3: 提取虚拟行模型与窗口计算纯函数

**Files:**
- Modify: `src/features/articles/articleListModel.ts`
- Modify: `src/features/articles/articleListModel.test.ts`
- Create: `src/features/articles/articleVirtualWindow.ts`
- Create: `src/features/articles/articleVirtualWindow.test.ts`
- Reuse: `src/features/articles/ArticleList.tsx`

- [ ] **Step 1: 先写纯函数失败测试，锁定拍平结果、spacer 高度和锚点补偿计算**

```ts
it('flattens section headings and articles into fixed-height rows', () => {
  const result = buildArticleListDerivedState({
    ...input,
    displayMode: 'card',
  });

  expect(result.virtualRows.map((row) => row.type)).toEqual([
    'section',
    'article',
    'article',
  ]);
  expect(result.totalVirtualHeight).toBeGreaterThan(0);
});

it('computes visible range with overscan and spacer heights', () => {
  expect(
    getArticleVirtualWindow({
      rowHeights: [32, 88, 88, 88],
      scrollTop: 80,
      viewportHeight: 120,
      overscan: 1,
    }),
  ).toEqual(
    expect.objectContaining({
      startIndex: 0,
      endIndex: 3,
    }),
  );
});
```

- [ ] **Step 2: 运行模型与虚拟窗口单测，确认纯函数尚未实现**

Run: `pnpm test:unit -- src/features/articles/articleListModel.test.ts src/features/articles/articleVirtualWindow.test.ts`
Expected: FAIL，提示 `virtualRows` 或 `getArticleVirtualWindow` 不存在。

- [ ] **Step 3: 最小实现扁平行模型和虚拟窗口计算**

```ts
export interface ArticleVirtualRow {
  key: string;
  type: 'section' | 'article';
  height: number;
  articleId: string | null;
  sectionKey: string;
}

export function getArticleVirtualWindow(input: {
  rowHeights: number[];
  scrollTop: number;
  viewportHeight: number;
  overscan: number;
}) {
  // 使用累计高度定位可见窗口，避免组件内重复扫描所有行
}
```

实现要求：

- `articleListModel.ts` 同时输出现有 `articleSections` 和新增 `virtualRows`
- 行高常量按 `card` / `list` 模式区分，避免组件内散落魔法数
- `articleVirtualWindow.ts` 保持纯函数，不依赖 DOM
- 提供锚点补偿辅助函数，用于“顶部插入新文章后保持视口稳定”
- 在复杂区间计算前补简短注释，解释为什么要用累计高度而不是依赖真实 DOM 测量

- [ ] **Step 4: 重跑纯函数测试，确认虚拟模型稳定**

Run: `pnpm test:unit -- src/features/articles/articleListModel.test.ts src/features/articles/articleVirtualWindow.test.ts`
Expected: PASS

- [ ] **Step 5: 提交虚拟行模型与窗口算法**

```bash
git add src/features/articles/articleListModel.ts src/features/articles/articleListModel.test.ts src/features/articles/articleVirtualWindow.ts src/features/articles/articleVirtualWindow.test.ts
git commit -m "feat(article-list): 添加虚拟行与窗口算法" -m "- 添加中栏 section 与文章的扁平虚拟行模型
- 提取虚拟窗口和锚点补偿纯函数以复用滚动计算
- 补齐模型与窗口算法的单元测试"
```

### Task 4: 在 ArticleList 中接入虚拟化、按需加载和顶部插入补偿

**Files:**
- Modify: `src/features/articles/ArticleList.tsx`
- Modify: `src/features/articles/ArticleList.test.tsx`
- Reuse: `src/features/articles/articleListModel.ts`
- Reuse: `src/features/articles/articleVirtualWindow.ts`
- Reuse: `src/store/appStore.ts`

- [ ] **Step 1: 先写集成失败测试，覆盖底部加载、有限 DOM 和顶部插入稳定**

```tsx
it('loads next page when scrolling near the bottom', async () => {
  render(<ArticleList />);
  fireEvent.scroll(getScrollContainer(), { target: { scrollTop: 10_000 } });
  await waitFor(() => expect(loadMoreSnapshotMock).toHaveBeenCalledTimes(1));
});

it('renders only the visible virtual rows instead of the full article set', () => {
  seedArticles(120);
  render(<ArticleList />);
  expect(screen.queryByTestId('article-card-article-119-title')).not.toBeInTheDocument();
});

it('keeps viewport stable when refreshed data prepends newer articles', async () => {
  const container = getScrollContainer();
  container.scrollTop = 1600;
  rerender(<ArticleList renderedAt="2026-03-21T12:05:00.000Z" />);
  expect(container.scrollTop).toBeGreaterThan(1500);
});
```

测试要求：

- 同时覆盖 `card` 和 `list` 两种模式的虚拟渲染
- 保留现有键盘导航、未读保留和预览图懒加载断言
- 新增“底部加载失败时保留已有条目并显示重试入口”断言

- [ ] **Step 2: 运行 `ArticleList` 测试，确认 UI 仍是全量渲染**

Run: `pnpm test:unit -- src/features/articles/ArticleList.test.tsx`
Expected: FAIL，提示没有触发 `loadMoreSnapshot`、全量节点仍在 DOM 中或顶部补偿行为不存在。

- [ ] **Step 3: 以最小改动重构 `ArticleList` 渲染路径**

```tsx
const virtualWindow = getArticleVirtualWindow({
  rowHeights,
  scrollTop,
  viewportHeight,
  overscan: 8,
});

const visibleRows = virtualRows.slice(virtualWindow.startIndex, virtualWindow.endIndex + 1);

return (
  <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto pb-3 pt-1">
    <div style={{ height: virtualWindow.topSpacerHeight }} />
    {visibleRows.map(renderVirtualRow)}
    <div style={{ height: virtualWindow.bottomSpacerHeight }} />
  </div>
);
```

实现要求：

- 近底部触发 `loadMoreSnapshot()`，并做 `loadingMore` / `hasMore` 并发保护
- 仅对当前可见卡片绑定预览图 observer
- `cardTitleRefs` 相关逻辑要么删除，要么收敛到可见节点，不能再依赖全量 DOM
- 底部增加“加载中 / 加载失败 / 重试”轻量状态
- 顶部刷新后使用锚点补偿恢复 `scrollTop`
- 在滚动补偿与虚拟化关键分支加简短注释，解释为何要在刷新前后记录锚点

- [ ] **Step 4: 重跑 `ArticleList` 测试，确认核心交互通过**

Run: `pnpm test:unit -- src/features/articles/ArticleList.test.tsx`
Expected: PASS

- [ ] **Step 5: 提交中栏虚拟化与加载更多 UI**

```bash
git add src/features/articles/ArticleList.tsx src/features/articles/ArticleList.test.tsx src/features/articles/articleListModel.ts src/features/articles/articleVirtualWindow.ts src/store/appStore.ts
git commit -m "feat(article-list): 支持虚拟滚动与按需加载" -m "- 添加中栏底部按需分页加载与错误重试状态
- 改为只渲染可视窗口附近行并保持顶部刷新视口稳定
- 覆盖 card 和 list 模式下的虚拟化集成测试"
```

### Task 5: 做回归验证并收尾

**Files:**
- Verify: `src/server/services/readerSnapshotService.ts`
- Verify: `src/app/api/reader/snapshot/route.ts`
- Verify: `src/lib/apiClient.ts`
- Verify: `src/store/appStore.ts`
- Verify: `src/features/articles/articleListModel.ts`
- Verify: `src/features/articles/articleVirtualWindow.ts`
- Verify: `src/features/articles/ArticleList.tsx`
- Check: `docs/superwork/specs/2026-03-21-reader-middle-column-virtualized-pagination-design.md`

- [ ] **Step 1: 运行聚焦测试集，确认分页、模型和中栏交互没有回退**

Run: `pnpm test:unit -- src/server/services/readerSnapshotService.test.ts src/app/api/reader/snapshot/route.test.ts src/store/appStore.test.ts src/features/articles/articleListModel.test.ts src/features/articles/articleVirtualWindow.test.ts src/features/articles/ArticleList.test.tsx`
Expected: PASS

- [ ] **Step 2: 运行相关回归测试，确认阅读页其余关键行为仍稳定**

Run: `pnpm test:unit -- src/app/(reader)/ReaderApp.test.tsx src/features/reader/ReaderToolbarIconButton.test.tsx`
Expected: PASS

- [ ] **Step 3: 运行完整构建验证，满足仓库要求**

Run: `pnpm build`
Expected: PASS，Next.js 构建完成，无类型错误。

- [ ] **Step 4: 人工检查最终 diff，确认范围聚焦在中栏分页与虚拟化**

Run: `git diff --stat`
Expected: 只涉及 snapshot 契约、store 分页状态、虚拟化辅助模块、中栏组件与相关测试；不应出现无关业务文件修改。

- [ ] **Step 5: 如果验证阶段有真实代码修补，再做一个收尾提交**

```bash
git add src/server/services/readerSnapshotService.ts src/app/api/reader/snapshot/route.ts src/lib/apiClient.ts src/store/appStore.ts src/features/articles/articleListModel.ts src/features/articles/articleVirtualWindow.ts src/features/articles/ArticleList.tsx src/server/services/readerSnapshotService.test.ts src/app/api/reader/snapshot/route.test.ts src/store/appStore.test.ts src/features/articles/articleListModel.test.ts src/features/articles/articleVirtualWindow.test.ts src/features/articles/ArticleList.test.tsx
git commit -m "fix(article-list): 收敛分页与虚拟化边界" -m "- 修复验证阶段发现的滚动补偿与分页状态边界问题
- 优化中栏加载更多失败和重试的交互细节
- 保持最终改动聚焦在文章列表分页与性能"
```

仅当验证阶段产生真实代码改动时执行本步骤。

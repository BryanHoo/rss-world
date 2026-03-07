# 阅读器右侧目录重设计 Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 将当前正文内的 hover 轨道目录重构为桌面端常驻、低存在感、位于正文右侧空白区的目录面板；支持点击跳转、滚动跟随高亮、短文章隐藏，以及右侧空白不足时自动隐藏或收窄。

**Architecture:** 保持现有三栏布局与正文宽度不变，把目录从 `article-scroll-container` 的滚动内容中抽离到 `ArticleView` 的独立附着层。目录数据继续来自最终渲染 DOM 的 `h1/h2/h3`，目录显示与定位全部由 `ArticleView` 的局部状态、测量 helper 和 `ResizeObserver` 驱动，不进入全局 store。

**Tech Stack:** React 19, Next.js client components, TypeScript, Tailwind CSS, Vitest, Testing Library, JSDOM, `pnpm`

---

## Relevant Context To Read First

- Design doc: `docs/plans/2026-03-07-reader-outline-panel-redesign-design.md`
- Superseded design: `docs/plans/2026-03-07-reader-outline-rail-design.md`
- Superseded plan: `docs/plans/2026-03-07-reader-outline-rail-implementation-plan.md`
- Prior learning: `docs/summaries/2026-03-06-reader-resizable-three-column-layout.md`
- Prior learning: `docs/summaries/2026-03-05-translation-preserve-html-structure.md`
- Prior learning: `docs/summaries/2026-03-06-middle-column-image-loading.md`

## Implementation Notes

- 保持目录状态局部化；不要把目录显示、定位或 active heading 写入 `useAppStore` 或 `useSettingsStore`。
- 继续以最终渲染 DOM 作为目录事实源，兼容全文抓取和沉浸式翻译后的 HTML 变化。
- 优先修改现有 `ArticleOutlineRail.tsx`，避免无必要重命名扩散；如实现中重命名，必须同步更新所有引用与测试。
- 把“目录是否显示”和“目录如何定位”拆成可单测的纯 helper，避免把逻辑糅进组件 effect。
- 只在测量结果真实变化时更新 state，避免 `ResizeObserver` 与滚动回调制造无意义重渲染。

### Task 1: 提炼目录显示与布局计算 helper

**Files:**

- Modify: `src/features/articles/articleOutline.ts`
- Modify: `src/features/articles/articleOutline.test.ts`

**Step 1: 写失败测试**

在 `src/features/articles/articleOutline.test.ts` 新增针对显示规则与布局计算的纯函数测试：

```ts
import { describe, expect, it } from 'vitest';
import {
  buildArticleOutlinePanelLayout,
  shouldShowArticleOutline,
} from './articleOutline';

describe('shouldShowArticleOutline', () => {
  it('hides the outline when the rendered content height is too short', () => {
    expect(
      shouldShowArticleOutline({
        headingCount: 3,
        contentHeight: 1200,
        viewportHeight: 1000,
        isDesktop: true,
      }),
    ).toBe(false);
  });

  it('shows the outline when the article is long enough on desktop', () => {
    expect(
      shouldShowArticleOutline({
        headingCount: 2,
        contentHeight: 1600,
        viewportHeight: 1000,
        isDesktop: true,
      }),
    ).toBe(true);
  });
});

describe('buildArticleOutlinePanelLayout', () => {
  it('returns a visible panel with a clamped width when right-side gap is sufficient', () => {
    expect(
      buildArticleOutlinePanelLayout({
        viewportLeft: 0,
        viewportRight: 1200,
        contentRight: 860,
      }),
    ).toMatchObject({ visible: true, width: 220, right: 24 });
  });

  it('hides the panel when the right-side gap is below the threshold', () => {
    expect(
      buildArticleOutlinePanelLayout({
        viewportLeft: 0,
        viewportRight: 960,
        contentRight: 900,
      }),
    ).toMatchObject({ visible: false });
  });
});
```

**Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run src/features/articles/articleOutline.test.ts --project=jsdom --no-file-parallelism`

Expected: FAIL，提示 `shouldShowArticleOutline` 或 `buildArticleOutlinePanelLayout` 未定义。

**Step 3: 编写最小实现**

在 `src/features/articles/articleOutline.ts` 中新增可复用常量与 helper：

```ts
const OUTLINE_MIN_CONTENT_RATIO = 1.25;
const OUTLINE_PANEL_GAP_PX = 16;
const OUTLINE_PANEL_RIGHT_PADDING_PX = 24;
const OUTLINE_PANEL_MIN_WIDTH_PX = 160;
const OUTLINE_PANEL_MAX_WIDTH_PX = 240;
const OUTLINE_PANEL_HIDE_THRESHOLD_PX =
  OUTLINE_PANEL_MIN_WIDTH_PX + OUTLINE_PANEL_GAP_PX + OUTLINE_PANEL_RIGHT_PADDING_PX;

export function shouldShowArticleOutline({
  headingCount,
  contentHeight,
  viewportHeight,
  isDesktop,
}: {
  headingCount: number;
  contentHeight: number;
  viewportHeight: number;
  isDesktop: boolean;
}) {
  if (!isDesktop || headingCount === 0) return false;
  if (!Number.isFinite(contentHeight) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return false;
  }

  return contentHeight / viewportHeight > OUTLINE_MIN_CONTENT_RATIO;
}

export function buildArticleOutlinePanelLayout({
  viewportLeft,
  viewportRight,
  contentRight,
}: {
  viewportLeft: number;
  viewportRight: number;
  contentRight: number;
}) {
  const availableWidth = viewportRight - contentRight - OUTLINE_PANEL_GAP_PX - OUTLINE_PANEL_RIGHT_PADDING_PX;
  if (!Number.isFinite(availableWidth) || availableWidth < OUTLINE_PANEL_MIN_WIDTH_PX) {
    return { visible: false as const, width: 0, right: OUTLINE_PANEL_RIGHT_PADDING_PX };
  }

  return {
    visible: true as const,
    width: Math.min(OUTLINE_PANEL_MAX_WIDTH_PX, Math.max(OUTLINE_PANEL_MIN_WIDTH_PX, availableWidth)),
    right: OUTLINE_PANEL_RIGHT_PADDING_PX,
  };
}
```

**Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run src/features/articles/articleOutline.test.ts --project=jsdom --no-file-parallelism`

Expected: PASS，新增 helper 测试通过。

**Step 5: Commit**

```bash
git add src/features/articles/articleOutline.ts src/features/articles/articleOutline.test.ts
git commit -m "✨ feat(reader-outline): 添加目录显示与布局计算逻辑" \
  -m "- 添加目录显示阈值与右侧空白布局 helper
- 添加短文章隐藏与宽度夹取的回归测试"
```

### Task 2: 将目录组件改为常驻低存在感面板

**Files:**

- Modify: `src/features/articles/ArticleOutlineRail.tsx`
- Modify: `src/features/articles/ArticleOutlineRail.test.tsx`

**Step 1: 写失败测试**

把组件测试改成验证“默认可见、无 hover 依赖、当前项轻量高亮、标题截断”：

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ArticleOutlineRail from './ArticleOutlineRail';

const headings = [
  { id: 'article-outline-overview', level: 2 as const, text: 'Overview', topRatio: 0.1 },
  { id: 'article-outline-details', level: 3 as const, text: 'Details', topRatio: 0.6 },
];

describe('ArticleOutlineRail', () => {
  it('renders a persistent navigation panel by default', () => {
    render(
      <ArticleOutlineRail
        headings={headings}
        activeHeadingId="article-outline-overview"
        onSelect={vi.fn()}
        width={200}
        maxHeight={320}
      />,
    );

    expect(screen.getByRole('navigation', { name: '文章目录' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
  });

  it('calls onSelect when a heading is clicked', () => {
    const onSelect = vi.fn();
    render(
      <ArticleOutlineRail
        headings={headings}
        activeHeadingId="article-outline-overview"
        onSelect={onSelect}
        width={180}
        maxHeight={280}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(onSelect).toHaveBeenCalledWith('article-outline-details');
  });
});
```

**Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run src/features/articles/ArticleOutlineRail.test.tsx --project=jsdom --no-file-parallelism`

Expected: FAIL，旧组件仍依赖 `viewport` 或 hover 展开语义，无法满足新断言。

**Step 3: 编写最小实现**

把 `ArticleOutlineRail.tsx` 改造成常驻 `nav` 面板，并在内部处理当前项滚动可见：

```tsx
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { ArticleOutlineMarker } from './articleOutline';

interface ArticleOutlineRailProps {
  headings: ArticleOutlineMarker[];
  activeHeadingId: string | null;
  onSelect: (headingId: string) => void;
  width: number;
  maxHeight: number;
}

export default function ArticleOutlineRail({ headings, activeHeadingId, onSelect, width, maxHeight }: ArticleOutlineRailProps) {
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeButtonRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeHeadingId]);

  if (headings.length === 0) return null;

  return (
    <nav
      aria-label="文章目录"
      data-testid="article-outline-panel"
      className="rounded-xl border border-border/50 bg-background/70 p-2 shadow-sm backdrop-blur-sm transition-colors hover:bg-background/85"
      style={{ width, maxHeight }}
    >
      <div className="overflow-y-auto" style={{ maxHeight: maxHeight - 16 }}>
        {headings.map((heading) => {
          const active = activeHeadingId === heading.id;
          return (
            <button
              key={heading.id}
              ref={active ? activeButtonRef : null}
              type="button"
              className={cn(
                'block w-full truncate rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors',
                heading.level === 3 && 'pl-5',
                heading.level === 2 && 'pl-3',
                active && 'bg-primary/8 text-foreground',
              )}
              onClick={() => onSelect(heading.id)}
            >
              {heading.text}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
```

**Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run src/features/articles/ArticleOutlineRail.test.tsx --project=jsdom --no-file-parallelism`

Expected: PASS，组件默认可见且点击跳转回调通过。

**Step 5: Commit**

```bash
git add src/features/articles/ArticleOutlineRail.tsx src/features/articles/ArticleOutlineRail.test.tsx
git commit -m "♻️ refactor(reader-outline): 重构常驻目录面板组件" \
  -m "- 移除 hover 展开轨道交互并改为常驻目录面板
- 添加当前项滚动可见与点击回调的组件测试"
```

### Task 3: 在 ArticleView 中接入浮层定位与显示规则

**Files:**

- Modify: `src/features/articles/ArticleView.tsx`
- Modify: `src/features/articles/ArticleView.outline.test.tsx`
- Modify: `src/features/articles/articleOutline.ts`

**Step 1: 写失败测试**

扩展 `src/features/articles/ArticleView.outline.test.tsx`，验证“长文章显示、短文章隐藏、点击跳转仍工作”：

```tsx
it('renders the outline panel for long articles without requiring hover', async () => {
  renderArticleViewWithHeadings();

  const scrollContainer = await screen.findByTestId('article-scroll-container');
  Object.defineProperty(scrollContainer, 'clientHeight', { configurable: true, value: 800 });

  const articleContent = await screen.findByTestId('article-html-content');
  Object.defineProperty(articleContent, 'scrollHeight', { configurable: true, value: 1400 });

  const contentShell = await screen.findByTestId('article-content-shell');
  contentShell.getBoundingClientRect = () => ({ left: 120, right: 820, top: 0, bottom: 0, width: 700, height: 1200, x: 120, y: 0, toJSON: () => ({}) });

  const articleViewport = await screen.findByTestId('article-viewport');
  articleViewport.getBoundingClientRect = () => ({ left: 0, right: 1120, top: 0, bottom: 900, width: 1120, height: 900, x: 0, y: 0, toJSON: () => ({}) });

  expect(await screen.findByRole('navigation', { name: '文章目录' })).toBeInTheDocument();
});

it('hides the outline panel for short articles even when headings exist', async () => {
  renderArticleViewWithHeadings();

  const scrollContainer = await screen.findByTestId('article-scroll-container');
  Object.defineProperty(scrollContainer, 'clientHeight', { configurable: true, value: 800 });

  const articleContent = await screen.findByTestId('article-html-content');
  Object.defineProperty(articleContent, 'scrollHeight', { configurable: true, value: 900 });

  expect(screen.queryByRole('navigation', { name: '文章目录' })).not.toBeInTheDocument();
});
```

**Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run src/features/articles/ArticleView.outline.test.tsx --project=jsdom --no-file-parallelism`

Expected: FAIL，旧实现仍在滚动容器中渲染轨道，且不会按文章长度隐藏。

**Step 3: 编写最小实现**

在 `ArticleView.tsx` 中新增一个固定附着层容器，并把目录移动到滚动容器外：

```tsx
const articleViewportRef = useRef<HTMLDivElement | null>(null);
const articleContentShellRef = useRef<HTMLDivElement | null>(null);
const [outlinePanelLayout, setOutlinePanelLayout] = useState({ visible: false, width: 0, right: 24 });

useEffect(() => {
  const scrollContainer = scrollContainerRef.current;
  const contentRoot = articleContentRef.current;
  const contentShell = articleContentShellRef.current;
  const articleViewport = articleViewportRef.current;
  if (!scrollContainer || !contentRoot || !contentShell || !articleViewport) return;

  const recompute = () => {
    const nextItems = extractArticleOutline(contentRoot);
    const canShow = shouldShowArticleOutline({
      headingCount: nextItems.length,
      contentHeight: Math.max(contentRoot.scrollHeight, contentRoot.clientHeight),
      viewportHeight: scrollContainer.clientHeight,
      isDesktop,
    });

    const contentRect = contentShell.getBoundingClientRect();
    const viewportRect = articleViewport.getBoundingClientRect();
    const nextLayout = buildArticleOutlinePanelLayout({
      viewportLeft: viewportRect.left,
      viewportRight: viewportRect.right,
      contentRight: contentRect.right,
    });

    setOutlineItems(nextItems);
    setOutlineHeadings(buildArticleOutlineMarkers(nextItems, contentRoot));
    setOutlinePanelLayout(canShow && nextLayout.visible ? nextLayout : { visible: false, width: 0, right: 24 });
    syncOutlineViewportAndActiveHeading(scrollContainer, nextItems);
  };

  const resizeObserver = new ResizeObserver(recompute);
  resizeObserver.observe(scrollContainer);
  resizeObserver.observe(contentRoot);
  resizeObserver.observe(contentShell);
  resizeObserver.observe(articleViewport);
  recompute();

  return () => resizeObserver.disconnect();
}, [article?.id, bodyHtml, isDesktop, syncOutlineViewportAndActiveHeading]);
```

同时调整 JSX 结构：

```tsx
<div className="flex h-full flex-col bg-background text-foreground">
  <div className="h-12 shrink-0" />
  <div ref={articleViewportRef} className="relative flex-1 overflow-hidden" data-testid="article-viewport">
    <div ref={scrollContainerRef} className="h-full overflow-y-auto" onScroll={onArticleScroll} data-testid="article-scroll-container">
      <div ref={articleContentShellRef} className="mx-auto max-w-3xl px-8 pb-12 pt-4" data-testid="article-content-shell">
        {/* title / meta / article body */}
      </div>
    </div>

    {outlinePanelLayout.visible ? (
      <div className="absolute top-6 z-20" style={{ right: outlinePanelLayout.right }}>
        <ArticleOutlineRail
          headings={outlineHeadings}
          activeHeadingId={activeHeadingId}
          onSelect={handleOutlineSelect}
          width={outlinePanelLayout.width}
          maxHeight={Math.max(240, (scrollContainerRef.current?.clientHeight ?? 0) - 96)}
        />
      </div>
    ) : null}
  </div>
</div>
```

**Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run src/features/articles/ArticleView.outline.test.tsx --project=jsdom --no-file-parallelism`

Expected: PASS，目录只在“够长 + 有 heading + 空白足够”时出现，并继续支持点击跳转。

**Step 5: Commit**

```bash
git add src/features/articles/ArticleView.tsx src/features/articles/ArticleView.outline.test.tsx src/features/articles/articleOutline.ts
git commit -m "✨ feat(reader-outline): 接入右侧常驻目录浮层" \
  -m "- 将目录移出正文滚动层并固定在阅读区右上角
- 接入短文章隐藏与右侧空白自适应显示规则"
```

### Task 4: 补齐回归测试并跑聚焦验证

**Files:**

- Modify: `src/features/articles/ArticleView.outline.test.tsx`
- Modify: `src/features/articles/ArticleOutlineRail.test.tsx`
- Modify: `src/features/articles/articleOutline.test.ts`

**Step 1: 写失败测试**

补充边界回归：

```tsx
it('hides the outline panel when the right-side gap becomes too small', async () => {
  renderArticleViewWithHeadings();

  const contentShell = await screen.findByTestId('article-content-shell');
  contentShell.getBoundingClientRect = () => ({ left: 80, right: 930, top: 0, bottom: 0, width: 850, height: 1200, x: 80, y: 0, toJSON: () => ({}) });

  const articleViewport = await screen.findByTestId('article-viewport');
  articleViewport.getBoundingClientRect = () => ({ left: 0, right: 1040, top: 0, bottom: 900, width: 1040, height: 900, x: 0, y: 0, toJSON: () => ({}) });

  expect(screen.queryByRole('navigation', { name: '文章目录' })).not.toBeInTheDocument();
});
```

**Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run src/features/articles/articleOutline.test.ts src/features/articles/ArticleOutlineRail.test.tsx src/features/articles/ArticleView.outline.test.tsx --project=jsdom --no-file-parallelism`

Expected: FAIL，至少一个新边界断言未覆盖。

**Step 3: 编写最小实现**

根据失败结果收紧 helper 与组件细节：

```ts
export function buildArticleOutlinePanelLayout(input: LayoutInput) {
  const availableWidth = input.viewportRight - input.contentRight - OUTLINE_PANEL_GAP_PX - OUTLINE_PANEL_RIGHT_PADDING_PX;

  if (!Number.isFinite(availableWidth) || availableWidth < OUTLINE_PANEL_HIDE_THRESHOLD_PX) {
    return { visible: false as const, width: 0, right: OUTLINE_PANEL_RIGHT_PADDING_PX };
  }

  return {
    visible: true as const,
    width: Math.min(OUTLINE_PANEL_MAX_WIDTH_PX, Math.max(OUTLINE_PANEL_MIN_WIDTH_PX, availableWidth)),
    right: OUTLINE_PANEL_RIGHT_PADDING_PX,
  };
}
```

**Step 4: 运行聚焦测试确认通过**

Run: `pnpm exec vitest run src/features/articles/articleOutline.test.ts src/features/articles/ArticleOutlineRail.test.tsx src/features/articles/ArticleView.outline.test.tsx --project=jsdom --no-file-parallelism`

Expected: PASS，目录显示规则、组件交互与 `ArticleView` 集成测试全部通过。

**Step 5: 运行更广验证**

Run: `pnpm run test:unit -- src/features/articles/articleOutline.test.ts src/features/articles/ArticleOutlineRail.test.tsx src/features/articles/ArticleView.outline.test.tsx`

Expected: PASS，且不引入与目录无关的新失败。

**Step 6: Commit**

```bash
git add src/features/articles/articleOutline.test.ts src/features/articles/ArticleOutlineRail.test.tsx src/features/articles/ArticleView.outline.test.tsx
git commit -m "✅ test(reader-outline): 补齐目录重设计回归覆盖" \
  -m "- 添加右侧空白不足与短文章隐藏的集成回归测试
- 验证常驻目录面板与点击跳转行为稳定"
```

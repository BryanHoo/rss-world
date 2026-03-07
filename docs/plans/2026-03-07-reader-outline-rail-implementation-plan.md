# Reader Outline Rail Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** Add a narrow floating outline rail inside the reader pane that shows reading progress and heading distribution, expands on hover into a small table of contents, and hides entirely when the article body has no `h1/h2/h3`.

**Architecture:** Build a local `ArticleOutlineRail` component inside `ArticleView`, derive headings from rendered article HTML, and use `article-scroll-container` as the only scroll source. Keep heading extraction, active-heading calculation, hover state, and resize/scroll observers local to the article pane so the feature does not add global store churn and stays compatible with fulltext and immersive translation rerenders.

**Tech Stack:** React 19, Next.js client components, Tailwind CSS, Vitest, Testing Library, JSDOM, `pnpm`

---

## Relevant Context To Read First

- Design doc: [`docs/plans/2026-03-07-reader-outline-rail-design.md`](./2026-03-07-reader-outline-rail-design.md)
- Prior learning: [`docs/summaries/2026-03-06-reader-resizable-three-column-layout.md`](../summaries/2026-03-06-reader-resizable-three-column-layout.md)
- Prior learning: [`docs/summaries/2026-03-05-translation-preserve-html-structure.md`](../summaries/2026-03-05-translation-preserve-html-structure.md)
- Prior learning: [`docs/summaries/2026-03-06-middle-column-image-loading.md`](../summaries/2026-03-06-middle-column-image-loading.md)

## Implementation Notes

- Keep the first version scoped to `h1/h2/h3` only.
- Do not put outline state into `useAppStore` or `useSettingsStore`.
- Use the rendered article DOM as the source of truth; do not build a second outline model from article metadata.
- Prefer small, deterministic helpers for anchor/id generation and marker position calculation so tests stay simple.

### Task 1: Add outline extraction helpers

**Files:**

- Create: `src/features/articles/articleOutline.ts`
- Create: `src/features/articles/articleOutline.test.ts`

**Step 1: Write the failing test**

Create `src/features/articles/articleOutline.test.ts` with focused cases for heading extraction and anchor generation:

```tsx
import { describe, expect, it } from 'vitest';
import { extractArticleOutline } from './articleOutline';

describe('extractArticleOutline', () => {
  it('extracts only h1 h2 h3 and assigns stable unique ids', () => {
    document.body.innerHTML = `
      <div>
        <h2>Overview</h2>
        <p>Body</p>
        <h4>Ignore me</h4>
        <h2>Overview</h2>
        <h3>Details</h3>
      </div>
    `;

    const root = document.body.firstElementChild as HTMLElement;
    const outline = extractArticleOutline(root);

    expect(outline.map((item) => item.level)).toEqual([2, 2, 3]);
    expect(outline.map((item) => item.text)).toEqual(['Overview', 'Overview', 'Details']);
    expect(outline.map((item) => item.id)).toEqual([
      'article-outline-overview',
      'article-outline-overview-2',
      'article-outline-details',
    ]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/features/articles/articleOutline.test.ts --project=jsdom --no-file-parallelism`

Expected: FAIL with `Cannot find module './articleOutline'` or `extractArticleOutline is not defined`.

**Step 3: Write minimal implementation**

Create `src/features/articles/articleOutline.ts` with deterministic extraction and slugging helpers:

```ts
export interface ArticleOutlineItem {
  id: string;
  level: 1 | 2 | 3;
  text: string;
  element: HTMLHeadingElement;
}

const selector = 'h1, h2, h3';

function slugifyHeading(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

export function extractArticleOutline(root: HTMLElement): ArticleOutlineItem[] {
  const seen = new Map<string, number>();

  return Array.from(root.querySelectorAll<HTMLHeadingElement>(selector)).flatMap((element) => {
    const text = element.textContent?.trim() ?? '';
    if (!text) return [];

    const base = `article-outline-${slugifyHeading(text)}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    const id = count === 1 ? base : `${base}-${count}`;

    if (!element.id) element.id = id;

    return [{ id: element.id, level: Number(element.tagName[1]) as 1 | 2 | 3, text, element }];
  });
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/features/articles/articleOutline.test.ts --project=jsdom --no-file-parallelism`

Expected: PASS with `1 passed`.

**Step 5: Commit**

```bash
git add src/features/articles/articleOutline.ts src/features/articles/articleOutline.test.ts
git commit -m "✨ feat(reader-outline): 添加目录提取工具" \
  -m "- 添加正文 heading 提取与稳定锚点生成逻辑
- 添加重复标题与过滤非目标 heading 的回归测试"
```

### Task 2: Build the collapsed rail and hover card shell

**Files:**

- Create: `src/features/articles/ArticleOutlineRail.tsx`
- Create: `src/features/articles/ArticleOutlineRail.test.tsx`
- Modify: `src/features/articles/articleOutline.ts`

**Step 1: Write the failing test**

Create `src/features/articles/ArticleOutlineRail.test.tsx` to verify hide/show and hover expansion behavior:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ArticleOutlineRail from './ArticleOutlineRail';

const headings = [
  { id: 'article-outline-overview', level: 2 as const, text: 'Overview', topRatio: 0.1 },
  { id: 'article-outline-details', level: 3 as const, text: 'Details', topRatio: 0.6 },
];

describe('ArticleOutlineRail', () => {
  it('does not render when headings are empty', () => {
    const { container } = render(
      <ArticleOutlineRail headings={[]} activeHeadingId={null} viewport={{ top: 0, height: 1 }} onSelect={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('expands the card on hover', () => {
    render(
      <ArticleOutlineRail headings={headings} activeHeadingId="article-outline-overview" viewport={{ top: 0.1, height: 0.25 }} onSelect={vi.fn()} />,
    );

    fireEvent.mouseEnter(screen.getByTestId('article-outline-rail'));

    expect(screen.getByRole('navigation', { name: '文章目录' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/features/articles/ArticleOutlineRail.test.tsx --project=jsdom --no-file-parallelism`

Expected: FAIL with `Cannot find module './ArticleOutlineRail'`.

**Step 3: Write minimal implementation**

Create `src/features/articles/ArticleOutlineRail.tsx` with a collapsed rail, marker rendering, hover state, and left-expanding card shell:

```tsx
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export default function ArticleOutlineRail({ headings, activeHeadingId, viewport, onSelect }) {
  const [expanded, setExpanded] = useState(false);

  if (headings.length === 0) return null;

  return (
    <div
      className="absolute inset-y-20 right-2 z-20 flex items-start"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div data-testid="article-outline-rail" className="relative h-40 w-2 rounded-full bg-background/60">
        <div className="absolute inset-x-0 rounded-full bg-primary/20" style={{ top: `${viewport.top * 100}%`, height: `${viewport.height * 100}%` }} />
        {headings.map((heading) => (
          <div key={heading.id} className="absolute inset-x-0 h-1 rounded-full bg-border" style={{ top: `${heading.topRatio * 100}%` }} />
        ))}
      </div>

      {expanded ? (
        <nav aria-label="文章目录" className="mr-2 w-56 rounded-xl border bg-background/95 p-2 shadow-lg backdrop-blur-sm">
          {headings.map((heading) => (
            <button key={heading.id} type="button" className={cn('block w-full truncate text-left', activeHeadingId === heading.id && 'text-primary')} onClick={() => onSelect(heading.id)}>
              {heading.text}
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/features/articles/ArticleOutlineRail.test.tsx --project=jsdom --no-file-parallelism`

Expected: PASS with `2 passed`.

**Step 5: Commit**

```bash
git add src/features/articles/ArticleOutlineRail.tsx src/features/articles/ArticleOutlineRail.test.tsx src/features/articles/articleOutline.ts
git commit -m "✨ feat(reader-outline): 添加悬浮目录轨道组件" \
  -m "- 添加收起态轨道与展开态目录卡片壳层
- 添加 hover 展开与无标题隐藏的组件测试"
```

### Task 3: Integrate the rail into ArticleView and sync with article scroll

**Files:**

- Modify: `src/features/articles/ArticleView.tsx`
- Create: `src/features/articles/ArticleView.outline.test.tsx`
- Modify: `src/features/articles/ArticleOutlineRail.tsx`
- Modify: `src/features/articles/articleOutline.ts`

**Step 1: Write the failing test**

Create `src/features/articles/ArticleView.outline.test.tsx` with an article containing headings and a mocked scroll container:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ArticleView from './ArticleView';
import { useAppStore } from '../../store/appStore';
import { useSettingsStore } from '../../store/settingsStore';
import { defaultPersistedSettings } from '../settings/settingsSchema';

describe('ArticleView outline rail', () => {
  beforeEach(() => {
    useSettingsStore.setState((state) => ({ ...state, persistedSettings: structuredClone(defaultPersistedSettings) }));
    useAppStore.setState({
      feeds: [{ id: 'feed-1', title: 'Feed 1', url: 'https://example.com/rss.xml', unreadCount: 0, enabled: true, fullTextOnOpenEnabled: false, aiSummaryOnOpenEnabled: false, categoryId: 'cat-uncategorized', category: '未分类' }],
      categories: [{ id: 'cat-uncategorized', name: '未分类', expanded: true }],
      articles: [{ id: 'article-1', feedId: 'feed-1', title: 'Article 1', content: '<h2>Overview</h2><p>A</p><h3>Details</h3><p>B</p>', summary: 'summary', publishedAt: new Date().toISOString(), link: 'https://example.com/a1', isRead: true, isStarred: false }],
      selectedView: 'all',
      selectedArticleId: 'article-1',
    });
  });

  it('renders the outline rail when the article body contains headings', async () => {
    render(<ArticleView />);
    expect(await screen.findByTestId('article-outline-rail')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/features/articles/ArticleView.outline.test.tsx --project=jsdom --no-file-parallelism`

Expected: FAIL because `ArticleView` does not render the outline rail yet.

**Step 3: Write minimal implementation**

Update `src/features/articles/ArticleView.tsx` to:

```tsx
const scrollContainerRef = useRef<HTMLDivElement | null>(null);
const articleContentRef = useRef<HTMLDivElement | null>(null);
const [outlineHeadings, setOutlineHeadings] = useState<ArticleOutlineHeading[]>([]);
const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
const [viewport, setViewport] = useState({ top: 0, height: 1 });

useLayoutEffect(() => {
  if (!articleContentRef.current) {
    setOutlineHeadings([]);
    return;
  }

  setOutlineHeadings(extractArticleOutline(articleContentRef.current));
}, [article?.id, bodyHtml]);

const onArticleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
  const element = event.currentTarget;
  const nextViewport = {
    top: element.scrollTop / Math.max(1, element.scrollHeight - element.clientHeight),
    height: element.clientHeight / Math.max(element.scrollHeight, element.clientHeight),
  };

  setViewport(nextViewport);
  reportTitleVisibility(element.scrollTop <= FLOATING_TITLE_SCROLL_THRESHOLD_PX);
}, [reportTitleVisibility]);

<div ref={scrollContainerRef} className="flex-1 overflow-y-auto" onScroll={onArticleScroll} data-testid="article-scroll-container">
  <div className="mx-auto max-w-3xl px-8 pb-12 pt-4">
    …
    <div ref={articleContentRef} data-testid="article-html-content" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
  </div>

  <ArticleOutlineRail headings={outlineHeadings} activeHeadingId={activeHeadingId} viewport={viewport} onSelect={handleOutlineSelect} />
</div>
```

Then add a small effect that computes `activeHeadingId` from the current headings plus scroll position. Start simple by checking the last heading whose `offsetTop` is above the visible top threshold.

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/features/articles/ArticleView.outline.test.tsx --project=jsdom --no-file-parallelism`

Expected: PASS with `1 passed`.

**Step 5: Commit**

```bash
git add src/features/articles/ArticleView.tsx src/features/articles/ArticleView.outline.test.tsx src/features/articles/ArticleOutlineRail.tsx src/features/articles/articleOutline.ts
git commit -m "✨ feat(reader-outline): 集成阅读栏浮动目录" \
  -m "- 在正文滚动容器内挂载目录轨道并同步视口进度
- 添加 ArticleView 目录显示回归测试"
```

### Task 4: Add hover polish, click-to-scroll, and rerender regressions

**Files:**

- Modify: `src/features/articles/ArticleOutlineRail.tsx`
- Modify: `src/features/articles/ArticleView.tsx`
- Modify: `src/features/articles/ArticleView.outline.test.tsx`

**Step 1: Write the failing test**

Extend `src/features/articles/ArticleView.outline.test.tsx` to cover hover expansion, click jump, and body HTML rerender:

```tsx
it('scrolls the article container when an outline item is clicked', async () => {
  render(<ArticleView />);

  const scrollContainer = await screen.findByTestId('article-scroll-container');
  const scrollTo = vi.fn();
  Object.defineProperty(scrollContainer, 'scrollTo', { value: scrollTo, configurable: true });

  fireEvent.mouseEnter(screen.getByTestId('article-outline-rail'));
  fireEvent.click(await screen.findByRole('button', { name: 'Details' }));

  expect(scrollTo).toHaveBeenCalled();
});

it('rebuilds the outline when the rendered body html changes', async () => {
  const { rerender } = render(<ArticleView />);
  expect(await screen.findByRole('button', { name: 'Overview' })).toBeInTheDocument();

  useAppStore.setState((state) => ({
    ...state,
    articles: state.articles.map((article) =>
      article.id === 'article-1'
        ? { ...article, content: '<h2>Fresh heading</h2><p>Updated</p>' }
        : article,
    ),
  }));

  rerender(<ArticleView />);

  fireEvent.mouseEnter(screen.getByTestId('article-outline-rail'));
  expect(await screen.findByRole('button', { name: 'Fresh heading' })).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/features/articles/ArticleView.outline.test.tsx --project=jsdom --no-file-parallelism`

Expected: FAIL because click-scroll and rerender handling are incomplete.

**Step 3: Write minimal implementation**

Tighten the integration code:

```tsx
const closeTimerRef = useRef<number | null>(null);

const handleOutlineSelect = useCallback((headingId: string) => {
  const scrollContainer = scrollContainerRef.current;
  const contentRoot = articleContentRef.current;
  if (!scrollContainer || !contentRoot) return;

  const target = contentRoot.querySelector<HTMLElement>(`#${CSS.escape(headingId)}`);
  if (!target) return;

  const top = Math.max(0, target.offsetTop - 24);
  scrollContainer.scrollTo({ top, behavior: 'smooth' });
}, []);

useEffect(() => {
  const scrollContainer = scrollContainerRef.current;
  if (!scrollContainer) return;

  const recompute = () => {
    setOutlineHeadings(extractArticleOutline(articleContentRef.current!));
    syncViewportAndActiveHeading(scrollContainer);
  };

  const resizeObserver = new ResizeObserver(recompute);
  if (articleContentRef.current) resizeObserver.observe(articleContentRef.current);
  resizeObserver.observe(scrollContainer);
  return () => resizeObserver.disconnect();
}, [article?.id, bodyHtml, syncViewportAndActiveHeading]);
```

Also add a small delayed-close interaction in `ArticleOutlineRail` so moving from the rail into the card does not flicker.

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/features/articles/ArticleView.outline.test.tsx src/features/articles/ArticleOutlineRail.test.tsx --project=jsdom --no-file-parallelism`

Expected: PASS with all outline-related tests green.

**Step 5: Commit**

```bash
git add src/features/articles/ArticleOutlineRail.tsx src/features/articles/ArticleView.tsx src/features/articles/ArticleView.outline.test.tsx
git commit -m "✨ feat(reader-outline): 完善目录悬浮交互与跳转" \
  -m "- 添加目录项点击滚动与正文重渲染后的重建逻辑
- 优化 hover 收起时机并补充相关回归测试"
```

### Task 5: Run targeted verification and update summary

**Files:**

- Modify: `docs/summaries/2026-03-07-reader-outline-rail.md`

**Step 1: Write the failing test**

There is no new failing test in this task. Instead, confirm the focused suites listed below all exist and cover the feature.

**Step 2: Run verification commands**

Run: `pnpm exec vitest run src/features/articles/articleOutline.test.ts src/features/articles/ArticleOutlineRail.test.tsx src/features/articles/ArticleView.outline.test.tsx --project=jsdom --no-file-parallelism`

Expected: PASS with all new outline-related tests green.

Run: `pnpm run lint`

Expected: PASS with no lint errors.

**Step 3: Write the summary doc**

Create `docs/summaries/2026-03-07-reader-outline-rail.md` capturing:

- What shipped and why this interaction was chosen
- Which prior learnings influenced the implementation
- Which tests verify heading extraction, hover interaction, click scroll, and rerender safety

Suggested opening structure:

```md
# 2026-03-07 阅读栏浮动目录

## Context

- Branch: `<current-branch>`
- Related plan: `docs/plans/2026-03-07-reader-outline-rail-implementation-plan.md`
```

**Step 4: Re-run verification after summary update**

Run: `pnpm exec vitest run src/features/articles/articleOutline.test.ts src/features/articles/ArticleOutlineRail.test.tsx src/features/articles/ArticleView.outline.test.tsx --project=jsdom --no-file-parallelism`

Expected: PASS again.

**Step 5: Commit**

```bash
git add src/features/articles/articleOutline.ts src/features/articles/articleOutline.test.ts src/features/articles/ArticleOutlineRail.tsx src/features/articles/ArticleOutlineRail.test.tsx src/features/articles/ArticleView.tsx src/features/articles/ArticleView.outline.test.tsx docs/summaries/2026-03-07-reader-outline-rail.md
git commit -m "✨ feat(reader-outline): 添加阅读栏浮动目录" \
  -m "- 添加正文目录轨道与 hover 展开目录卡片
- 添加滚动同步、点击跳转与正文重建回归测试
- 更新实现总结以沉淀设计与验证证据"
```

## Execution Guardrails

- Follow TDD strictly: do not write implementation before the failing test for the current task exists.
- Keep the feature local to the article pane; avoid new app-wide store fields.
- Reuse existing utility patterns and testing style from `src/features/articles/ArticleView.aiTranslate.test.tsx` and `src/features/articles/ArticleView.titleLink.test.tsx`.
- Stop after each task commit and confirm the repo is still clean except for the next task.

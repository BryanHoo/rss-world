# Reader Toolbar Unification Implementation Plan

> **For agentic workers:** REQUIRED: Use workflow-subagent-driven-development (if subagents available) or workflow-executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一桌面端 reader 中栏与右栏顶部工具条的视觉和交互；将右栏文章动作迁到固定顶栏，并保持移动端文章阅读布局不变。

**Architecture:** 先在 reader feature 内新增一个共享的 `ReaderToolbarIconButton` 原语，统一 `Button + Tooltip + 中文 aria-label + disabled tooltip wrapper`，再分两步接入中栏和桌面端右栏。`ArticleView` 负责桌面端右栏顶栏与文章动作，`ReaderLayout` 只负责外层布局和移除桌面端旧的悬浮设置按钮 / floating title 逻辑，避免把文章详情状态上提。

**Tech Stack:** Next.js App Router, React, Tailwind CSS v4, shadcn/ui, Radix Tooltip, Vitest, Testing Library, Lucide

---

## Context To Carry Forward

- 已批准的 spec 在 `docs/superpowers/specs/2026-03-12-reader-toolbar-unification-design.md`；实现必须遵守这些硬约束：
  - 只在桌面端统一中栏与右栏顶部工具条
  - 移动端和平板窄屏保持当前阅读结构与正文内动作按钮不变
  - 不改 `收藏`、`抓取全文`、`翻译`、`生成摘要` 的业务判断、API 调用链和 hook 状态机
- `docs/summaries/2026-03-11-accessible-name-token-leak.md` 已确认图标按钮必须继续保留中文 `aria-label`；tooltip 只是视觉提示，不能替代语义名称。任何测试都应继续按中文用户文案断言。
- `docs/summaries/2026-03-12-reader-visible-refresh-resets-selected-article-detail.md` 已记录右栏详情态和滚动位置不能被 reader 外层刷新逻辑破坏；因此动作 handler 和文章详情状态必须继续留在 `ArticleView` / 现有 hooks 中，不要为了 toolbar 迁移把它们搬到 `ReaderLayout`。
- `docs/summaries/2026-03-11-streaming-summary-switch-loss-and-force-duplicate.md` 已记录流式摘要状态按 `articleId` 缓存；实现 toolbar 时不要改 `useStreamingAiSummary`、`requestStreamingAiSummary`、`onAiSummaryButtonClick` 的语义，只移动入口。
- 本地最接近的 tooltip 交互参考在 `src/features/feeds/FeedList.tsx`：错误 tooltip 已经使用 `TooltipProvider + TooltipTrigger asChild + 外层 span` 的模式；这也是 disabled 按钮 tooltip 的最佳参考。
- 当前代码里与本轮直接相关的现状：
  - `src/features/articles/ArticleList.tsx` 顶部按钮是 icon-only，但主要依赖 `title`
  - `src/features/articles/ArticleView.tsx` 在正文标题下方渲染四个带文字动作按钮
  - `src/features/reader/ReaderLayout.tsx` 负责桌面端悬浮设置按钮与 `reader-floating-title`
  - `src/components/ui/tooltip.tsx` 已提供现成的 shadcn/Radix Tooltip 封装
- 现有测试切入点：
  - `src/features/articles/ArticleList.test.tsx` 已覆盖中栏标题和顶部按钮可用性
  - `src/features/articles/ArticleView.aiSummary.test.tsx` 已覆盖右栏动作按钮与 AI 摘要交互，其中现有“hover tip 不显示”用例需要改成 tooltip 回归
  - `src/features/reader/ReaderLayout.test.tsx` 已 mock `ArticleView` 并覆盖桌面/移动端布局差异、设置打开与 floating title
- 相关技能与约束：
  - `@shadcn-ui`：优先复用现有 Tooltip 原语，不要再造另一套 tooltip 组件
  - `@vitest`：按 TDD 补最小必要回归，优先断言用户可见行为和中文语义
  - `@vercel-react-best-practices`：`ArticleView` 保持业务 handler 在本地，不把文章详情状态上提到 `ReaderLayout`

## File Map

### Create

- `src/features/reader/ReaderToolbarIconButton.tsx`
  - reader 共享 icon toolbar 按钮原语，统一 icon-only 按钮样式、中文 tooltip、pressed/disabled 状态和 disabled 时的 tooltip trigger wrapper
- `src/features/reader/ReaderToolbarIconButton.test.tsx`
  - 原语级 contract 测试，锁住 `aria-label`、tooltip、pressed class 和 disabled tooltip 行为

### Modify

- `src/features/articles/ArticleList.tsx`
  - 中栏顶部按钮改用 `ReaderToolbarIconButton`，移除原生 `title` 依赖
- `src/features/articles/ArticleList.test.tsx`
  - 增加中栏 tooltip 和无 `title` 依赖的回归断言
- `src/features/articles/ArticleView.tsx`
  - 新增桌面端固定顶栏；接收 `onOpenSettings`；桌面端迁移动作按钮，非桌面保留原正文内按钮
- `src/features/articles/ArticleView.aiSummary.test.tsx`
  - 更新右栏动作相关测试，锁住桌面端顶栏、tooltip、设置回调和非桌面不变
- `src/features/reader/ReaderLayout.tsx`
  - 删除桌面端悬浮设置按钮和 floating title；把设置回调传给 `ArticleView`
- `src/features/reader/ReaderLayout.test.tsx`
  - 更新 mock `ArticleView` 以接收 `onOpenSettings`，并覆盖桌面端不再渲染 `reader-floating-title` / 独立悬浮设置按钮

### Reuse Without Modification

- `src/components/ui/button.tsx`
- `src/components/ui/tooltip.tsx`
- `src/features/feeds/FeedList.tsx`

这些文件分别提供现成的按钮密度、Tooltip 封装和 disabled tooltip wrapper 参考；本轮默认不改。

## Chunk 1: Shared Reader Toolbar Primitive

### Task 1: 建立 `ReaderToolbarIconButton` contract 并实现共享原语

**Files:**

- Create: `src/features/reader/ReaderToolbarIconButton.test.tsx`
- Create: `src/features/reader/ReaderToolbarIconButton.tsx`
- Read: `src/components/ui/button.tsx`
- Read: `src/components/ui/tooltip.tsx`
- Read: `src/features/feeds/FeedList.tsx`

- [ ] **Step 1: 先写会失败的原语级 contract 测试**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sparkles } from 'lucide-react';
import ReaderToolbarIconButton from './ReaderToolbarIconButton';

describe('ReaderToolbarIconButton', () => {
  it('shows a Chinese tooltip and keeps aria-label semantics', async () => {
    const onClick = vi.fn();

    render(
      <ReaderToolbarIconButton
        icon={Sparkles}
        label="生成摘要"
        onClick={onClick}
      />,
    );

    const button = screen.getByRole('button', { name: '生成摘要' });
    expect(button).not.toHaveAttribute('title');

    fireEvent.mouseEnter(button);
    expect(await screen.findByText('生成摘要')).toBeInTheDocument();

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps tooltip available even when the button is disabled', async () => {
    render(
      <ReaderToolbarIconButton
        icon={Sparkles}
        label="生成摘要"
        disabled
      />,
    );

    const button = screen.getByRole('button', { name: '生成摘要' });
    expect(button).toBeDisabled();

    fireEvent.mouseEnter(button.parentElement as HTMLElement);
    expect(await screen.findByText('生成摘要')).toBeInTheDocument();
  });

  it('renders pressed state with reader active styling', () => {
    render(
      <ReaderToolbarIconButton
        icon={Sparkles}
        label="仅显示未读文章"
        pressed
      />,
    );

    expect(screen.getByRole('button', { name: '仅显示未读文章' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm exec vitest run src/features/reader/ReaderToolbarIconButton.test.tsx`
Expected: FAIL，报错 `ReaderToolbarIconButton` 文件不存在

- [ ] **Step 3: 写最小实现，统一 reader 顶部 icon button + tooltip**

```tsx
// src/features/reader/ReaderToolbarIconButton.tsx
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type ReaderToolbarIconButtonProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  iconClassName?: string;
};

export default function ReaderToolbarIconButton({
  icon: Icon,
  label,
  pressed = false,
  disabled = false,
  onClick,
  className,
  iconClassName,
}: ReaderToolbarIconButtonProps) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'h-6 w-6 text-muted-foreground',
        pressed && 'bg-primary/10 text-primary hover:bg-primary/15',
        className,
      )}
      aria-label={label}
      aria-pressed={pressed || undefined}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className={cn('h-3.5 w-3.5', iconClassName)} />
    </Button>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{button}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

- [ ] **Step 4: 运行原语测试并确认通过**

Run: `pnpm exec vitest run src/features/reader/ReaderToolbarIconButton.test.tsx`
Expected: PASS，3 tests passed

- [ ] **Step 5: 提交原语与 contract**

```bash
git add src/features/reader/ReaderToolbarIconButton.tsx src/features/reader/ReaderToolbarIconButton.test.tsx
git commit -m "feat(reader): 添加工具条图标按钮原语" -m "- 添加统一的 reader 图标按钮与 tooltip 封装\n- 保留中文 aria-label 与 pressed 语义\n- 锁定 disabled 按钮仍可展示 tooltip 的契约"
```

### Task 2: 先写中栏 tooltip 回归，再把 `ArticleList` 顶部按钮迁到共享原语

**Files:**

- Modify: `src/features/articles/ArticleList.test.tsx`
- Modify: `src/features/articles/ArticleList.tsx`
- Read: `src/features/reader/ReaderToolbarIconButton.tsx`

- [ ] **Step 1: 在 `ArticleList.test.tsx` 先加失败用例**

```tsx
it('uses reader toolbar tooltips for middle-pane icon actions', async () => {
  useAppStore.setState({ selectedView: 'feed-1' });

  renderWithNotifications();

  const refreshButton = screen.getByRole('button', { name: '刷新订阅源' });
  const displayModeButton = screen.getByRole('button', { name: '切换为列表' });

  expect(refreshButton).not.toHaveAttribute('title');
  expect(displayModeButton).not.toHaveAttribute('title');

  fireEvent.mouseEnter(refreshButton);
  expect(await screen.findByText('刷新订阅源')).toBeInTheDocument();

  fireEvent.mouseEnter(displayModeButton);
  expect(await screen.findByText('切换为列表')).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行中栏测试并确认失败**

Run: `pnpm exec vitest run src/features/articles/ArticleList.test.tsx -t "uses reader toolbar tooltips for middle-pane icon actions"`
Expected: FAIL，按钮仍带 `title`，且不会渲染 Radix tooltip

- [ ] **Step 3: 用共享原语替换中栏顶部按钮**

```tsx
// src/features/articles/ArticleList.tsx
import ReaderToolbarIconButton from '../reader/ReaderToolbarIconButton';

<div className="shrink-0 flex items-center gap-2">
  <ReaderToolbarIconButton
    icon={RefreshCw}
    label={refreshButtonTitle}
    disabled={!canRefresh}
    onClick={onRefreshClick}
    iconClassName={refreshing ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'}
  />
  {!isAggregateView && selectedFeed ? (
    <ReaderToolbarIconButton
      icon={effectiveDisplayMode === 'card' ? List : LayoutGrid}
      label={displayModeButtonTitle}
      disabled={displayModeSaving}
      pressed={effectiveDisplayMode === 'list'}
      onClick={onToggleDisplayMode}
    />
  ) : null}
  {showHeaderActions ? (
    <>
      <ReaderToolbarIconButton
        icon={CircleDot}
        label={unreadOnlyButtonLabel}
        pressed={showUnreadOnly}
        onClick={toggleShowUnreadOnly}
      />
      <ReaderToolbarIconButton
        icon={CheckCheck}
        label="标记全部为已读"
        onClick={handleMarkAllAsRead}
      />
    </>
  ) : null}
</div>
```

注意：

- 中栏顶部只迁移图标按钮，不改 `articleCount` 和标题结构
- `heading` 现有 `title={headerTitle}` 是长标题兜底，不属于本轮 tooltip 统一范围，保留即可
- 不要把 `TooltipProvider` 再包一层到整页外部，先用共享原语内部 provider 保持实现最小

- [ ] **Step 4: 运行中栏回归并确认通过**

Run: `pnpm exec vitest run src/features/articles/ArticleList.test.tsx src/features/reader/ReaderToolbarIconButton.test.tsx`
Expected: PASS，中栏按钮 tooltip 可见，长标题 `title` 用例继续通过

- [ ] **Step 5: 提交中栏迁移**

```bash
git add src/features/articles/ArticleList.tsx src/features/articles/ArticleList.test.tsx
git commit -m "refactor(reader): 统一中栏顶部图标按钮" -m "- 让中栏顶部动作复用共享 reader toolbar 原语\n- 用 shadcn tooltip 替换按钮 title 提示\n- 保留中文 aria-label 与现有激活态表达"
```

## Chunk 2: Desktop Right Pane Toolbar

### Task 3: 先写 `ArticleView` 桌面端顶栏回归，再实现桌面迁移动作

**Files:**

- Modify: `src/features/articles/ArticleView.aiSummary.test.tsx`
- Modify: `src/features/articles/ArticleView.tsx`
- Read: `src/features/reader/ReaderToolbarIconButton.tsx`

- [ ] **Step 1: 在 `ArticleView.aiSummary.test.tsx` 先补桌面端/非桌面端回归**

```tsx
it('moves desktop article actions into a fixed toolbar and keeps settings callback wired', async () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  const onOpenSettings = vi.fn();
  await seedArticleViewState();

  render(<ArticleView onOpenSettings={onOpenSettings} />);

  expect(screen.queryByText('抓取全文')).not.toBeInTheDocument();
  expect(screen.queryByText('生成摘要')).not.toBeInTheDocument();

  const settingsButton = await screen.findByRole('button', { name: '打开设置' });
  fireEvent.mouseEnter(settingsButton.parentElement as HTMLElement);
  expect(await screen.findByText('打开设置')).toBeInTheDocument();

  fireEvent.click(settingsButton);
  expect(onOpenSettings).toHaveBeenCalledTimes(1);
});

it('keeps inline text action buttons on non-desktop article view', async () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  await seedArticleViewState();

  render(<ArticleView reserveTopSpace={false} />);

  expect(await screen.findByText('抓取全文')).toBeInTheDocument();
  expect(screen.getByText('生成摘要')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '打开设置' })).not.toBeInTheDocument();
});
```

把现有这条测试直接改写，不要保留旧语义：

- `src/features/articles/ArticleView.aiSummary.test.tsx:731`
  - 现有“`三个操作按钮都不显示 hover tip`”与新设计冲突，应改成“桌面端按钮显示统一 tooltip”

- [ ] **Step 2: 运行 `ArticleView` 测试并确认失败**

Run: `pnpm exec vitest run src/features/articles/ArticleView.aiSummary.test.tsx -t "moves desktop article actions into a fixed toolbar"`
Expected: FAIL，`ArticleView` 还没有 `onOpenSettings`，也仍在正文里渲染文字按钮

- [ ] **Step 3: 在 `ArticleView` 内实现桌面端固定顶栏，非桌面保持原动作行**

```tsx
// src/features/articles/ArticleView.tsx
import { FileText, Languages, Settings as SettingsIcon, Sparkles, Star } from 'lucide-react';
import ReaderToolbarIconButton from '../reader/ReaderToolbarIconButton';

interface ArticleViewProps {
  onOpenSettings?: () => void;
  onTitleVisibilityChange?: (isVisible: boolean) => void;
  reserveTopSpace?: boolean;
  renderedAt?: string;
}

const showDesktopToolbar = reserveTopSpace && isDesktop;

function renderDesktopToolbar() {
  return (
    <div className="flex h-12 min-w-0 items-center justify-between gap-3 border-b px-4">
      <div className="min-w-0 flex-1">
        {article?.link ? (
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate rounded-sm text-[0.96rem] font-semibold tracking-[0.01em] underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {titleOriginal}
          </a>
        ) : (
          <span className="block truncate text-[0.96rem] font-semibold tracking-[0.01em] text-foreground">
            {article ? titleOriginal : '选择文章后可查看内容'}
          </span>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <ReaderToolbarIconButton
          icon={Star}
          label={article?.isStarred ? '已收藏' : '收藏'}
          pressed={Boolean(article?.isStarred)}
          disabled={!article}
          onClick={article ? () => toggleStar(article.id) : undefined}
        />
        <ReaderToolbarIconButton
          icon={FileText}
          label="抓取全文"
          disabled={!article || fulltextButtonDisabled}
          onClick={article ? onFulltextButtonClick : undefined}
        />
        {bodyTranslationEligible ? (
          <ReaderToolbarIconButton
            icon={Languages}
            label="翻译"
            disabled={!article}
            onClick={article ? onAiTranslationButtonClick : undefined}
          />
        ) : null}
        <ReaderToolbarIconButton
          icon={Sparkles}
          label="生成摘要"
          disabled={!article || aiSummaryButtonDisabled}
          onClick={article ? onAiSummaryButtonClick : undefined}
        />
        <ReaderToolbarIconButton
          icon={SettingsIcon}
          label="打开设置"
          onClick={onOpenSettings}
        />
      </div>
    </div>
  );
}

return (
  <div className="flex h-full flex-col bg-background text-foreground">
    {showDesktopToolbar ? renderDesktopToolbar() : reserveTopSpace ? <div className="h-12 shrink-0" /> : null}
    <div className="relative flex-1 overflow-hidden" data-testid="article-viewport">
      <div
        ref={scrollContainerRef}
        className="h-full overflow-y-auto"
        onScroll={onArticleScroll}
        data-testid="article-scroll-container"
      >
        <div className="w-full px-8 pb-12 pt-4 lg:pl-12 lg:pr-8" data-testid="article-content-shell">
          <div className="mb-8">
            {/* 保留现有标题、来源信息块 */}
            {!showDesktopToolbar ? (
              <div className="flex flex-wrap items-center gap-2">
                {/* 保留现有收藏 / 抓取全文 / 翻译 / 生成摘要文字按钮 */}
              </div>
            ) : null}
          </div>
          {/* 保留现有 fulltext / ai summary / translation 内容块 */}
        </div>
      </div>
    </div>
  </div>
);
```

实现时注意：

- 桌面端只迁移入口，不改 `onFulltextButtonClick`、`onAiSummaryButtonClick`、`onAiTranslationButtonClick`
- 非桌面保留原正文内文字按钮，不要因为复用原语把移动端也改成 icon-only
- 空文章态也要渲染桌面顶栏：设置按钮可用，文章动作 disabled
- 桌面顶栏标题需要保留“可打开原文”的既有能力；有 `link` 时继续渲染外链

- [ ] **Step 4: 运行 `ArticleView` 相关回归并确认通过**

Run: `pnpm exec vitest run src/features/articles/ArticleView.aiSummary.test.tsx src/features/reader/ReaderToolbarIconButton.test.tsx`
Expected: PASS，桌面端走顶栏 icon buttons，非桌面仍显示正文内文字动作

- [ ] **Step 5: 提交 `ArticleView` 桌面端顶栏迁移**

```bash
git add src/features/articles/ArticleView.tsx src/features/articles/ArticleView.aiSummary.test.tsx
git commit -m "fix(article-view): 将桌面端文章动作迁入顶栏" -m "- 在 ArticleView 内新增桌面端固定工具条\n- 保持移动端正文内动作按钮与现有交互不变\n- 继续让顶栏标题支持打开原文与打开设置"
```

### Task 4: 先写 `ReaderLayout` 集成回归，再移除桌面端悬浮入口和 floating title

**Files:**

- Modify: `src/features/reader/ReaderLayout.test.tsx`
- Modify: `src/features/reader/ReaderLayout.tsx`
- Read: `src/features/articles/ArticleView.tsx`

- [ ] **Step 1: 调整 `ReaderLayout` mock，并先补失败回归**

更新测试文件顶部的 `vi.mock('../articles/ArticleView', factory)`，让 mock 接收 `onOpenSettings`：

```tsx
vi.mock('../articles/ArticleView', () => ({
  default: function MockArticleView({
    onOpenSettings,
    onTitleVisibilityChange,
    reserveTopSpace = true,
  }: {
    onOpenSettings?: () => void;
    onTitleVisibilityChange?: (isVisible: boolean) => void;
    reserveTopSpace?: boolean;
  }) {
    useEffect(() => {
      onTitleVisibilityChange?.(true);
    }, [onTitleVisibilityChange]);

    return (
      <>
        {reserveTopSpace ? (
          <button type="button" aria-label="打开设置" onClick={onOpenSettings}>
            mock settings
          </button>
        ) : null}
        <div
          data-testid="article-scroll-container"
          data-reserve-top-space={reserveTopSpace ? 'true' : 'false'}
          onScroll={(event) => {
            onTitleVisibilityChange?.(event.currentTarget.scrollTop <= 96);
          }}
        />
      </>
    );
  },
}));
```

把现有桌面 floating title 断言改成新语义：

```tsx
it('no longer renders a separate desktop floating title after reader scroll', () => {
  resetSettingsStore();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  useAppStore.setState({
    feeds: [
      {
        id: 'feed-1',
        title: 'Example Feed',
        url: 'https://example.com/rss.xml',
        unreadCount: 1,
        enabled: true,
        fullTextOnOpenEnabled: false,
        aiSummaryOnOpenEnabled: false,
        categoryId: 'cat-uncategorized',
        category: '未分类',
      },
    ],
    articles: [
      {
        id: 'article-1',
        feedId: 'feed-1',
        title: 'Selected Article',
        content: '<p>content</p>',
        summary: 'summary',
        publishedAt: new Date().toISOString(),
        link: 'https://example.com/article-1',
        isRead: false,
        isStarred: false,
      },
    ],
    selectedView: 'all',
    selectedArticleId: 'article-1',
  });

  renderWithNotifications();

  const readerScrollContainer = screen.getByTestId('article-scroll-container');
  readerScrollContainer.scrollTop = 120;
  fireEvent.scroll(readerScrollContainer);

  expect(screen.queryByTestId('reader-floating-title')).not.toBeInTheDocument();
});
```

并补一条桌面端设置入口来源回归：

```tsx
it('opens settings from the desktop article toolbar callback instead of a floating layout button', async () => {
  resetSettingsStore();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });

  renderWithNotifications();

  const openSettingsButtons = screen.getAllByLabelText('打开设置');
  expect(openSettingsButtons).toHaveLength(1);

  fireEvent.click(openSettingsButtons[0]);
  expect(await screen.findByTestId('settings-center-modal')).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行 `ReaderLayout` 回归并确认失败**

Run: `pnpm exec vitest run src/features/reader/ReaderLayout.test.tsx -t "opens settings from the desktop article toolbar callback"`
Expected: FAIL，`ReaderLayout` 仍会额外渲染桌面端悬浮设置按钮，`打开设置` 数量为 2

- [ ] **Step 3: 收敛 `ReaderLayout` 到纯布局职责**

```tsx
// src/features/reader/ReaderLayout.tsx
const showFloatingArticleTitle = Boolean(
  !isMobile && selectedArticleId && selectedArticleTitle && !articleTitleVisible,
);

// 删除 desktop floating title 变量与渲染
// 删除 desktop 悬浮设置按钮

<div className="relative flex-1 overflow-hidden bg-background">
  <MemoizedArticleView
    renderedAt={renderedAt}
    onTitleVisibilityChange={setArticleTitleVisible}
    onOpenSettings={() => setSettingsOpen(true)}
  />
</div>
```

注意：

- 非桌面 `reader-non-desktop-topbar` 保持原状，不要改移动端“打开设置”按钮
- `selectionKey`、feed drawer、resize handle 与 tablet/mobile 分支都不是本轮目标
- 删除 desktop floating title 后，`selectedArticleTitle` / `selectedArticleLink` 等只为它服务的变量也要一起清理

- [ ] **Step 4: 运行 reader 集成回归与聚合验证**

Run: `pnpm exec vitest run src/features/reader/ReaderToolbarIconButton.test.tsx src/features/articles/ArticleList.test.tsx src/features/articles/ArticleView.aiSummary.test.tsx src/features/reader/ReaderLayout.test.tsx`
Expected: PASS，reader 中右栏 tooltip、桌面顶栏迁移和非桌面保持不变全部通过

Run: `pnpm exec eslint src/features/reader/ReaderToolbarIconButton.tsx src/features/reader/ReaderToolbarIconButton.test.tsx src/features/articles/ArticleList.tsx src/features/articles/ArticleList.test.tsx src/features/articles/ArticleView.tsx src/features/articles/ArticleView.aiSummary.test.tsx src/features/reader/ReaderLayout.tsx src/features/reader/ReaderLayout.test.tsx`
Expected: PASS，无 lint 错误

- [ ] **Step 5: 提交 layout 收尾与完整验证**

```bash
git add src/features/reader/ReaderToolbarIconButton.tsx src/features/reader/ReaderToolbarIconButton.test.tsx src/features/articles/ArticleList.tsx src/features/articles/ArticleList.test.tsx src/features/articles/ArticleView.tsx src/features/articles/ArticleView.aiSummary.test.tsx src/features/reader/ReaderLayout.tsx src/features/reader/ReaderLayout.test.tsx
git commit -m "fix(reader): 收敛桌面端工具条入口" -m "- 移除布局层悬浮设置按钮与 floating title\n- 让桌面端中右栏统一复用 reader toolbar 原语\n- 保持移动端阅读布局和文章动作不变"
```

## Implementation Notes

- `ReaderToolbarIconButton` 默认只覆盖 reader 顶部 icon action 场景；不要把它升级成全局 UI 原语，也不要顺手替换设置页或左栏的所有 icon button。
- `ArticleView` 的桌面顶栏如果开始撑大文件复杂度，只允许提取一个局部 helper 函数；不要在本轮再扩出完整 `ReaderPaneHeader` 抽象。
- 如果在实现中发现 tooltip 在 disabled button 上无法稳定触发，优先复用 `FeedList` 的外层 `<span className="block">` 模式，不要为测试去掉真实的 `disabled` 语义。
- 如果 `ArticleView.aiSummary.test.tsx` 继续出现既有 `act` warning，只要测试结果仍是 PASS 且未新增警告类型，可以接受；不要在本轮顺手重构整套测试 harness。

## Plan Review Notes

- 当前 harness 没有可直接调度的 plan reviewer subagent / task tool；写完后需按 `workflow-writing-plans/plan-document-reviewer-prompt.md` 的标准做一次等价自审，重点检查：
  - 是否有待办标记或占位文本
  - 各 task 是否完整给出失败测试、实现、验证和 commit
  - 是否把非桌面保持不变、中文 `aria-label`、disabled tooltip、`ArticleView` 状态不外提这些 spec 关键约束带进了任务

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-03-12-reader-toolbar-unification.md`. Ready to execute?

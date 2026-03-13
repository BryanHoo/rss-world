# FeedFuse 阅读列表蓝色轻盈化 Implementation Plan

> **For agentic workers:** REQUIRED: Use workflow-subagent-driven-development (if subagents available) or workflow-executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变 FeedFuse 当前蓝色品牌基调、信息结构和阅读状态逻辑的前提下，把阅读列表与相关 shared surface 调整得更清透、更有呼吸感，并让未读文章通过更亮、更大的蓝色圆点和更清晰的时间色一眼可见。

**Architecture:** 先在 `src/app/globals.css` 中提亮 reader 相关 light/dark token 与 `--reader-pane-hover`，再用最小范围更新 `src/lib/designSystem.ts` 的 tablet 列表面板表面层，最后在 `src/features/articles/ArticleList.tsx` 中集中实现未读信号强化。实现过程中优先复用现有语义 token 与 `READER_PANE_HOVER_BACKGROUND_CLASS_NAME`，不新增并行主题体系，不触碰 snapshot、hydration 或交互行为。

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS v4, Radix UI, Zustand, Vitest, Testing Library, Lucide

---

## Context To Carry Forward

- 已批准的 spec 在 `docs/superpowers/specs/2026-03-13-reader-blue-livelier-refresh-design.md`。实现必须遵守以下硬约束：
  - 保留蓝色品牌家族，不改成暖色或其他新主色。
  - 优先强化未读信号本身，而不是把整行选中/hover 做成更重的大面积高亮。
  - 只改 token、shared surface 和 `ArticleList` 视觉节点，不改信息结构、交互顺序、状态逻辑与数据流。
  - 不新增 `readerUnread*` 之类的新 token 体系；亮度提升必须建立在现有语义 token 与 `color-mix(...)` 局部类组合上。
- `docs/summaries/2026-03-11-reader-hydration-snapshot-and-literal-state-build.md` 已锁定 `ReaderLayout` / `ArticleList` 的 hydration 与首帧渲染行为。本轮只能改 class、token、测试锚点，不能顺手改 viewport 逻辑、首帧时间快照或 state 初始化。
- `docs/summaries/2026-03-11-accessible-name-token-leak.md` 已锁定 reader / article list / settings 主操作的中文可访问名称。本轮新增测试锚点时不能把 `aria-label` 改回英文 token 或内部实现名。
- 当前已有的回归入口已经覆盖大部分 shared surface 消费方，优先复用：
  - `src/features/feeds/FeedList.test.tsx` 已锁定左栏 hover 使用 `hover:bg-[var(--reader-pane-hover)]`
  - `src/features/reader/ReaderLayout.test.tsx` 已锁定桌面 pane 背景类和非桌面布局
  - `src/features/settings/SettingsCenterModal.test.tsx` 已锁定 settings 侧栏表面类
  - `src/features/articles/ArticleList.test.tsx` 已锁定 list 模式 unread dot 存在和 article pane hover 类
- 相关技能：
  - `@impeccable-frontend-design`：让蓝色更清透、更有节奏，但不要回退成默认浅灰模板。
  - `@vitest`：严格遵守先改失败断言、再写最小实现的顺序。
  - `@vercel-react-best-practices`：仅改 class / token / 局部视觉节点，不重写 `ArticleList` 的数据与渲染结构。
  - `@workflow-test-browser`：最终浏览器核验时优先用于 visual smoke check。
- 执行本计划时应在独立 worktree 中进行；当前阶段只生成计划文档，不移动工作目录。

## File Map

### Modify

- `src/app/globals-css.contract.test.ts`
  - 把 reader 相关的 light/dark token 与 `--reader-pane-hover` 升级为新的更透蓝色基线契约，并锁定旧“偏闷钴蓝”值被移除。
- `src/app/globals.css`
  - 提亮 `background / card / popover / muted / accent / border / ring` 的 reader 相关基线，并更新 `--reader-pane-hover` 的配方。
- `src/lib/designSystem.ts`
  - 把 `READER_TABLET_ARTICLE_PANE_CLASS_NAME` 从当前偏平的 `bg-muted/5` 调整为更通透的品牌表面层；保留 `READER_PANE_HOVER_BACKGROUND_CLASS_NAME` 的 API 不变。
- `src/features/reader/ReaderLayout.test.tsx`
  - 为 tablet 列表面板表面层补最小回归，防止 `READER_TABLET_ARTICLE_PANE_CLASS_NAME` 再回退到过平的旧样式。
- `src/features/articles/ArticleList.test.tsx`
  - 先写 card/list 双模式未读信号的失败用例，再锁住 brighter dot、time emphasis 和 card 测试锚点。
- `src/features/articles/ArticleList.tsx`
  - 添加 card 模式 unread signal 的测试锚点，统一 card/list 的 brighter unread dot、time class 和必要的 selected/hover 分层配合。

### Reuse Without Modification

- `src/features/feeds/FeedList.tsx`
  - 继续消费 `READER_PANE_HOVER_BACKGROUND_CLASS_NAME`；通过现有测试确认 hover 语言没有回退。
- `src/features/feeds/FeedList.test.tsx`
  - 不需要新增用例；在最终验证中直接作为 shared hover 回归运行。
- `src/features/settings/SettingsCenterDrawer.tsx`
  - 继续消费现有 `FROSTED_HEADER_CLASS_NAME` 与侧栏 surface；本轮主要通过 token 调整获得更轻盈观感。
- `src/features/settings/SettingsCenterModal.test.tsx`
  - 不需要新断言；在最终验证中确认 settings 侧栏 surface 没被新的 token 改坏。
- `src/features/reader/ReaderLayout.tsx`
  - 桌面 pane、mobile topbar 和 tablet pane 继续复用 shared surface 常量；实现变更集中在 `designSystem.ts`。

## Chunk 1: Theme And Shared Surface Foundation

### Task 1: 先锁定更清透的蓝色基线，再更新 `globals.css` 和 tablet pane surface

**Files:**

- Modify: `src/app/globals-css.contract.test.ts`
- Modify: `src/app/globals.css`
- Modify: `src/lib/designSystem.ts`
- Modify: `src/features/reader/ReaderLayout.test.tsx`

- [ ] **Step 1: 先把 reader 蓝色轻盈化的失败断言写进契约和 layout 回归**

在 `src/app/globals-css.contract.test.ts` 的主测试里追加这组断言，锁住新的更透蓝色基线和 `--reader-pane-hover` 配方：

```ts
expect(css).toContain('--color-background: hsl(214 60% 98%)');
expect(css).toContain('--color-card: hsl(214 65% 99%)');
expect(css).toContain('--color-primary: hsl(221 67% 47%)');
expect(css).toContain('--color-accent: hsl(214 74% 94%)');
expect(css).toContain('--color-ring: hsl(220 80% 56%)');
expect(css).toContain('--reader-pane-hover: color-mix(in oklab, var(--color-primary) 14%, var(--color-card))');
expect(css).toContain('--color-background: hsl(224 31% 12%)');
expect(css).toContain('--color-primary: hsl(213 92% 72%)');
expect(css).not.toContain('--color-background: hsl(220 44% 97%)');
expect(css).not.toContain('--color-primary: hsl(224 54% 42%)');
expect(css).not.toContain('--color-accent: hsl(221 37% 92%)');
```

在 `src/features/reader/ReaderLayout.test.tsx` 里新增一个 tablet surface 回归，用于锁定 `READER_TABLET_ARTICLE_PANE_CLASS_NAME`：

```ts
it('uses the lighter shared tablet article pane surface', () => {
  resetSettingsStore();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 900 });

  renderWithNotifications();

  const tabletPane = screen.getByTestId('reader-tablet-article-pane');
  expect(tabletPane.className).toContain('bg-background/72');
  expect(tabletPane.className).toContain('supports-[backdrop-filter]:bg-background/58');
  expect(tabletPane.className).toContain('border-border/70');
});
```

- [ ] **Step 2: 运行 foundation 回归并确认失败**

Run: `pnpm exec vitest run src/app/globals-css.contract.test.ts src/features/reader/ReaderLayout.test.tsx`

Expected:

- `globals-css.contract.test.ts` 因 `globals.css` 仍保留当前偏闷蓝色值和旧 `--reader-pane-hover` 配方失败
- `ReaderLayout.test.tsx` 因 `READER_TABLET_ARTICLE_PANE_CLASS_NAME` 仍是 `bg-muted/5` 失败

- [ ] **Step 3: 在 `globals.css` 中实现更清透的蓝色基线，并调整 tablet pane 表面层**

把 `src/app/globals.css` 中与 reader 直接相关的 token 改成下面这组值；`success / warning / error` 家族保持不动，避免 scope creep：

```css
--color-background: hsl(214 60% 98%);
--color-foreground: hsl(223 38% 17%);

--color-card: hsl(214 65% 99%);
--color-card-foreground: hsl(223 38% 17%);

--color-popover: hsl(214 68% 99%);
--color-popover-foreground: hsl(223 38% 17%);

--color-primary: hsl(221 67% 47%);
--color-primary-foreground: hsl(214 100% 98%);

--color-secondary: hsl(214 49% 95%);
--color-secondary-foreground: hsl(223 32% 22%);

--color-muted: hsl(214 44% 95%);
--color-muted-foreground: hsl(222 18% 42%);

--color-accent: hsl(214 74% 94%);
--color-accent-foreground: hsl(223 36% 22%);

--color-border: hsl(216 35% 88%);
--color-input: hsl(216 35% 88%);
--color-ring: hsl(220 80% 56%);
--color-overlay: hsl(222 47% 14% / 0.46);
--shadow-popover: 0 24px 48px -30px rgb(59 98 176 / 0.28), 0 14px 24px -22px rgb(36 72 142 / 0.18);
```

```css
.dark {
  --color-background: hsl(224 31% 12%);
  --color-foreground: hsl(214 38% 96%);

  --color-card: hsl(223 28% 15%);
  --color-card-foreground: hsl(214 38% 96%);

  --color-popover: hsl(223 28% 16%);
  --color-popover-foreground: hsl(214 38% 96%);

  --color-primary: hsl(213 92% 72%);
  --color-primary-foreground: hsl(224 32% 14%);

  --color-secondary: hsl(223 22% 22%);
  --color-secondary-foreground: hsl(214 38% 96%);

  --color-muted: hsl(223 20% 20%);
  --color-muted-foreground: hsl(216 18% 74%);

  --color-accent: hsl(223 28% 24%);
  --color-accent-foreground: hsl(214 42% 96%);

  --color-border: hsl(222 19% 29%);
  --color-input: hsl(222 19% 29%);
  --color-ring: hsl(213 92% 72%);
  --color-overlay: hsl(226 44% 7% / 0.68);
  --shadow-popover: 0 28px 60px -34px rgb(11 24 54 / 0.74), 0 18px 32px -26px rgb(32 78 169 / 0.26);
}
```

同时把 `:root` 里的 hover 变量更新成：

```css
--reader-pane-hover: color-mix(in oklab, var(--color-primary) 14%, var(--color-card));
```

然后在 `src/lib/designSystem.ts` 中只做最小必要的 shared surface 变更，不要改 `READER_PANE_HOVER_BACKGROUND_CLASS_NAME` 的对外 API：

```ts
export const READER_TABLET_ARTICLE_PANE_CLASS_NAME =
  'w-[min(var(--layout-reader-tablet-list-max-width),42vw)] min-w-[var(--layout-reader-tablet-list-min-width)] shrink-0 border-r border-border/70 bg-background/72 supports-[backdrop-filter]:bg-background/58';
```

Implementation notes:

- `FROSTED_HEADER_CLASS_NAME` 与 `READER_PANE_HOVER_BACKGROUND_CLASS_NAME` 先保持当前 class API，不为了“多改一点”引入额外 churn。
- 这一步只负责建立更轻盈的 reader blue foundation，不要顺手改 `ArticleList.tsx`。

- [ ] **Step 4: 重新运行 foundation 回归**

Run: `pnpm exec vitest run src/app/globals-css.contract.test.ts src/features/reader/ReaderLayout.test.tsx`

Expected: PASS

- [ ] **Step 5: 提交 foundation**

```bash
git add src/app/globals-css.contract.test.ts src/app/globals.css src/lib/designSystem.ts src/features/reader/ReaderLayout.test.tsx
git commit -m "feat(主题): 提亮阅读列表蓝色表面基线" -m "- 更新 reader 相关 light dark token 与 pane hover 配方\n- 让 tablet 列表面板接入更通透的 shared surface\n- 锁定新的主题契约与 tablet pane 回归"
```

## Chunk 2: ArticleList Unread Signal

### Task 2: 先写 card/list 双模式未读信号失败用例，再实现 brighter dot 和时间色

**Files:**

- Modify: `src/features/articles/ArticleList.test.tsx`
- Modify: `src/features/articles/ArticleList.tsx`

- [ ] **Step 1: 先在 `ArticleList.test.tsx` 中补未读信号回归**

在文件顶部定义一组共享断言常量，避免 card/list 两边拷贝不同字符串：

```ts
const UNREAD_SIGNAL_DOT_CLASS = 'bg-[color-mix(in_oklab,var(--color-primary)_78%,white)]';
const UNREAD_SIGNAL_TIME_CLASS = 'text-[color-mix(in_oklab,var(--color-primary)_88%,white_12%)]';
```

然后新增一个 card/list 双模式用例。注意这个用例应先要求 card 模式拥有测试锚点，所以初次运行会失败：

```ts
it('renders brighter unread signals consistently in card and list modes', async () => {
  useAppStore.setState({ selectedView: 'feed-1' });
  renderWithNotifications();

  const cardDot = screen.getByTestId('article-card-art-1-unread-dot');
  const cardTime = screen.getByTestId('article-card-art-1-time');

  expect(cardDot.className).toContain('h-2');
  expect(cardDot.className).toContain('w-2');
  expect(cardDot.className).toContain(UNREAD_SIGNAL_DOT_CLASS);
  expect(cardDot.className).toContain('ring-2');
  expect(cardTime.className).toContain('font-semibold');
  expect(cardTime.className).toContain(UNREAD_SIGNAL_TIME_CLASS);

  fireEvent.click(screen.getByRole('button', { name: TOGGLE_TO_LIST_LABEL }));

  const rowDot = await screen.findByTestId('article-list-row-art-1-unread-dot');
  const rowTime = screen.getByTestId('article-list-row-art-1-time');

  expect(rowDot.className).toContain('h-2');
  expect(rowDot.className).toContain('w-2');
  expect(rowDot.className).toContain(UNREAD_SIGNAL_DOT_CLASS);
  expect(rowDot.className).toContain('ring-2');
  expect(rowTime.className).toContain('font-semibold');
  expect(rowTime.className).toContain(UNREAD_SIGNAL_TIME_CLASS);
});
```

- [ ] **Step 2: 运行 `ArticleList` 定向回归并确认失败**

Run: `pnpm exec vitest run src/features/articles/ArticleList.test.tsx -t "renders brighter unread signals consistently in card and list modes"`

Expected:

- 先因 `article-card-art-1-unread-dot` / `article-card-art-1-time` 不存在失败
- 或者因 dot / time class 仍停留在 `h-1.5 w-1.5 bg-primary` 和 `text-primary` 失败

- [ ] **Step 3: 在 `ArticleList.tsx` 中实现 brighter unread signal**

在 `src/features/articles/ArticleList.tsx` 中新增局部 class 常量，集中管理未读信号，不要把复杂的 `color-mix(...)` 字符串散在 JSX 里：

```ts
const unreadSignalDotClassName =
  'h-2 w-2 rounded-full bg-[color-mix(in_oklab,var(--color-primary)_78%,white)] ring-2 ring-background/95';

const unreadSignalTimeClassName =
  'font-semibold text-[color-mix(in_oklab,var(--color-primary)_88%,white_12%)]';
```

然后把 list/card 两个分支都统一成同一套未读信号：

```tsx
{!article.isRead && (
  <span
    data-testid={`article-list-row-${article.id}-unread-dot`}
    aria-hidden="true"
    className={unreadSignalDotClassName}
  />
)}
<span
  data-testid={`article-list-row-${article.id}-time`}
  className={article.isRead ? 'text-muted-foreground' : unreadSignalTimeClassName}
>
  {formatRelativeTime(article.publishedAt, referenceTime)}
</span>
```

```tsx
{!article.isRead && (
  <span
    data-testid={`article-card-${article.id}-unread-dot`}
    aria-hidden="true"
    className={unreadSignalDotClassName}
  />
)}
<span
  data-testid={`article-card-${article.id}-time`}
  className={article.isRead ? 'text-muted-foreground' : unreadSignalTimeClassName}
>
  {formatRelativeTime(article.publishedAt, referenceTime)}
</span>
```

如果实现后选中项和未读信号仍然挤在一起，只允许做这一档最小调整，不要新造 selected 语义：

```tsx
selectedArticleId === article.id ? 'bg-accent/90' : READER_PANE_HOVER_BACKGROUND_CLASS_NAME
```

Implementation notes:

- 不要改 `getArticleButtonLabel`、`handleArticleKeyDown`、preview preload 或 snapshot 相关逻辑。
- 不要把 brighter unread signal 拆成新组件或新文件；本轮变化只属于 `ArticleList` 局部视觉节点。
- list 模式已有测试锚点，card 模式只新增 `-unread-dot` 与 `-time` 两个 `data-testid`，不要顺手加更多无关 testid。

- [ ] **Step 4: 重新运行 `ArticleList` 回归**

Run: `pnpm exec vitest run src/features/articles/ArticleList.test.tsx`

Expected: PASS

- [ ] **Step 5: 提交未读信号强化**

```bash
git add src/features/articles/ArticleList.tsx src/features/articles/ArticleList.test.tsx
git commit -m "feat(reader): 强化文章列表未读信号" -m "- 统一 card list 两种模式的亮蓝未读圆点与时间色\n- 为 card 模式补齐未读信号测试锚点\n- 保持现有交互结构和阅读状态逻辑不变"
```

## Chunk 3: Final Verification

### Task 3: 跑聚合验证并完成浏览器核验

**Files:**

- Read: `docs/superpowers/specs/2026-03-13-reader-blue-livelier-refresh-design.md`
- Read: `src/app/globals.css`
- Read: `src/lib/designSystem.ts`
- Read: `src/features/articles/ArticleList.tsx`
- Read: `src/features/feeds/FeedList.tsx`
- Read: `src/features/settings/SettingsCenterDrawer.tsx`
- Read: `src/features/reader/ReaderLayout.tsx`

- [ ] **Step 1: 跑本轮最小聚合测试集**

Run:

```bash
pnpm exec vitest run \
  src/app/globals-css.contract.test.ts \
  src/features/articles/ArticleList.test.tsx \
  src/features/feeds/FeedList.test.tsx \
  src/features/reader/ReaderLayout.test.tsx \
  src/features/settings/SettingsCenterModal.test.tsx
```

Expected: PASS

- [ ] **Step 2: 跑定向 lint，确认没有引入 class 字符串或测试拼写问题**

Run: `pnpm exec eslint src/lib/designSystem.ts src/features/articles/ArticleList.tsx src/features/articles/ArticleList.test.tsx src/features/reader/ReaderLayout.test.tsx`

Expected: PASS

- [ ] **Step 3: 跑全量单测，确认全局 token 调整没有打破其他 reader / settings / feed 回归**

Run: `pnpm test:unit`

Expected: PASS

- [ ] **Step 4: 跑生产构建，确认主题与类型没有回归**

Run: `pnpm run build`

Expected:

- `Compiled successfully`
- `Running TypeScript` 通过
- `Generating static pages` 完成

- [ ] **Step 5: 做浏览器核验**

如果 dev server 未启动，先运行：`pnpm dev`

然后用 `@workflow-test-browser` 或手动浏览器检查 `http://localhost:9559`，至少确认以下场景：

1. 默认 light 模式下 reader 左栏、中栏、右栏明显更透，但仍属于当前品牌蓝家族，不会发灰或发白。
2. `ArticleList` 的未读文章不依赖标题粗细，也能先通过更亮、更大的圆点和时间色被看到。
3. 选中态仍然表达“当前上下文”，不会和未读信号混成同一种大面积蓝色高亮。
4. `FeedList` hover、tablet article pane 和 settings 侧栏没有因为 token 调整而出现孤立的旧灰面板。
5. dark 模式下未读信号仍然清楚，但不会像荧光点那样突兀。

- [ ] **Step 6: 仅在验证发现问题时追加修复提交**

如果 Step 1-5 全绿且视觉符合 spec，不追加提交。

如果浏览器核验、lint 或 build 暴露问题，按最小修复范围处理，并单独提交：

```bash
git add <relevant-files>
git commit -m "fix(reader): 收口蓝色轻盈化回归问题" -m "- 修复验证阶段暴露的主题或未读信号回归\n- 保持 shared surface 与 ArticleList 视觉语义一致\n- 补齐对应测试或断言"
```

Plan complete and saved to `docs/superpowers/plans/2026-03-13-reader-blue-livelier-refresh.md`. Ready to execute?

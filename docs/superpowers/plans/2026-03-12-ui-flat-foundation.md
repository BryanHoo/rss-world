# UI Flat Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use workflow-subagent-driven-development (if subagents available) or workflow-executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一全站基础交互件的扁平视觉语言，移除不匹配的阴影按钮与输入框样式，并让 reader 左栏、中栏、右栏及设置页控件回到一致的密度体系。

**Architecture:** 先在共享 `ui` 原语层建立 flat baseline，再把阅读器右栏、设置导航和手写 `textarea` 迁回这套基线。实现上优先复用现有 `Button`/`Input`/`Select`/`Tabs`，只在 `Button` 新增一个明确的 `compact` 尺寸，并新增共享 `Textarea`，避免继续靠页面级 class 复制样式。

**Tech Stack:** Next.js App Router, React, Tailwind CSS v4, class-variance-authority, Radix UI, Vitest, Testing Library, Lucide

---

## Context To Carry Forward

- 已批准的 spec 在 `docs/superpowers/specs/2026-03-12-ui-flat-foundation-design.md`；实现必须遵守以下硬约束：
  - 改动范围只覆盖基础交互件与已确认的页面级偏离点
  - `Dialog`、`Sheet`、`Popover`、`ToastHost`、`context-menu` 这类浮层容器表面不是本轮目标
  - `SelectContent` 仍然视为浮层表面，不要因为“去阴影”顺手删掉其层级表达
- `docs/summaries/2026-03-11-accessible-name-token-leak.md` 已记录过按钮可访问名称回归；任何新增测试或组件替换都必须继续使用中文用户文案，不能把内部 token 放进 `aria-label`。
- 现有 `Button size="sm"` 已被 `ArticleView` 的“重试/展开摘要”和多个设置页微型按钮复用；不要直接把 `sm` 改成新的统一紧凑尺寸，否则会把不该变大的微型按钮一起带跑。
- 当前 reader/settings 中已确认的偏离点：
  - `src/features/articles/ArticleView.tsx`：四个顶部动作按钮直接写了 `transition-shadow hover:shadow-md`
  - `src/features/articles/ArticleScrollAssist.tsx`：自定义圆形按钮保留 `shadow-sm`
  - `src/features/settings/SettingsCenterDrawer.tsx`：导航 tab 用 `data-[state=active]:shadow-sm`
  - `src/features/settings/panels/GeneralSettingsPanel.tsx`、`src/features/settings/panels/RssSettingsPanel.tsx`、`src/features/settings/panels/AISettingsPanel.tsx`：存在 `h-8 rounded-lg` 一类手动密度/圆角覆写
  - `src/features/settings/panels/RssSettingsPanel.tsx`、`src/features/feeds/FeedKeywordFilterDialog.tsx`：仍在手写带 `shadow-sm` 的 `textarea`
- 已有回归测试切入点：
  - `src/features/articles/ArticleView.aiSummary.test.tsx` 已直接断言 `hover:shadow-md`
  - `src/features/articles/ArticleScrollAssist.test.tsx` 已断言圆形按钮类名
  - `src/features/settings/SettingsCenterModal.test.tsx` 已覆盖设置弹层、RSS tab 与全局关键词过滤输入
  - `src/features/feeds/FeedKeywordFilterDialog.test.tsx` 已覆盖订阅源关键词过滤 textarea
- 相关技能与约束：
  - `@tailwind-design-system`：共享 token/variant 调整优先于页面补丁
  - `@vitest`：测试先行，针对受影响组件写最小必要断言
  - `@vercel-react-best-practices`：保持组件边界清晰，不顺手做结构重写

## File Map

### Create

- `src/components/ui/textarea.tsx`
  - 新的共享 `Textarea` 原语，提供统一的 flat 输入视觉、焦点态和密度
- `src/components/ui/flat-interactive.test.tsx`
  - 共享交互件 flat contract 测试：验证 `Button`/`Input`/`SelectTrigger`/`Textarea`/`Switch`/`TabsTrigger`/`Badge` 的无阴影基线与 `compact` 尺寸

### Modify

- `src/components/ui/button.tsx`
  - 去掉 `default` / `secondary` / `outline` / `destructive` 的基础阴影；新增可复用的 `compact` 尺寸
- `src/components/ui/input.tsx`
  - 去掉输入框阴影，保留轻边框与 focus ring
- `src/components/ui/select.tsx`
  - 仅扁平化 `SelectTrigger`；`SelectContent` 保持浮层表面语义
- `src/components/ui/switch.tsx`
  - 去掉轨道与 thumb 的立体阴影
- `src/components/ui/tabs.tsx`
  - 去掉 `TabsTrigger` 的 active 阴影表达
- `src/components/ui/badge.tsx`
  - 去掉 badge 阴影，保留语义色
- `src/features/articles/ArticleView.tsx`
  - 顶部动作按钮改用共享 flat baseline，移除 `hover:shadow-md`
- `src/features/articles/ArticleScrollAssist.tsx`
  - 去掉圆形按钮阴影，保留浮动位置与进度 ring
- `src/features/articles/ArticleView.aiSummary.test.tsx`
  - 更新按钮样式断言，改成 flat 预期
- `src/features/articles/ArticleScrollAssist.test.tsx`
  - 更新回到顶部按钮的 flat 断言
- `src/features/settings/SettingsCenterDrawer.tsx`
  - 去掉导航 tab 的 active 阴影，收敛圆角与状态表达
- `src/features/settings/panels/GeneralSettingsPanel.tsx`
  - 把手写 `h-8 rounded-lg` 按钮迁到 `size="compact"`，收敛 `SelectTrigger` 覆写
- `src/features/settings/panels/RssSettingsPanel.tsx`
  - 使用共享 `Textarea`；收敛 `SelectTrigger` 覆写
- `src/features/settings/panels/AISettingsPanel.tsx`
  - 把手写 `h-8 rounded-lg` 按钮迁到 `size="compact"`
- `src/features/feeds/FeedKeywordFilterDialog.tsx`
  - 使用共享 `Textarea`
- `src/features/settings/SettingsCenterModal.test.tsx`
  - 增加设置页 flat 控件回归断言
- `src/features/feeds/FeedKeywordFilterDialog.test.tsx`
  - 增加共享 `Textarea` 迁移回归断言

### Reuse Without Modification

- `src/components/ui/dialog.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/popover.tsx`
- `src/components/ui/context-menu.tsx`
- `src/features/toast/ToastHost.tsx`
- `src/app/theme-token-usage.contract.test.ts`
- `src/app/globals-css.contract.test.ts`

这些文件的阴影/浮层 token 属于容器层级表达，本轮不改，只作为回归验证对象。

## Chunk 1: Shared Flat Primitives

### Task 1: 建立共享 flat contract 测试与 `Textarea` 入口

**Files:**

- Create: `src/components/ui/flat-interactive.test.tsx`
- Read: `src/components/ui/button.tsx`
- Read: `src/components/ui/input.tsx`
- Read: `src/components/ui/select.tsx`
- Read: `src/components/ui/switch.tsx`
- Read: `src/components/ui/tabs.tsx`
- Read: `src/components/ui/badge.tsx`

- [ ] **Step 1: 先写会失败的 flat contract 测试**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './badge';
import { Button } from './button';
import { Input } from './input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { Switch } from './switch';
import { Tabs, TabsList, TabsTrigger } from './tabs';
import { Textarea } from './textarea';

describe('flat interactive primitives', () => {
  it('renders button variants without shared shadow classes and exposes compact size', () => {
    render(
      <>
        <Button>默认</Button>
        <Button variant="secondary" size="compact">紧凑</Button>
        <Button variant="outline">描边</Button>
      </>,
    );

    expect(screen.getByRole('button', { name: '默认' }).className).not.toContain('shadow-sm');
    expect(screen.getByRole('button', { name: '紧凑' })).toHaveClass('h-8');
    expect(screen.getByRole('button', { name: '描边' }).className).not.toContain('shadow-sm');
  });

  it('renders text inputs without field shadows', () => {
    render(
      <>
        <Input aria-label="输入框" />
        <Textarea aria-label="多行输入框" />
        <Select defaultValue="15">
          <SelectTrigger aria-label="抓取间隔">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="15">每 15 分钟</SelectItem>
          </SelectContent>
        </Select>
      </>,
    );

    expect(screen.getByLabelText('输入框').className).not.toContain('shadow-sm');
    expect(screen.getByLabelText('多行输入框').className).not.toContain('shadow-sm');
    expect(screen.getByRole('combobox', { name: '抓取间隔' }).className).not.toContain('shadow-sm');
  });

  it('renders switch tabs badge without lift-style shadows', () => {
    render(
      <>
        <Switch aria-label="开关" checked={false} onCheckedChange={() => {}} />
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">通用</TabsTrigger>
          </TabsList>
        </Tabs>
        <Badge>标签</Badge>
      </>,
    );

    expect(screen.getByRole('switch', { name: '开关' }).className).not.toContain('shadow-sm');
    expect(screen.getByRole('switch', { name: '开关' }).querySelector('span')?.className).not.toContain('shadow');
    expect(screen.getByRole('tab', { name: '通用' }).className).not.toContain('data-[state=active]:shadow-sm');
    expect(screen.getByText('标签').className).not.toContain('shadow-sm');
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm exec vitest run src/components/ui/flat-interactive.test.tsx`
Expected: FAIL，报错 `./textarea` 不存在，且 `Button size="compact"` 未定义

- [ ] **Step 3: 写最小实现，建立共享 flat baseline**

```tsx
// src/components/ui/button.tsx
const buttonVariants = cva('inline-flex items-center justify-center ...', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground hover:bg-primary/92',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/85',
      outline: 'border border-input bg-background hover:bg-accent/60 hover:text-accent-foreground',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/92',
      ghost: 'hover:bg-accent/70 hover:text-accent-foreground',
      link: 'text-primary underline-offset-4 hover:underline',
    },
    size: {
      default: 'h-9 px-4 py-2 text-sm',
      sm: 'h-7 rounded-md px-2 text-xs',
      compact: 'h-8 rounded-md px-3 text-sm',
      lg: 'h-10 rounded-md px-8 text-sm',
      icon: 'h-9 w-9',
    },
  },
});

// src/components/ui/textarea.tsx
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
```

Implementation notes:

- `Button size="sm"` 保持给微型按钮使用，不要把它改成新的通用紧凑尺寸。
- `SelectContent` 保持现有浮层层级表达；只改 `SelectTrigger`。
- `Switch` 的 root/thumb、`TabsTrigger`、`Badge` 一起去掉阴影，但继续保留状态色与 focus ring。

- [ ] **Step 4: 跑共享组件回归**

Run: `pnpm exec vitest run src/components/ui/flat-interactive.test.tsx src/components/ui/ui-smoke.test.tsx`
Expected: PASS

- [ ] **Step 5: 提交共享基线**

```bash
git add src/components/ui/button.tsx src/components/ui/input.tsx src/components/ui/select.tsx src/components/ui/switch.tsx src/components/ui/tabs.tsx src/components/ui/badge.tsx src/components/ui/textarea.tsx src/components/ui/flat-interactive.test.tsx
git commit -m "feat(ui): 建立扁平化交互基线" -m "- 添加共享 Textarea 原语与 Button compact 尺寸\n- 移除基础交互件阴影并保留状态表达\n- 补齐共享 flat contract 与 smoke 回归"
```

## Chunk 2: Reader Controls

### Task 2: 先锁定 reader 右栏按钮与滚动辅助按钮的 flat 回归

**Files:**

- Modify: `src/features/articles/ArticleView.aiSummary.test.tsx`
- Modify: `src/features/articles/ArticleScrollAssist.test.tsx`
- Read: `src/features/articles/ArticleView.tsx`
- Read: `src/features/articles/ArticleScrollAssist.tsx`

- [ ] **Step 1: 先把 reader 样式断言改成新的 flat 预期**

```tsx
it('三个操作按钮展示扁平化交互样式', async () => {
  render(<ArticleView />);

  const starButton = await screen.findByRole('button', { name: '收藏' });
  const translateButton = screen.getByRole('button', { name: '翻译' });
  const aiSummaryButton = screen.getByRole('button', { name: '生成摘要' });

  expect(starButton).toHaveClass('cursor-pointer');
  expect(starButton.className).not.toContain('hover:shadow-md');
  expect(translateButton.className).not.toContain('hover:shadow-md');
  expect(aiSummaryButton.className).not.toContain('hover:shadow-md');
});

it('renders a flat circular back-to-top control', () => {
  render(<ArticleScrollAssist visible percent={37} onBackToTop={vi.fn()} />);

  const backToTopButton = screen.getByRole('button', { name: '回到顶部' });
  expect(backToTopButton.className).not.toContain('shadow-sm');
  expect(backToTopButton).toHaveClass('rounded-full', 'bg-background/70');
});
```

- [ ] **Step 2: 运行 reader 定向测试并确认失败**

Run: `pnpm exec vitest run src/features/articles/ArticleView.aiSummary.test.tsx src/features/articles/ArticleScrollAssist.test.tsx`
Expected: FAIL，旧实现仍包含 `hover:shadow-md` / `shadow-sm`

- [ ] **Step 3: 用共享基线收口 reader 按钮**

```tsx
// src/features/articles/ArticleView.tsx
<Button
  type="button"
  variant="secondary"
  size="compact"
  className="cursor-pointer"
  onClick={onAiSummaryButtonClick}
>
  <Sparkles />
  <span>生成摘要</span>
</Button>

// src/features/articles/ArticleScrollAssist.tsx
className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border/50 bg-background/70 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
```

Implementation notes:

- 右栏四个主动作按钮都迁到 `size="compact"`，不要继续手写 `h-8 px-3 text-sm transition-shadow`。
- `ArticleScrollAssist` 仍保留自定义圆形结构和进度环，不要强行改成共享 `Button`。
- `ArticleView` 中“重试”“展开摘要”继续使用现有 `size="sm"`，避免波及微型按钮。

- [ ] **Step 4: 重新运行 reader 回归**

Run: `pnpm exec vitest run src/features/articles/ArticleView.aiSummary.test.tsx src/features/articles/ArticleScrollAssist.test.tsx`
Expected: PASS

- [ ] **Step 5: 提交 reader 收口**

```bash
git add src/features/articles/ArticleView.tsx src/features/articles/ArticleScrollAssist.tsx src/features/articles/ArticleView.aiSummary.test.tsx src/features/articles/ArticleScrollAssist.test.tsx
git commit -m "fix(reader): 统一右栏扁平化操作样式" -m "- 让文章动作按钮复用共享 compact 按钮尺寸\n- 移除滚动辅助按钮的阴影表达\n- 更新阅读区样式回归测试"
```

## Chunk 3: Settings Panels And Local Overrides

### Task 3: 先写设置页与对话框的 flat 回归测试

**Files:**

- Modify: `src/features/settings/SettingsCenterModal.test.tsx`
- Modify: `src/features/feeds/FeedKeywordFilterDialog.test.tsx`
- Read: `src/features/settings/SettingsCenterDrawer.tsx`
- Read: `src/features/settings/panels/GeneralSettingsPanel.tsx`
- Read: `src/features/settings/panels/RssSettingsPanel.tsx`
- Read: `src/features/settings/panels/AISettingsPanel.tsx`
- Read: `src/features/feeds/FeedKeywordFilterDialog.tsx`

- [ ] **Step 1: 补一个设置页 flat 控件回归场景**

```tsx
it('uses flat controls across settings sections', async () => {
  renderWithNotifications();

  fireEvent.click(screen.getByLabelText('打开设置'));
  await screen.findByTestId('settings-center-modal');

  const rssTab = screen.getByTestId('settings-section-tab-rss');
  expect(rssTab.className).not.toContain('data-[state=active]:shadow-sm');

  const autoMarkReadButton = screen.getByRole('button', { name: '自动标记' });
  expect(autoMarkReadButton.className).not.toContain('rounded-lg');

  fireEvent.click(rssTab);
  expect((await screen.findByLabelText('全局关键词过滤')).className).not.toContain('shadow-sm');
  const rssIntervalTrigger = screen.getAllByRole('combobox')[0];
  expect(rssIntervalTrigger.className).not.toContain('rounded-lg');

  fireEvent.click(screen.getByTestId('settings-section-tab-ai'));
  expect(await screen.findByRole('button', { name: '复用主配置' })).not.toHaveClass('rounded-lg');
});
```

- [ ] **Step 2: 给订阅源关键词过滤对话框补 `Textarea` 迁移断言**

```tsx
it('renders feed keyword textarea with flat shared input classes', async () => {
  render(<FeedKeywordFilterDialog open feed={buildFeed()} onOpenChange={vi.fn()} />);

  const textarea = await screen.findByLabelText('文章关键词过滤规则');
  expect(textarea.className).not.toContain('shadow-sm');
  expect(textarea).toHaveClass('rounded-md');
});
```

- [ ] **Step 3: 运行设置页/对话框回归并确认失败**

Run: `pnpm exec vitest run src/features/settings/SettingsCenterModal.test.tsx src/features/feeds/FeedKeywordFilterDialog.test.tsx`
Expected: FAIL，现有类名仍包含 `shadow-sm` / `rounded-lg` / `data-[state=active]:shadow-sm`

- [ ] **Step 4: 实现设置页与局部输入迁移**

```tsx
// src/features/settings/panels/RssSettingsPanel.tsx
import { Textarea } from '@/components/ui/textarea';
...
<Textarea
  id="rss-global-article-keyword-filter"
  aria-label="全局关键词过滤"
  value={globalKeywordsText}
  ...
  className="min-h-28"
/>

// src/features/feeds/FeedKeywordFilterDialog.tsx
<Textarea
  id="feed-keyword-filter"
  aria-label="文章关键词过滤规则"
  value={value}
  onChange={(event) => setValue(event.target.value)}
  className="min-h-28"
/>

// src/features/settings/panels/AISettingsPanel.tsx
<Button size="compact" className="px-3">复用主配置</Button>

// src/features/settings/SettingsCenterDrawer.tsx
const settingsSectionTabClassName =
  'group relative min-w-[152px] justify-start rounded-lg border border-transparent bg-transparent ... data-[state=active]:bg-background data-[state=active]:text-foreground';
```

Implementation notes:

- `SettingsCenterDrawer` 只去掉 active 阴影并收敛圆角，不要改动 tab 结构和错误徽标逻辑。
- `GeneralSettingsPanel` / `AISettingsPanel` 的按钮改用 `size="compact"`，保留原有宽度 class；`SelectTrigger` 只保留必要宽度/高度覆写，去掉 `rounded-lg`。
- `RssSettingsPanel` 与 `FeedKeywordFilterDialog` 迁到共享 `Textarea` 后，只保留 `min-h-*` 这类语义化尺寸 class。

- [ ] **Step 5: 运行受影响的完整验证**

Run: `pnpm exec vitest run src/components/ui/flat-interactive.test.tsx src/components/ui/ui-smoke.test.tsx src/features/articles/ArticleView.aiSummary.test.tsx src/features/articles/ArticleScrollAssist.test.tsx src/features/settings/SettingsCenterModal.test.tsx src/features/feeds/FeedKeywordFilterDialog.test.tsx src/app/theme-token-usage.contract.test.ts src/app/globals-css.contract.test.ts`
Expected: PASS

Run: `pnpm exec eslint src/components/ui/button.tsx src/components/ui/input.tsx src/components/ui/select.tsx src/components/ui/textarea.tsx src/components/ui/switch.tsx src/components/ui/tabs.tsx src/components/ui/badge.tsx src/features/articles/ArticleView.tsx src/features/articles/ArticleScrollAssist.tsx src/features/settings/SettingsCenterDrawer.tsx src/features/settings/panels/GeneralSettingsPanel.tsx src/features/settings/panels/RssSettingsPanel.tsx src/features/settings/panels/AISettingsPanel.tsx src/features/feeds/FeedKeywordFilterDialog.tsx`
Expected: PASS

- [ ] **Step 6: 提交设置页收尾与完整验证**

```bash
git add src/features/settings/SettingsCenterDrawer.tsx src/features/settings/panels/GeneralSettingsPanel.tsx src/features/settings/panels/RssSettingsPanel.tsx src/features/settings/panels/AISettingsPanel.tsx src/features/feeds/FeedKeywordFilterDialog.tsx src/features/settings/SettingsCenterModal.test.tsx src/features/feeds/FeedKeywordFilterDialog.test.tsx
git commit -m "fix(settings): 统一设置页扁平化控件节奏" -m "- 迁移 RSS 与订阅源关键词过滤到共享 Textarea\n- 收敛设置导航与设置面板按钮的圆角和阴影表达\n- 补齐设置页与主题契约回归验证"
```

## Execution Notes

- 如果当前 harness 仍然没有 subagent/`spawn_agent` 能力，执行本计划时直接使用 `workflow-executing-plans`，不要跳过测试与分段提交。
- 每完成一个 chunk 都先跑该 chunk 的定向测试，再进入下一块，避免把共享原语和页面回归混在一起调。
- 若在执行时发现 `compact` 仍不足以同时满足 reader 动作按钮和设置页切换按钮，只允许在 `Button` 内再引入一个额外尺寸；不要重新定义一整套新 variant。

# FeedFuse 编辑感钴蓝品牌增强 Implementation Plan

> **For agentic workers:** REQUIRED: Use workflow-subagent-driven-development (if subagents available) or workflow-executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 FeedFuse 的 light/dark 主题、共享表面原语与 reader/settings/article/toast 的高曝光区域统一到已批准的“编辑感钴蓝”品牌语言，同时补齐契约测试、行为回归与浏览器核验。

**Architecture:** 先在 `src/app/globals.css` 和 `src/app/layout.tsx` 建立品牌钴蓝 token 与 `themeColor` 基线，再在共享 `ui` 原语层统一 tooltip / popover / select / dialog / sheet / alert-dialog / toast / header surface 的表面语言，最后把 reader、settings、article 的高曝光 surface 接入新系统。实现时优先复用现有语义 token 与 shared primitive，不引入新的主题模式或并行颜色体系。

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS v4, Radix UI, class-variance-authority, Vitest, Testing Library, Lucide

---

## Context To Carry Forward

- 已批准的 spec 在 `docs/superpowers/specs/2026-03-13-feedfuse-editorial-cobalt-color-design.md`。实现必须遵守以下硬约束：
  - 只做品牌钴蓝色彩增强，不改布局结构、信息架构和交互模型。
  - 继续沿用现有语义 token 名称；不要新增 `brand-*` 之类的并行 token 体系。
  - `success / warning / error` 仍保留语义色，只调整承载它们的表面层与阴影家族。
  - dialog / sheet / alert-dialog / toast 不要求机械复用同一个 class 名，但必须落到同一组蓝墨阴影家族，不能继续保留默认 `shadow-md`。
- `docs/summaries/2026-03-11-accessible-name-token-leak.md` 已锁定 reader、settings、feed list 的图标按钮必须保留中文 `aria-label`。这次改 tooltip / button / close button 样式时不能把内部 token 或英文文案重新带回去。
- `docs/summaries/2026-03-11-reader-hydration-snapshot-and-literal-state-build.md` 已锁定 `ReaderLayout` 与 `ArticleView` 的 viewport / 首帧渲染行为。颜色改动只能动 class 和 token，不要顺手改这些组件的 state 初始化或 hydration 逻辑。
- 当前会被本轮改动直接打破的现有断言：
  - `src/app/layout.metadata.test.ts` 仍断言 `themeColor` 是 `#ffffff` / `#020817`
  - `src/features/reader/ReaderToolbarIconButton.test.tsx` 与 `src/features/feeds/FeedList.test.tsx` 仍断言 tooltip 使用 `bg-black/80`
  - `src/components/ui/popover.tsx`、`src/components/ui/dialog.tsx`、`src/components/ui/sheet.tsx`、`src/components/ui/alert-dialog.tsx`、`src/features/toast/ToastHost.tsx` 仍保留 `shadow-md`
  - `src/components/ui/select.tsx` 的 `SelectContent` 仍保留 `shadow-sm`。虽然 spec 没单独点名 `select.tsx`，但它和 popover 同属高频浮层表面，如果不一起迁移，settings 的下拉层会残留默认视觉语气
- 现有测试切入点已经足够覆盖这轮回归，不需要新建测试文件：
  - 主题/契约：`src/app/layout.metadata.test.ts`、`src/app/globals-css.contract.test.ts`、`src/app/theme-token-usage.contract.test.ts`
  - shared surface：`src/features/reader/ReaderToolbarIconButton.test.tsx`、`src/features/feeds/FeedList.test.tsx`、`src/features/toast/ToastHost.test.tsx`
  - feature 回归：`src/features/reader/ReaderLayout.test.tsx`、`src/features/settings/SettingsCenterModal.test.tsx`、`src/features/articles/ArticleView.aiSummary.test.tsx`、`src/features/articles/ArticleView.aiTranslate.test.tsx`
- 相关技能：
  - `@impeccable-frontend-design`：保持品牌方向一致，不回退成默认 shadcn/surface 语言
  - `@vitest`：先更新会失败的断言，再做最小实现
  - `@vercel-react-best-practices`：只改 class / token / shared primitive，不顺手重写 reader/settings 结构
  - `@workflow-test-browser`：最终浏览器核验优先用它做 light/dark 视觉确认
- 执行本计划时应在独立 worktree 中进行；当前阶段只生成计划文档，不移动工作目录。

## File Map

### Modify

- `src/app/globals.css`
  - 建立品牌钴蓝 token、overlay、shadow、reader pane hover 变量
- `src/app/layout.tsx`
  - 更新 `viewport.themeColor` 到新的 light/dark 品牌底色
- `src/app/layout.metadata.test.ts`
  - 锁定新的 `themeColor` 值并移除旧白/近黑断言
- `src/app/globals-css.contract.test.ts`
  - 锁定旧中性背景/主色值已被替换，保留现有主题结构约束
- `src/app/theme-token-usage.contract.test.ts`
  - 扩展 tooltip / popover / select / dialog / sheet / alert-dialog 的品牌 surface 断言
- `src/lib/designSystem.ts`
  - 收紧 `FROSTED_HEADER_CLASS_NAME` 与 `FLOATING_SURFACE_CLASS_NAME`
- `src/components/ui/button.tsx`
  - 收紧 `outline / secondary / ghost / link` 层级，避免继续呈现默认控件语气
- `src/components/ui/tooltip.tsx`
  - 改为品牌化 tooltip surface，移除 `bg-black/80`
- `src/components/ui/popover.tsx`
  - 改为 `shadow-popover` 与品牌化边界/背景
- `src/components/ui/select.tsx`
  - 让 `SelectContent` 跟随同一浮层阴影与背景家族
- `src/components/ui/dialog.tsx`
  - 内容层从 `shadow-md` 迁移到品牌阴影家族
- `src/components/ui/sheet.tsx`
  - 内容层从 `shadow-md` 迁移到品牌阴影家族
- `src/components/ui/alert-dialog.tsx`
  - 内容层从 `shadow-md` 迁移到品牌阴影家族
- `src/features/toast/ToastHost.tsx`
  - 通知阴影和 hover surface 接入品牌家族
- `src/features/toast/ToastHost.test.tsx`
  - 锁定 toast root 不再使用默认阴影
- `src/features/reader/ReaderToolbarIconButton.test.tsx`
  - 锁定 tooltip 新 surface 断言
- `src/features/feeds/FeedList.test.tsx`
  - 锁定 add feed tooltip 新 surface 断言
- `src/features/reader/ReaderLayout.tsx`
  - 收紧左栏 / 中栏表面色与非桌面 header surface
- `src/features/reader/ReaderLayout.test.tsx`
  - 锁定 reader pane 的新表面层级和现有 separator 激活行为
- `src/features/settings/SettingsCenterDrawer.tsx`
  - 收紧 settings header、侧栏背景、tab active/hover 的品牌 surface
- `src/features/settings/SettingsCenterModal.test.tsx`
  - 锁定 settings 侧栏 surface 与现有 flat 控件回归
- `src/features/articles/ArticleView.tsx`
  - 收紧 AI 摘要卡、状态提示块与正文区辅助 surface
- `src/features/articles/ArticleView.aiSummary.test.tsx`
  - 锁定摘要卡与文章动作按钮仍符合品牌 surface 预期
- `src/features/articles/ArticleView.aiTranslate.test.tsx`
  - 锁定翻译等待/错误提示块的表面层不再使用旧 `bg-muted/30`

### Reuse Without Modification

- `src/components/ui/context-menu.tsx`
  - 已使用 `shadow-popover` 和 `bg-popover`，靠 token/阴影家族更新即可
- `src/app/(reader)/ReaderApp.tsx`
  - 只承载 theme hook 与 layout，不参与本轮表面层改动
- `src/hooks/useTheme.ts`
  - 主题切换逻辑不变
- `src/features/reader/ResizeHandle.tsx`
  - 继续复用 `primary / border` token，不单独改结构
- `src/features/toast/toastStore.ts`
  - 只验证行为，不改数据结构

## Chunk 1: Brand Token Foundation

### Task 1: 先锁定新品牌主题基线，再更新全局 token

**Files:**

- Modify: `src/app/layout.metadata.test.ts`
- Modify: `src/app/globals-css.contract.test.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: 先把主题契约改成“编辑感钴蓝”预期**

在 `src/app/layout.metadata.test.ts` 中，把旧断言改成新的品牌底色：

```ts
expect(source).toContain("color: '#f4f7ff'");
expect(source).toContain("color: '#111a30'");
expect(source).not.toContain("color: '#ffffff'");
expect(source).not.toContain("color: '#020817'");
```

在 `src/app/globals-css.contract.test.ts` 中追加“旧默认主题值已被替换”的断言：

```ts
expect(css).not.toContain('--color-background: hsl(0 0% 100%)');
expect(css).not.toContain('--color-primary: hsl(221.2 83.2% 53.3%)');
expect(css).not.toContain('--color-background: hsl(222.2 84% 4.9%)');
expect(css).not.toContain('--color-primary: hsl(217.2 91.2% 59.8%)');
```

- [ ] **Step 2: 运行主题契约测试并确认失败**

Run: `pnpm exec vitest run src/app/layout.metadata.test.ts src/app/globals-css.contract.test.ts`

Expected:

- `layout.metadata.test.ts` 因仍在读取旧 `themeColor` 失败
- `globals-css.contract.test.ts` 因 `globals.css` 仍包含旧默认 light/dark token 值失败

- [ ] **Step 3: 在 `layout.tsx` 与 `globals.css` 中实现品牌钴蓝主题基线**

在 `src/app/layout.tsx` 里把 `viewport.themeColor` 改成与背景对齐的新值：

```ts
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f7ff' },
    { media: '(prefers-color-scheme: dark)', color: '#111a30' },
  ],
};
```

在 `src/app/globals.css` 中，把主要 token 收紧到同一家族。实现时不要重命名 token，直接替换值。推荐以这组 HSL 作为起点：

```css
--color-background: hsl(220 44% 97%);
--color-foreground: hsl(224 36% 18%);
--color-card: hsl(220 42% 98%);
--color-card-foreground: hsl(224 36% 18%);
--color-popover: hsl(220 40% 98%);
--color-popover-foreground: hsl(224 36% 18%);
--color-primary: hsl(224 54% 42%);
--color-primary-foreground: hsl(220 45% 98%);
--color-secondary: hsl(221 36% 93%);
--color-secondary-foreground: hsl(224 32% 22%);
--color-muted: hsl(221 33% 94%);
--color-muted-foreground: hsl(223 18% 41%);
--color-accent: hsl(221 37% 92%);
--color-accent-foreground: hsl(224 32% 22%);
--color-border: hsl(223 27% 87%);
--color-input: hsl(223 27% 87%);
--color-ring: hsl(224 54% 42%);
--color-overlay: hsl(224 41% 12% / 0.58);
--shadow-popover: 0 24px 48px -28px rgb(22 34 71 / 0.34), 0 14px 24px -20px rgb(22 34 71 / 0.24);

.dark {
  --color-background: hsl(226 34% 11%);
  --color-foreground: hsl(220 36% 95%);
  --color-card: hsl(226 30% 13%);
  --color-card-foreground: hsl(220 36% 95%);
  --color-popover: hsl(226 30% 14%);
  --color-popover-foreground: hsl(220 36% 95%);
  --color-primary: hsl(221 72% 67%);
  --color-primary-foreground: hsl(226 34% 14%);
  --color-secondary: hsl(224 20% 20%);
  --color-secondary-foreground: hsl(220 36% 95%);
  --color-muted: hsl(224 18% 18%);
  --color-muted-foreground: hsl(220 18% 71%);
  --color-accent: hsl(224 21% 22%);
  --color-accent-foreground: hsl(220 36% 96%);
  --color-border: hsl(223 18% 26%);
  --color-input: hsl(223 18% 26%);
  --color-ring: hsl(221 72% 67%);
  --color-overlay: hsl(228 48% 6% / 0.74);
  --shadow-popover: 0 28px 60px -34px rgb(3 8 22 / 0.8), 0 18px 28px -24px rgb(9 18 46 / 0.62);
}
```

Implementation notes:

- `success / warning / error` 的 hue 家族可保留，但如果对比度不够，可以只微调它们的 foreground。
- 保留 `--reader-pane-hover` 变量；后续 reader pane 仍依赖它。
- 不要在这一 task 顺手改 `Button`、`Tooltip` 或 feature 文件；本 task 只建立 token 基线。

- [ ] **Step 4: 重新运行主题契约测试**

Run: `pnpm exec vitest run src/app/layout.metadata.test.ts src/app/globals-css.contract.test.ts`

Expected: PASS

- [ ] **Step 5: 提交主题基线**

```bash
git add src/app/layout.tsx src/app/globals.css src/app/layout.metadata.test.ts src/app/globals-css.contract.test.ts
git commit -m "feat(主题): 收紧编辑感钴蓝主题基线" -m "- 更新 light dark themeColor 与全局品牌 token\n- 统一 overlay 和 shadow-popover 的蓝墨家族\n- 锁定新主题契约并移除旧默认色断言"
```

## Chunk 2: Shared Surface Language

### Task 2: 先锁定共享表面回归，再统一 tooltip / popover / select / dialog / toast

**Files:**

- Modify: `src/app/theme-token-usage.contract.test.ts`
- Modify: `src/features/reader/ReaderToolbarIconButton.test.tsx`
- Modify: `src/features/feeds/FeedList.test.tsx`
- Modify: `src/features/toast/ToastHost.test.tsx`
- Modify: `src/lib/designSystem.ts`
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/tooltip.tsx`
- Modify: `src/components/ui/popover.tsx`
- Modify: `src/components/ui/select.tsx`
- Modify: `src/components/ui/dialog.tsx`
- Modify: `src/components/ui/sheet.tsx`
- Modify: `src/components/ui/alert-dialog.tsx`
- Modify: `src/features/toast/ToastHost.tsx`

- [ ] **Step 1: 先更新 shared surface 的契约和行为断言**

在 `src/app/theme-token-usage.contract.test.ts` 中扩展文件读取与断言：

```ts
const tooltipSource = readFileSync('src/components/ui/tooltip.tsx', 'utf-8');
const popoverSource = readFileSync('src/components/ui/popover.tsx', 'utf-8');
const selectSource = readFileSync('src/components/ui/select.tsx', 'utf-8');

expect(tooltipSource).toContain('bg-popover');
expect(tooltipSource).toContain('text-popover-foreground');
expect(tooltipSource).toContain('shadow-popover');
expect(tooltipSource).not.toContain('bg-black/80');

expect(popoverSource).toContain('shadow-popover');
expect(popoverSource).not.toContain('shadow-md');

expect(selectSource).toContain('shadow-popover');
expect(selectSource).not.toContain('shadow-sm');

expect(dialogSource).not.toContain('shadow-md');
expect(sheetSource).not.toContain('shadow-md');
expect(alertDialogSource).not.toContain('shadow-md');
```

在 `src/features/reader/ReaderToolbarIconButton.test.tsx` 与 `src/features/feeds/FeedList.test.tsx` 中，把 tooltip 预期改成：

```ts
expect(document.body.querySelector('[data-side="bottom"]')).toHaveClass(
  'bg-popover',
  'text-popover-foreground',
  'shadow-popover',
);
expect(document.body.querySelector('[data-side="bottom"]')).not.toHaveClass('bg-black/80');
```

在 `src/features/toast/ToastHost.test.tsx` 中补一条 root class 断言：

```ts
const toastRoot = await screen.findByRole('status');
expect(toastRoot.className).toContain('shadow-popover');
expect(toastRoot.className).not.toContain('shadow-md');
```

- [ ] **Step 2: 运行 shared surface 回归并确认失败**

Run: `pnpm exec vitest run src/app/theme-token-usage.contract.test.ts src/features/reader/ReaderToolbarIconButton.test.tsx src/features/feeds/FeedList.test.tsx src/features/toast/ToastHost.test.tsx`

Expected:

- tooltip 相关测试因仍渲染 `bg-black/80` 失败
- contract test 因 popover/select/dialog/sheet/alert-dialog 仍含 `shadow-md` / `shadow-sm` 失败
- `ToastHost.test.tsx` 因 root 仍为 `shadow-md` 失败

- [ ] **Step 3: 在 shared primitive 层实现品牌表面语言**

按下面的方向修改共享层：

```ts
// src/lib/designSystem.ts
export const FROSTED_HEADER_CLASS_NAME =
  'border-b border-border/70 bg-background/88 backdrop-blur-xl supports-[backdrop-filter]:bg-background/72';

export const FLOATING_SURFACE_CLASS_NAME =
  'border border-border/60 bg-background/88 backdrop-blur-md supports-[backdrop-filter]:bg-background/78';
```

```ts
// src/components/ui/button.tsx
outline:
  'border border-border/80 bg-background/85 hover:bg-accent/70 hover:text-accent-foreground',
secondary:
  'bg-secondary text-secondary-foreground hover:bg-accent/85',
ghost:
  'text-muted-foreground hover:bg-accent/80 hover:text-foreground',
link:
  'text-primary underline-offset-4 hover:text-primary/88 hover:underline',
```

```ts
// src/components/ui/tooltip.tsx
'z-50 overflow-hidden rounded-md border border-border/70 bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-popover backdrop-blur-sm supports-[backdrop-filter]:bg-popover/88 ...'

// src/components/ui/popover.tsx
'z-50 w-72 rounded-xl border border-border/80 bg-popover p-4 text-popover-foreground shadow-popover backdrop-blur-md supports-[backdrop-filter]:bg-popover/92 ...'

// src/components/ui/select.tsx
'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-popover backdrop-blur-md supports-[backdrop-filter]:bg-popover/92 ...'

// src/components/ui/dialog.tsx / sheet.tsx / alert-dialog.tsx
// 只替换内容层 surface，不改 motion 逻辑
'... border bg-background shadow-popover supports-[backdrop-filter]:bg-background/92 ...'

// src/features/toast/ToastHost.tsx
'pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 shadow-popover backdrop-blur-sm outline-none'
```

Implementation notes:

- `dialog-motion` 只负责 transform origin，不要动它。
- `context-menu.tsx` 已依赖 `shadow-popover`，本 task 不需要改文件本身。
- `ToastHost` 的语义色仍保留当前 `success / error / info` 类，只把 root surface 和关闭按钮 hover 统一到品牌语境。

- [ ] **Step 4: 重新运行 shared surface 回归**

Run: `pnpm exec vitest run src/app/theme-token-usage.contract.test.ts src/features/reader/ReaderToolbarIconButton.test.tsx src/features/feeds/FeedList.test.tsx src/features/toast/ToastHost.test.tsx`

Expected: PASS

- [ ] **Step 5: 提交共享表面语言**

```bash
git add src/app/theme-token-usage.contract.test.ts src/lib/designSystem.ts src/components/ui/button.tsx src/components/ui/tooltip.tsx src/components/ui/popover.tsx src/components/ui/select.tsx src/components/ui/dialog.tsx src/components/ui/sheet.tsx src/components/ui/alert-dialog.tsx src/features/toast/ToastHost.tsx src/features/toast/ToastHost.test.tsx src/features/reader/ReaderToolbarIconButton.test.tsx src/features/feeds/FeedList.test.tsx
git commit -m "feat(ui): 统一品牌化浮层与控件表面" -m "- 让 tooltip popover select dialog sheet alert-dialog 进入同一蓝墨阴影家族\n- 收紧 header surface 与按钮层级的品牌语气\n- 更新 shared surface 契约与 tooltip toast 回归断言"
```

## Chunk 3: High-Exposure Feature Integration

### Task 3: 先锁定 reader / settings / article 的高曝光表面回归，再接入新系统

**Files:**

- Modify: `src/features/reader/ReaderLayout.test.tsx`
- Modify: `src/features/settings/SettingsCenterModal.test.tsx`
- Modify: `src/features/articles/ArticleView.aiSummary.test.tsx`
- Modify: `src/features/articles/ArticleView.aiTranslate.test.tsx`
- Modify: `src/features/reader/ReaderLayout.tsx`
- Modify: `src/features/settings/SettingsCenterDrawer.tsx`
- Modify: `src/features/articles/ArticleView.tsx`

- [ ] **Step 1: 先把高曝光区域的类名断言更新为品牌 surface 预期**

在 `src/features/reader/ReaderLayout.test.tsx` 的 `highlights only one existing separator at a time on hover` 用例里增加：

```ts
expect(feedPane.className).toContain('bg-muted/55');
expect(articlePane.className).toContain('bg-muted/15');
```

在 `src/features/settings/SettingsCenterModal.test.tsx` 的 `uses flat controls across settings sections` 用例里增加：

```ts
const settingsNav = screen.getByLabelText('设置导航').closest('aside');
expect(settingsNav?.className).toContain('bg-muted/40');
expect(settingsNav?.className).toContain('supports-[backdrop-filter]:bg-muted/30');
```

在 `src/features/articles/ArticleView.aiSummary.test.tsx` 中，补充对 AI 摘要卡与按钮组的表面断言：

```ts
const aiSummaryCard = screen.getByLabelText('AI 摘要');
expect(aiSummaryCard.className).toContain('bg-primary/10');
expect(aiSummaryCard.className).toContain('border-l-primary/30');
```

在 `src/features/articles/ArticleView.aiTranslate.test.tsx` 中，针对“请先等待全文抓取完成，再开始翻译”或同类提示块增加：

```ts
const waitingPanel = screen.getByText('请先等待全文抓取完成，再开始翻译').parentElement;
expect(waitingPanel?.className).toContain('bg-muted/35');
expect(waitingPanel?.className).not.toContain('bg-muted/30');
```

- [ ] **Step 2: 运行 feature 回归并确认失败**

Run: `pnpm exec vitest run src/features/reader/ReaderLayout.test.tsx src/features/settings/SettingsCenterModal.test.tsx src/features/articles/ArticleView.aiSummary.test.tsx src/features/articles/ArticleView.aiTranslate.test.tsx`

Expected:

- reader / settings / article 断言因类名仍停留在旧表面层失败

- [ ] **Step 3: 在 feature 文件中接入新的品牌表面层**

按下面的方向更新页面级 class：

```tsx
// src/features/reader/ReaderLayout.tsx
'shrink-0 overflow-hidden border-r bg-muted/55 transition-colors duration-200'
'shrink-0 border-r bg-muted/15 transition-colors duration-200'

// src/features/settings/SettingsCenterDrawer.tsx
const settingsSectionTabClassName =
  'group relative ... hover:border-border/70 hover:bg-background/55 hover:text-foreground data-[state=active]:border-border/80 data-[state=active]:bg-background/78 ...';

<aside className="border-b border-border/70 bg-muted/40 backdrop-blur md:w-60 md:shrink-0 md:border-b-0 md:border-r supports-[backdrop-filter]:bg-muted/30">

// src/features/articles/ArticleView.tsx
// 所有状态提示块
'mb-4 rounded-xl border border-border/70 bg-muted/35 px-4 py-3 ...'

// AI 摘要卡
'relative mb-4 cursor-pointer rounded-xl border border-border/65 border-l-2 border-l-primary/30 bg-primary/10 px-4 py-3'

// 摘要 chip
'inline-flex items-center gap-1.5 rounded-full bg-background/70 px-2 py-0.5 ... ring-1 ring-border/60'
```

Implementation notes:

- reader pane 的 active 边框逻辑和 `border-primary/60` 测试保持不变；本 task 只强化背景层次。
- settings 的 `TabsTrigger` 不要改结构或事件处理，只改 `settingsSectionTabClassName` 与 `aside` surface。
- `ArticleView` 只统一高曝光提示块和摘要卡，不改流式摘要、翻译、全文抓取的业务判断。

- [ ] **Step 4: 重新运行 feature 回归**

Run: `pnpm exec vitest run src/features/reader/ReaderLayout.test.tsx src/features/settings/SettingsCenterModal.test.tsx src/features/articles/ArticleView.aiSummary.test.tsx src/features/articles/ArticleView.aiTranslate.test.tsx`

Expected: PASS

- [ ] **Step 5: 提交高曝光区域接入**

```bash
git add src/features/reader/ReaderLayout.tsx src/features/reader/ReaderLayout.test.tsx src/features/settings/SettingsCenterDrawer.tsx src/features/settings/SettingsCenterModal.test.tsx src/features/articles/ArticleView.tsx src/features/articles/ArticleView.aiSummary.test.tsx src/features/articles/ArticleView.aiTranslate.test.tsx
git commit -m "feat(reader): 接入编辑感钴蓝高曝光表面" -m "- 收紧 reader settings article 的关键 surface 层次\n- 统一摘要卡和状态提示块的品牌气质\n- 补齐高曝光区域的回归断言"
```

## Chunk 4: Final Verification

### Task 4: 跑完整验证并完成浏览器核验

**Files:**

- Read: `docs/superpowers/specs/2026-03-13-feedfuse-editorial-cobalt-color-design.md`
- Read: `src/app/globals.css`
- Read: `src/features/reader/ReaderLayout.tsx`
- Read: `src/features/settings/SettingsCenterDrawer.tsx`
- Read: `src/features/articles/ArticleView.tsx`
- Read: `src/features/toast/ToastHost.tsx`

- [ ] **Step 1: 跑本轮最小完整测试集**

Run:

```bash
pnpm exec vitest run \
  src/app/layout.metadata.test.ts \
  src/app/globals-css.contract.test.ts \
  src/app/theme-token-usage.contract.test.ts \
  src/features/reader/ReaderToolbarIconButton.test.tsx \
  src/features/feeds/FeedList.test.tsx \
  src/features/toast/ToastHost.test.tsx \
  src/features/reader/ReaderLayout.test.tsx \
  src/features/settings/SettingsCenterModal.test.tsx \
  src/features/articles/ArticleView.aiSummary.test.tsx \
  src/features/articles/ArticleView.aiTranslate.test.tsx
```

Expected: PASS

- [ ] **Step 2: 跑全量单测**

Run: `pnpm test:unit`

Expected: PASS

- [ ] **Step 3: 跑生产构建，确认主题与类型没有回归**

Run: `pnpm run build`

Expected:

- `Compiled successfully`
- `Running TypeScript` 通过
- `Generating static pages` 完成

- [ ] **Step 4: 做浏览器核验**

如果 dev server 未启动，先运行：`pnpm dev`

然后用 `@workflow-test-browser` 或手动浏览器检查 `http://localhost:9559`，至少确认以下场景：

1. 默认 light 模式下 reader 左栏、中栏、右栏的层次关系明显，但不再是默认灰底。
2. 在 settings 中切到 `浅色 / 深色 / 跟随系统`，确认 `themeColor`、header、侧栏、select 下拉层、dialog/sheet/alert-dialog 的 overlay 与内容层阴影属于同一蓝墨家族。
3. hover/focus 一次 add feed tooltip、reader toolbar tooltip、feed context menu、toast 提醒，确认没有孤立的 `bg-black` tooltip 或默认灰白浮层。
4. 进入有 AI 摘要 / 翻译等待态的文章，确认摘要卡和状态面板的表面层比正文更明显，但不会压过正文内容。

- [ ] **Step 5: 仅在验证发现问题时追加修复提交**

如果 Step 1-4 全绿且无视觉问题，不追加提交。

如果浏览器核验或 build 暴露问题，按最小修复范围处理，并单独提交：

```bash
git add <relevant-files>
git commit -m "fix(主题): 收口品牌钴蓝回归问题" -m "- 修复验证阶段暴露的主题或表面层回归\n- 保持语义 token 与共享表面一致性\n- 补齐对应测试或契约断言"
```

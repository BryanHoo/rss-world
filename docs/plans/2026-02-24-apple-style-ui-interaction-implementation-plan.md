# Apple Style UI & Interaction Redesign Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 在不改变业务逻辑与信息架构的前提下，将现网 UI（`src/features/*`、`src/components/common/*`、`src/app/*`）完整迁移到 Apple 风格浅色体验，并建立可回归的样式契约防线。  

**Architecture:** 采用 Token-First 双层架构：先在 `src/app/globals.css` 建立 Apple 风格 token 与浅色基线，再在组件层按语义化样式配方重构。全程保持三栏布局、设置抽屉、store 状态流、可访问性锚点与测试行为不变，仅替换表现层和微交互。  

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、TailwindCSS v4、Zustand、Vitest + Testing Library

---

## 0. Sequential Input Gathering Record

### Step 1: Prior Art Scan（project first, then global）

**Commands run:**

```bash
if [ -d docs/solutions ]; then echo '[project] docs/solutions exists'; ls -la docs/solutions; else echo '[project] docs/solutions missing'; fi
if [ -d ~/.agents/docs/solutions ]; then echo '[global] ~/.agents/docs/solutions exists'; ls -la ~/.agents/docs/solutions; else echo '[global] ~/.agents/docs/solutions missing'; fi
rg -n "apple|Apple|style|design system|ReaderLayout|FeedList|ArticleList|ArticleView|AppDrawer|AppDialog|SettingsCenterDrawer|AddFeedDialog" docs/solutions ~/.agents/docs/solutions 2>/dev/null | head -n 80 || true
```

**Result:** 项目与全局均无 `docs/solutions` 可复用记录，本计划不依赖 solution corpus。

**Risks / Pitfalls to track:**

1. 无先例可复用，容易在实现阶段风格漂移，必须先锁定 token 与禁用模式。
2. 样式改动面大，若无契约测试，后续容易回归到 `dark:*`、`shadow-*`、`bg-gradient*`。
3. 近期刚有 `editorial` 设计文档，需避免 Apple 与 editorial 混用语义类。

### Step 2: Codebase Entry Points and Call Chains

**Key paths and chain:**

1. `src/app/(reader)/page.tsx` -> `src/app/(reader)/ReaderApp.tsx` -> `src/features/reader/ReaderLayout.tsx`
2. `src/features/reader/ReaderLayout.tsx` -> `src/features/feeds/FeedList.tsx`
3. `src/features/reader/ReaderLayout.tsx` -> `src/features/articles/ArticleList.tsx`
4. `src/features/reader/ReaderLayout.tsx` -> `src/features/articles/ArticleView.tsx`
5. `src/features/reader/ReaderLayout.tsx` -> `src/features/settings/SettingsCenterModal.tsx` -> `src/features/settings/SettingsCenterDrawer.tsx`
6. `src/features/settings/SettingsCenterDrawer.tsx` / `src/features/feeds/AddFeedDialog.tsx` -> `src/components/common/AppDrawer.tsx` / `src/components/common/AppDialog.tsx`
7. `src/app/layout.tsx` -> `src/app/globals.css`
8. `src/app/(reader)/ReaderApp.tsx` -> `src/hooks/useTheme.ts`（当前仍支持 `light/dark/auto`）

**Commands run:**

```bash
sed -n '1,240p' 'src/app/(reader)/page.tsx'
sed -n '1,260p' 'src/app/(reader)/ReaderApp.tsx'
sed -n '1,260p' src/features/reader/ReaderLayout.tsx
sed -n '1,340p' src/features/feeds/FeedList.tsx
sed -n '1,340p' src/features/articles/ArticleList.tsx
sed -n '1,340p' src/features/articles/ArticleView.tsx
sed -n '1,380p' src/features/settings/SettingsCenterDrawer.tsx
sed -n '1,340p' src/components/common/AppDrawer.tsx
sed -n '1,340p' src/components/common/AppDialog.tsx
sed -n '1,260p' src/app/globals.css
sed -n '1,220p' src/hooks/useTheme.ts
```

**Risks / Pitfalls to track:**

1. 现网路径与旧目录并存，本次只改 `src/features/*`、`src/components/common/*`、`src/app/*`，不能误动 `src/components/{Layout,FeedList,ArticleList,ArticleView,Settings}`。
2. `open-settings`、`add-feed`、`close-settings`、`settings-center-modal`、`settings-section-tab-*` 被测试强依赖，不可改名。
3. `useTheme` 与外观面板若不同步收敛，易出现“UI 仅浅色但状态仍可写 dark/auto”的行为偏差。
4. `AppDrawer` / `AppDialog` 是共享壳层，改动会放大影响到设置与添加源流程。
5. 样式迁移不能触碰 autosave、validation、RSS 校验门禁逻辑。

### Step 3: Existing Test/Verify Commands

**Source:**

1. `package.json` scripts
2. `README.md` 验证章节
3. 现有关键测试：
   - `src/features/reader/ReaderLayout.test.tsx`
   - `src/features/settings/SettingsCenterModal.test.tsx`
   - `src/features/feeds/AddFeedDialog.test.tsx`
   - `src/components/common/AppDrawer.test.tsx`
   - `src/app/globals-css.contract.test.ts`
   - `src/hooks/useTheme.test.tsx`

**Commands to reuse:**

```bash
pnpm run test:unit
pnpm run test:unit -- src/app/globals-css.contract.test.ts
pnpm run test:unit -- src/hooks/useTheme.test.tsx
pnpm run test:unit -- src/components/common/AppDrawer.test.tsx
pnpm run test:unit -- src/features/reader/ReaderLayout.test.tsx
pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx
pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx
pnpm run lint
pnpm run build
node scripts/verify-next-migration.mjs
```

**Risks / Pitfalls to track:**

1. 仅靠功能测试无法约束视觉回归，必须补样式契约测试。
2. 类名断言易脆弱，优先断言禁用模式（regex）与关键语义锚点。
3. 如果只跑局部测试，会漏掉共享壳层的连锁影响；末尾必须执行全量验证。
4. README 当前写有深色/自动，需要同步更新为 light-only。

## 1. Execution Rules

1. 实施前建议先用 `workflow-using-git-worktrees` 创建独立 worktree，再执行本计划。
2. 只改现网路径：`src/features/*`、`src/components/common/*`、`src/app/*`。
3. 不改变信息架构与业务逻辑：store action、autosave、validation、RSS 门禁保持现有语义。
4. 保持可访问性与测试锚点：`open-settings`、`add-feed`、`close-settings`、`settings-center-modal`、`settings-center-overlay`、`settings-section-tab-*`。
5. 每个任务按 Red-Green-Refactor 执行并单独 commit（频繁小提交）。

## 2. Task Breakdown

### Task 1: 建立 Apple 全局 token 与浅色基线契约

**Files:**

- Modify: `src/app/globals.css`
- Modify: `src/app/globals-css.contract.test.ts`
- Create: `src/app/apple-style.contract.test.ts`

**Step 1: Write the failing test**

```ts
// src/app/globals-css.contract.test.ts
it('defines apple-style light-only baseline', () => {
  const css = readFileSync('src/app/globals.css', 'utf-8');
  expect(css).toContain('@import "tailwindcss";');
  expect(css).toContain("bg-[#f5f5f7]");
  expect(css).toContain("font-family: -apple-system");
  expect(css).not.toContain('@custom-variant dark');
});
```

```ts
// src/app/apple-style.contract.test.ts
it('rejects forbidden utility patterns in app layer', () => {
  const content = readFileSync('src/app/globals.css', 'utf-8');
  expect(content).not.toMatch(/bg-gradient/);
  expect(content).not.toMatch(/shadow-(?:2xl|inner)/);
  expect(content).not.toMatch(/border-(?:2|4|8)\b/);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test:unit -- src/app/globals-css.contract.test.ts src/app/apple-style.contract.test.ts
```

Expected: FAIL（当前仍存在 `@custom-variant dark`，且缺少 Apple token）

**Step 3: Write minimal implementation**

```css
/* src/app/globals.css */
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@layer base {
  body {
    @apply bg-[#f5f5f7] text-[#1d1d1f] antialiased;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Noto Sans SC', sans-serif;
  }
}
```

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm run test:unit -- src/app/globals-css.contract.test.ts src/app/apple-style.contract.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/globals.css src/app/globals-css.contract.test.ts src/app/apple-style.contract.test.ts
git commit -m "test(ui): 建立 apple-style 全局样式基线契约"
```

### Task 2: 收敛为浅色-only 主题策略

**Files:**

- Modify: `src/hooks/useTheme.ts`
- Modify: `src/hooks/useTheme.test.tsx`
- Modify: `src/features/settings/panels/AppearanceSettingsPanel.tsx`
- Modify: `src/features/settings/settingsSchema.ts`
- Modify: `src/features/settings/SettingsCenterModal.test.tsx`
- Modify: `README.md`

**Step 1: Write the failing test**

```ts
// src/hooks/useTheme.test.tsx
it('always removes dark class in light-only mode', () => {
  document.documentElement.classList.add('dark');
  render(<Harness />);
  expect(document.documentElement.classList.contains('dark')).toBe(false);
});
```

```ts
// src/features/settings/SettingsCenterModal.test.tsx
it('appearance panel exposes only light option', async () => {
  render(<ReaderLayout />);
  fireEvent.click(screen.getByLabelText('open-settings'));
  await screen.findByTestId('settings-center-modal');

  expect(screen.getByRole('button', { name: '浅色' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '深色' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '自动' })).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test:unit -- src/hooks/useTheme.test.tsx src/features/settings/SettingsCenterModal.test.tsx
```

Expected: FAIL（当前仍支持 `dark/auto` 并渲染对应按钮）

**Step 3: Write minimal implementation**

```ts
// src/hooks/useTheme.ts
useEffect(() => {
  window.document.documentElement.classList.remove('dark');
}, []);
```

```ts
// src/features/settings/panels/AppearanceSettingsPanel.tsx
const themeOptions = [{ value: 'light', label: '浅色', icon: Sun }] as const;
```

```ts
// src/features/settings/settingsSchema.ts
theme: 'light',
// normalize 时把输入统一归一到 'light'
theme: 'light',
```

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm run test:unit -- src/hooks/useTheme.test.tsx src/features/settings/SettingsCenterModal.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/useTheme.ts src/hooks/useTheme.test.tsx src/features/settings/panels/AppearanceSettingsPanel.tsx src/features/settings/settingsSchema.ts src/features/settings/SettingsCenterModal.test.tsx README.md
git commit -m "feat(ui): 收敛浅色-only主题并更新外观面板"
```

### Task 3: 重做共享壳层 AppDrawer/AppDialog 为 Apple 基座

**Files:**

- Modify: `src/components/common/AppDrawer.tsx`
- Modify: `src/components/common/AppDialog.tsx`
- Modify: `src/components/common/AppDrawer.test.tsx`
- Modify: `src/app/apple-style.contract.test.ts`

**Step 1: Write the failing test**

```ts
// src/components/common/AppDrawer.test.tsx
it('keeps right drawer behavior with apple shell classes', () => {
  render(<AppDrawer open onOpenChange={() => {}} title="设置" closeLabel="close-settings" testId="settings-center-modal"><div>content</div></AppDrawer>);
  const panel = screen.getByTestId('settings-center-modal');
  expect(panel.className).toContain('right-0');
  expect(panel.className).toContain('rounded-2xl');
  expect(panel.className).not.toContain('bg-gradient');
});
```

```ts
// src/app/apple-style.contract.test.ts
const commonFiles = ['src/components/common/AppDrawer.tsx', 'src/components/common/AppDialog.tsx'];
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test:unit -- src/components/common/AppDrawer.test.tsx src/app/apple-style.contract.test.ts
```

Expected: FAIL（当前 `AppDrawer` 含 `bg-gradient`、重阴影样式）

**Step 3: Write minimal implementation**

```tsx
// AppDrawer/AppDialog class direction example
className="... rounded-2xl border border-gray-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] ..."
```

实现要点：

1. 保留 `right-0`、Esc、overlay click、focus restore 行为。
2. 移除渐变与 dark 依赖。
3. 统一 close button、header、footer 的 Apple 视觉层级。

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm run test:unit -- src/components/common/AppDrawer.test.tsx src/app/apple-style.contract.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/common/AppDrawer.tsx src/components/common/AppDialog.tsx src/components/common/AppDrawer.test.tsx src/app/apple-style.contract.test.ts
git commit -m "feat(ui): 统一 AppDrawer/AppDialog 为 apple-style 壳层"
```

### Task 4: ReaderLayout + FeedList Apple 重皮肤

**Files:**

- Modify: `src/features/reader/ReaderLayout.tsx`
- Modify: `src/features/feeds/FeedList.tsx`
- Modify: `src/app/apple-style.contract.test.ts`
- Test: `src/features/reader/ReaderLayout.test.tsx`

**Step 1: Write the failing test**

```ts
// src/app/apple-style.contract.test.ts
const readerFiles = ['src/features/reader/ReaderLayout.tsx', 'src/features/feeds/FeedList.tsx'];
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test:unit -- src/app/apple-style.contract.test.ts src/features/reader/ReaderLayout.test.tsx
```

Expected: FAIL（当前文件含 `dark:*` 与 `bg-blue*` 强依赖）

**Step 3: Write minimal implementation**

```tsx
// ReaderLayout direction
<div className="relative flex h-screen overflow-hidden bg-[#f5f5f7] text-[#1d1d1f]">
```

```tsx
// FeedList selected state direction
selected ? 'bg-[#0071e3]/10 text-[#1d1d1f]' : 'text-[#1d1d1f] hover:bg-black/[0.04]'
```

实现要点：

1. 保留三栏布局宽度、按钮语义与分类展开逻辑。
2. `open-settings`、`add-feed` 锚点不变。
3. 仅替换样式，不改分组/筛选/选择行为。

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm run test:unit -- src/app/apple-style.contract.test.ts src/features/reader/ReaderLayout.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/reader/ReaderLayout.tsx src/features/feeds/FeedList.tsx src/app/apple-style.contract.test.ts src/features/reader/ReaderLayout.test.tsx
git commit -m "feat(ui): 重构 ReaderLayout 与 FeedList 为 apple-style"
```

### Task 5: ArticleList Apple 重皮肤

**Files:**

- Modify: `src/features/articles/ArticleList.tsx`
- Modify: `src/app/apple-style.contract.test.ts`

**Step 1: Write the failing test**

```ts
// src/app/apple-style.contract.test.ts
const articleListFiles = ['src/features/articles/ArticleList.tsx'];
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test:unit -- src/app/apple-style.contract.test.ts
```

Expected: FAIL（当前 `ArticleList.tsx` 含 `dark:*`、`bg-blue*`、圆角混用）

**Step 3: Write minimal implementation**

```tsx
// ArticleList item direction
selectedArticleId === article.id
  ? 'bg-[#0071e3]/8'
  : 'hover:bg-black/[0.03]'
```

实现要点：

1. 标题/摘要/元信息层级按 Apple 文本对比收敛。
2. 保留 `toggle-unread-only`、`mark-all-as-read` 行为与 aria。
3. 缩略图仅调整视觉（圆角/背景），不改数据解析逻辑。

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm run test:unit -- src/app/apple-style.contract.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/articles/ArticleList.tsx src/app/apple-style.contract.test.ts
git commit -m "feat(ui): 重构 ArticleList 为 apple-style 列表样式"
```

### Task 6: ArticleView Apple 重皮肤

**Files:**

- Modify: `src/features/articles/ArticleView.tsx`
- Modify: `src/app/apple-style.contract.test.ts`

**Step 1: Write the failing test**

```ts
// src/app/apple-style.contract.test.ts
const articleViewFiles = ['src/features/articles/ArticleView.tsx'];
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test:unit -- src/app/apple-style.contract.test.ts
```

Expected: FAIL（当前存在 dark/重色按钮体系）

**Step 3: Write minimal implementation**

```tsx
// ArticleView action button direction
className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f5f7] px-3 py-1.5 text-sm text-[#1d1d1f] hover:opacity-85"
```

实现要点：

1. 标题、元信息、正文 `prose` 层级统一到浅色 Apple 语义。
2. 收藏/原文/翻译/AI 摘要操作仅做视觉重构，不改事件处理。
3. 保留 `markAsRead` 延时逻辑与 `toggleStar` 数据流。

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm run test:unit -- src/app/apple-style.contract.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/articles/ArticleView.tsx src/app/apple-style.contract.test.ts
git commit -m "feat(ui): 重构 ArticleView 为 apple-style 阅读视图"
```

### Task 7: SettingsCenter 与 AddFeedDialog Apple 重皮肤

**Files:**

- Modify: `src/features/settings/SettingsCenterDrawer.tsx`
- Modify: `src/features/settings/panels/AppearanceSettingsPanel.tsx`
- Modify: `src/features/settings/panels/AISettingsPanel.tsx`
- Modify: `src/features/settings/panels/CategoriesSettingsPanel.tsx`
- Modify: `src/features/feeds/AddFeedDialog.tsx`
- Modify: `src/app/apple-style.contract.test.ts`
- Test: `src/features/settings/SettingsCenterModal.test.tsx`
- Test: `src/features/feeds/AddFeedDialog.test.tsx`

**Step 1: Write the failing test**

```ts
// src/app/apple-style.contract.test.ts
const settingsAndDialogFiles = [
  'src/features/settings/SettingsCenterDrawer.tsx',
  'src/features/settings/panels/AppearanceSettingsPanel.tsx',
  'src/features/settings/panels/AISettingsPanel.tsx',
  'src/features/settings/panels/CategoriesSettingsPanel.tsx',
  'src/features/feeds/AddFeedDialog.tsx',
];
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test:unit -- src/app/apple-style.contract.test.ts src/features/settings/SettingsCenterModal.test.tsx src/features/feeds/AddFeedDialog.test.tsx
```

Expected: FAIL（当前设置区与添加源弹窗仍有渐变、dark 与蓝色重强调）

**Step 3: Write minimal implementation**

```tsx
// Settings tab selected direction
selected
  ? 'border-[#0071e3]/30 bg-[#0071e3]/8 text-[#1d1d1f]'
  : 'border-transparent bg-white hover:bg-[#f5f5f7]'
```

```tsx
// AddFeedDialog input direction
className="h-10 w-full rounded-xl bg-[#f5f5f7] px-3 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none"
```

实现要点：

1. 保留 autosave 状态语义与关闭确认流程。
2. 保留表单校验与 RSS 验证门禁逻辑。
3. 保留全部测试锚点命名不变。

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm run test:unit -- src/app/apple-style.contract.test.ts src/features/settings/SettingsCenterModal.test.tsx src/features/feeds/AddFeedDialog.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/settings/SettingsCenterDrawer.tsx src/features/settings/panels/AppearanceSettingsPanel.tsx src/features/settings/panels/AISettingsPanel.tsx src/features/settings/panels/CategoriesSettingsPanel.tsx src/features/feeds/AddFeedDialog.tsx src/app/apple-style.contract.test.ts src/features/settings/SettingsCenterModal.test.tsx src/features/feeds/AddFeedDialog.test.tsx
git commit -m "feat(ui): 重构设置中心与添加源弹窗为 apple-style"
```

### Task 8: 最终契约收口与全量验证

**Files:**

- Modify: `src/app/apple-style.contract.test.ts`
- Modify: `README.md`（若仍有旧主题描述）

**Step 1: Write the failing test**

```ts
// src/app/apple-style.contract.test.ts
it('rejects forbidden patterns across app/common/features runtime UI paths', () => {
  const files = [
    // src/app/*
    'src/app/globals.css',
    // src/components/common/*
    'src/components/common/AppDrawer.tsx',
    'src/components/common/AppDialog.tsx',
    // src/features/*
    'src/features/reader/ReaderLayout.tsx',
    'src/features/feeds/FeedList.tsx',
    'src/features/articles/ArticleList.tsx',
    'src/features/articles/ArticleView.tsx',
    'src/features/settings/SettingsCenterDrawer.tsx',
    'src/features/settings/panels/AppearanceSettingsPanel.tsx',
    'src/features/settings/panels/AISettingsPanel.tsx',
    'src/features/settings/panels/CategoriesSettingsPanel.tsx',
    'src/features/feeds/AddFeedDialog.tsx',
  ];
  // for each file assert no forbidden regex
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test:unit -- src/app/apple-style.contract.test.ts
```

Expected: 若仍残留禁用模式则 FAIL；无残留则 PASS

**Step 3: Write minimal implementation**

1. 清理残留 `dark:*`、`bg-gradient*`、`shadow-2xl`、`shadow-inner`、`border-2/4/8`。
2. 同步 README：主题描述与风格目标保持一致。

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm run test:unit -- src/app/apple-style.contract.test.ts
pnpm run test:unit -- src/features/reader/ReaderLayout.test.tsx src/features/settings/SettingsCenterModal.test.tsx src/features/feeds/AddFeedDialog.test.tsx src/components/common/AppDrawer.test.tsx src/hooks/useTheme.test.tsx
pnpm run lint
pnpm run build
node scripts/verify-next-migration.mjs
```

Expected:

1. 测试全部 PASS
2. `lint` 无错误
3. `build` 成功
4. 输出 `Migration structure check passed.`

**Step 5: Commit**

```bash
git add src/app/apple-style.contract.test.ts README.md
git commit -m "test(ui): 增强 apple-style 全路径契约并完成最终验证"
```


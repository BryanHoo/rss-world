# Editorial UI Redesign Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 在不改变业务能力和信息架构的前提下，将现网前端 UI（`src/features/*`、`src/components/common/*`、`src/app/*`）完整迁移为 editorial 风格，并落地可回归的样式契约防线。  

**Architecture:** 采用 Token-First 双层架构：先在 `src/app/globals.css` 建立全局 editorial tokens 与基础规则，再在现网组件层按语义化样式组合重构。全程保留现有 store、状态机、可访问性语义与测试锚点，仅替换表现层。  

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、TailwindCSS v4、Zustand、Vitest + Testing Library

---

## 0. Sequential Input Gathering Record

### Step 1: Prior Art Scan（项目优先，再全局）

**Commands run:**

```bash
cd /Users/bryanhu/Develop/feedfuse && ls -la docs/solutions 2>/dev/null || true
cd /Users/bryanhu/Develop/feedfuse && ls -la docs/solutions/index 2>/dev/null || true
cd /Users/bryanhu/Develop/feedfuse && rg -n "editorial|ui redesign|design system|three-column|settings drawer|AppDrawer|ReaderLayout|AddFeedDialog" docs/solutions 2>/dev/null
ls -la ~/.agents/docs/solutions 2>/dev/null || true
rg -n "editorial|ui redesign|design system|three-column|settings drawer|AppDrawer|ReaderLayout|AddFeedDialog" ~/.agents/docs/solutions 2>/dev/null
```

**Result:** 项目与全局都没有可复用 `docs/solutions` 记录；本计划不依赖 solution corpus。

**Risks / Pitfalls to track:**

1. 无先例可复用时，容易“边做边改风格”，必须先锁 token 再改组件。
2. 需要自己定义样式契约测试，否则后续容易回归到圆角/阴影/蓝色强调。
3. 风格重构范围大，必须小步提交并分层验证，避免一次性大改难定位问题。

### Step 2: Codebase Entry Points and Call Chains

**Key paths and chain:**

1. `src/app/(reader)/page.tsx` -> `src/app/(reader)/ReaderApp.tsx` -> `src/features/reader/ReaderLayout.tsx`
2. `src/features/reader/ReaderLayout.tsx` -> `src/features/feeds/FeedList.tsx`
3. `src/features/reader/ReaderLayout.tsx` -> `src/features/articles/ArticleList.tsx`
4. `src/features/reader/ReaderLayout.tsx` -> `src/features/articles/ArticleView.tsx`
5. `src/features/reader/ReaderLayout.tsx` -> `src/features/settings/SettingsCenterModal.tsx` -> `src/features/settings/SettingsCenterDrawer.tsx`
6. `src/features/settings/SettingsCenterDrawer.tsx` / `src/features/feeds/AddFeedDialog.tsx` -> `src/components/common/AppDrawer.tsx` / `src/components/common/AppDialog.tsx`
7. `src/app/layout.tsx` -> `src/app/globals.css`
8. `src/app/(reader)/ReaderApp.tsx` -> `src/hooks/useTheme.ts`（当前读 `persistedSettings.appearance.theme`）

**Commands run:**

```bash
# representative commands
search_for_pattern("import ReaderApp from './ReaderApp';", "src/app/(reader)/page.tsx")
search_for_pattern("import ReaderLayout from '../../features/reader/ReaderLayout';", "src/app/(reader)/ReaderApp.tsx")
search_for_pattern("import FeedList from '../feeds/FeedList';", "src/features/reader/ReaderLayout.tsx")
search_for_pattern("import AppDrawer from '../../components/common/AppDrawer';", "src/features/settings/SettingsCenterDrawer.tsx")
search_for_pattern("import './globals.css';", "src/app/layout.tsx")
search_for_pattern("useTheme", "src/app/(reader)/ReaderApp.tsx")
```

**Risks / Pitfalls to track:**

1. 现网与旧目录并存，执行时只能改现网范围，避免误动 `src/components/{Layout,FeedList,ArticleList,ArticleView,Settings}`。
2. `settings-center-modal`、`open-settings`、`add-feed` 等锚点被测试强依赖，不能改名或删除。
3. `useTheme` 和 Appearance 面板若不同步调整，会出现“只保留浅色”与真实渲染不一致。
4. `AppDrawer`/`AppDialog` 是共享壳层，改动会放大到多个功能点，必须先做契约保护。
5. 样式重构不能触碰 autosave、validation、RSS 校验状态机逻辑。

### Step 3: Existing Test/Verify Commands

**Source:**

1. `package.json` scripts
2. `README.md` 验证章节
3. 现有关键测试：  
   `src/features/reader/ReaderLayout.test.tsx`  
   `src/features/settings/SettingsCenterModal.test.tsx`  
   `src/features/feeds/AddFeedDialog.test.tsx`  
   `src/components/common/AppDrawer.test.tsx`  
   `src/app/globals-css.contract.test.ts`

**Commands to reuse:**

```bash
pnpm run test:unit
pnpm run test:unit -- src/app/globals-css.contract.test.ts
pnpm run test:unit -- src/features/reader/ReaderLayout.test.tsx
pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx
pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx
pnpm run test:unit -- src/components/common/AppDrawer.test.tsx
pnpm run lint
pnpm run build
node scripts/verify-next-migration.mjs
```

**Risks / Pitfalls to track:**

1. 样式类名断言过于脆弱会造成维护噪音，优先断言语义类/禁用模式而非长串 className。
2. 仅跑局部测试会漏掉全局影响，必须在末尾跑 `lint + test:unit + build`。
3. README 会与功能策略冲突（当前仍写“浅色/深色/自动”），需要同步文档。

## 1. Execution Rules

1. 只改现网路径：`src/features/*`、`src/components/common/*`、`src/app/*`。
2. 不改变信息架构和业务逻辑（store action、validation、autosave、RSS 校验流程保持原语义）。
3. 保留所有关键可访问性与测试锚点：`open-settings`、`add-feed`、`close-settings`、`settings-center-modal`、`settings-center-overlay`、`settings-section-tab-*`。
4. 每个任务按 Red-Green-Refactor 执行并单独提交。

## 2. Task Breakdown

### Task 1: 建立 Editorial 全局 Token 与样式契约基线

**Files:**

- Modify: `src/app/globals.css`
- Modify: `src/app/globals-css.contract.test.ts`
- Create: `src/app/editorial-style.contract.test.ts`

**Step 1: Write the failing test**

```ts
// src/app/globals-css.contract.test.ts
it('defines editorial baseline tokens and light-only body rules', () => {
  const css = readFileSync('src/app/globals.css', 'utf-8');
  expect(css).toContain("font-family: 'Manrope'");
  expect(css).toContain('.font-brand');
  expect(css).toContain('bg-[#F9F8F6]');
  expect(css).not.toContain('dark:bg-');
});
```

```ts
// src/app/editorial-style.contract.test.ts
const forbidden = [/rounded-(?!none)/, /shadow-/, /bg-gradient-/, /(?:^|\\s)(?:bg|text|border|ring)-blue/];
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test:unit -- src/app/globals-css.contract.test.ts src/app/editorial-style.contract.test.ts
```

Expected: FAIL（当前代码仍存在 `dark:*`、`rounded-*`、`shadow-*`、`blue-*`）

**Step 3: Write minimal implementation**

1. 在 `src/app/globals.css` 定义 editorial 颜色、排版、边框、间距 token。
2. 去除全局 `dark` 体系统一（至少 body 与基础文本规则不再依赖 `dark:*`）。
3. 在 `src/app/editorial-style.contract.test.ts` 实现“扫描目标文件 + 禁用模式断言”的最小工具函数（先覆盖 `src/app` 与 `src/components/common`）。

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm run test:unit -- src/app/globals-css.contract.test.ts src/app/editorial-style.contract.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/globals.css src/app/globals-css.contract.test.ts src/app/editorial-style.contract.test.ts
git commit -m "test(ui): 建立 editorial 全局样式契约基线"
```

### Task 2: 主题策略迁移为浅色-only（行为与 UI 同步）

**Files:**

- Modify: `src/features/settings/panels/AppearanceSettingsPanel.tsx`
- Modify: `src/hooks/useTheme.ts`
- Modify: `src/hooks/useTheme.test.tsx`
- Modify: `src/features/settings/SettingsCenterModal.test.tsx`
- Modify: `src/features/settings/settingsSchema.ts` (可选，若要将历史 dark/auto 归一化为 light)
- Modify: `README.md`

**Step 1: Write the failing test**

```ts
// src/hooks/useTheme.test.tsx
it('never keeps dark class in light-only mode', () => {
  document.documentElement.classList.add('dark');
  render(<Harness />);
  expect(document.documentElement.classList.contains('dark')).toBe(false);
});
```

```ts
// src/features/settings/SettingsCenterModal.test.tsx
it('appearance panel exposes only light theme option', async () => {
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

Expected: FAIL（当前仍提供 `深色/自动`，且 `useTheme` 会根据 theme 切换 `dark` 类）

**Step 3: Write minimal implementation**

1. `AppearanceSettingsPanel` 仅渲染浅色选项（保持字段结构兼容）。
2. `useTheme` 简化为清理 `dark` 类，固定浅色渲染。
3. 处理 schema/normalize 的兼容策略（可选：把历史 `dark/auto` 归一化为 `light`）。
4. 更新 README 中“浅色/深色/自动主题”描述为浅色 editorial。

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm run test:unit -- src/hooks/useTheme.test.tsx src/features/settings/SettingsCenterModal.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/settings/panels/AppearanceSettingsPanel.tsx src/hooks/useTheme.ts src/hooks/useTheme.test.tsx src/features/settings/SettingsCenterModal.test.tsx src/features/settings/settingsSchema.ts README.md
git commit -m "feat(ui): 迁移到浅色-only editorial 主题策略"
```

### Task 3: 重做共享壳层 AppDialog / AppDrawer 为 editorial 基座

**Files:**

- Modify: `src/components/common/AppDialog.tsx`
- Modify: `src/components/common/AppDrawer.tsx`
- Modify: `src/components/common/AppDrawer.test.tsx`
- Modify: `src/app/editorial-style.contract.test.ts`

**Step 1: Write the failing test**

```ts
// src/components/common/AppDrawer.test.tsx
it('keeps right-side behavior and uses editorial shell classes', () => {
  const panel = screen.getByTestId('settings-center-modal');
  expect(panel.className).toContain('right-0');
  expect(panel.className).toContain('rounded-none');
  expect(panel.className).not.toContain('shadow');
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test:unit -- src/components/common/AppDrawer.test.tsx src/app/editorial-style.contract.test.ts
```

Expected: FAIL（当前 `AppDrawer`/`AppDialog` 含 `rounded-xl`、`shadow-*`、渐变）

**Step 3: Write minimal implementation**

1. `AppDialog` / `AppDrawer` 使用直角、细边框、无阴影、无渐变。
2. 保持 Esc、遮罩点击、focus 恢复、portal 行为不变。
3. 保持 `settings-center-modal`、`settings-center-overlay`、`close-settings` 等语义锚点。

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm run test:unit -- src/components/common/AppDrawer.test.tsx src/features/settings/SettingsCenterModal.test.tsx src/app/editorial-style.contract.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/common/AppDialog.tsx src/components/common/AppDrawer.tsx src/components/common/AppDrawer.test.tsx src/app/editorial-style.contract.test.ts
git commit -m "refactor(ui): 将 dialog/drawer 壳层统一为 editorial 基座"
```

### Task 4: 重做 Reader 外框与左栏（ReaderLayout + FeedList）

**Files:**

- Modify: `src/features/reader/ReaderLayout.tsx`
- Modify: `src/features/feeds/FeedList.tsx`
- Modify: `src/features/reader/ReaderLayout.test.tsx`
- Modify: `src/app/editorial-style.contract.test.ts`

**Step 1: Write the failing test**

```ts
// src/app/editorial-style.contract.test.ts
const files = [
  'src/features/reader/ReaderLayout.tsx',
  'src/features/feeds/FeedList.tsx',
];
```

```ts
// src/features/reader/ReaderLayout.test.tsx
it('keeps add-feed and open-settings actions after editorial restyle', () => {
  expect(screen.getByLabelText('add-feed')).toBeInTheDocument();
  expect(screen.getByLabelText('open-settings')).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test:unit -- src/features/reader/ReaderLayout.test.tsx src/app/editorial-style.contract.test.ts
```

Expected: FAIL（当前这两文件仍包含 forbidden patterns）

**Step 3: Write minimal implementation**

1. Reader 三栏外框改为 editorial 单色分层与细分割线。
2. FeedList 改目录式视觉（当前态用字重/细线，不用蓝色块）。
3. 删除圆角、阴影、蓝色强调、dark 分支样式。
4. 保留 `add-feed`、分类折叠、分组逻辑与 `open-settings` 行为。

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm run test:unit -- src/features/reader/ReaderLayout.test.tsx src/features/feeds/AddFeedDialog.test.tsx src/app/editorial-style.contract.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/reader/ReaderLayout.tsx src/features/feeds/FeedList.tsx src/features/reader/ReaderLayout.test.tsx src/app/editorial-style.contract.test.ts
git commit -m "refactor(ui): 完成 reader 外框与 feed 左栏 editorial 化"
```

### Task 5: 重做中栏与阅读正文（ArticleList + ArticleView）

**Files:**

- Modify: `src/features/articles/ArticleList.tsx`
- Modify: `src/features/articles/ArticleView.tsx`
- Create: `src/features/articles/ArticleEditorial.test.tsx`
- Modify: `src/app/editorial-style.contract.test.ts`

**Step 1: Write the failing test**

```ts
// src/features/articles/ArticleEditorial.test.tsx
it('renders article actions with text-first editorial affordance', () => {
  render(<ArticleView />);
  // 根据 store 默认数据断言按钮仍存在
  expect(screen.getByText('收藏')).toBeInTheDocument();
  expect(screen.getByText('原文')).toBeInTheDocument();
});
```

```ts
// src/app/editorial-style.contract.test.ts
const files = [
  'src/features/articles/ArticleList.tsx',
  'src/features/articles/ArticleView.tsx',
];
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm run test:unit -- src/features/articles/ArticleEditorial.test.tsx src/app/editorial-style.contract.test.ts
```

Expected: FAIL（样式契约失败；必要时新增测试先因缺文件失败）

**Step 3: Write minimal implementation**

1. ArticleList 迁移为 editorial 目录式排版与单色选中态。
2. ArticleView 标题改衬线层级、操作按钮改文本+下划线动效语义。
3. 保持阅读行为：自动标记已读、收藏切换、外链跳转。
4. 移除 `rounded/shadow/blue/dark` 风格分支。

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm run test:unit -- src/features/articles/ArticleEditorial.test.tsx src/app/editorial-style.contract.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/articles/ArticleList.tsx src/features/articles/ArticleView.tsx src/features/articles/ArticleEditorial.test.tsx src/app/editorial-style.contract.test.ts
git commit -m "refactor(ui): 完成文章列表与阅读面板 editorial 重排"
```

### Task 6: 重做设置中心与 AddFeed 表单（保持行为不变）

**Files:**

- Modify: `src/features/settings/SettingsCenterDrawer.tsx`
- Modify: `src/features/settings/panels/AppearanceSettingsPanel.tsx`
- Modify: `src/features/settings/panels/AISettingsPanel.tsx`
- Modify: `src/features/settings/panels/CategoriesSettingsPanel.tsx`
- Modify: `src/features/feeds/AddFeedDialog.tsx`
- Modify: `src/features/settings/SettingsCenterModal.test.tsx`
- Modify: `src/features/feeds/AddFeedDialog.test.tsx`
- Modify: `src/app/editorial-style.contract.test.ts`

**Step 1: Write the failing test**

```ts
// src/features/settings/SettingsCenterModal.test.tsx
it('keeps settings sections and autosave labels after editorial restyle', async () => {
  expect(screen.getByTestId('settings-section-tab-appearance')).toBeInTheDocument();
  expect(screen.getByText('已保存')).toBeInTheDocument();
});
```

```ts
// src/app/editorial-style.contract.test.ts
const files = [
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
pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx src/features/feeds/AddFeedDialog.test.tsx src/app/editorial-style.contract.test.ts
```

Expected: FAIL（当前设置与表单文件仍包含 forbidden patterns）

**Step 3: Write minimal implementation**

1. 设置抽屉导航改为 editorial 目录式样式（无圆角/阴影/渐变）。
2. 三个设置面板统一底线输入与文本型控制表达。
3. AddFeedDialog 统一底线输入和 editorial 按钮风格。
4. 保留现有字段、校验、autosave、关闭拦截与分类管理行为。

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx src/features/feeds/AddFeedDialog.test.tsx src/features/settings/panels/CategoriesSettingsPanel.test.tsx src/app/editorial-style.contract.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/settings/SettingsCenterDrawer.tsx src/features/settings/panels/AppearanceSettingsPanel.tsx src/features/settings/panels/AISettingsPanel.tsx src/features/settings/panels/CategoriesSettingsPanel.tsx src/features/feeds/AddFeedDialog.tsx src/features/settings/SettingsCenterModal.test.tsx src/features/feeds/AddFeedDialog.test.tsx src/app/editorial-style.contract.test.ts
git commit -m "refactor(ui): 设置中心与添加源表单迁移到 editorial 风格"
```

### Task 7: 最终回归、文档同步与验收提交

**Files:**

- Modify: `README.md`（若前面尚未更新完）
- Modify: `docs/plans/2026-02-24-editorial-ui-redesign-design.md`（若需要补充实施备注）

**Step 1: Write the failing test**

```md
人工验收 checklist（先当作 fail 清单）:
- [ ] 三栏布局和设置抽屉交互不回归
- [ ] 所有关键测试通过
- [ ] 无 forbidden style pattern
- [ ] README 与主题策略一致
```

**Step 2: Run verification to observe failures**

Run:

```bash
pnpm run lint
pnpm run test:unit
pnpm run build
node scripts/verify-next-migration.mjs
```

Expected: 若有任一失败，先修复再重跑到全绿。

**Step 3: Write minimal implementation/fixes**

1. 修复 lint/test/build 失败项（只修本计划改动引入的问题）。
2. 同步 README 描述到浅色 editorial 策略。

**Step 4: Re-run verification to pass**

Run:

```bash
pnpm run lint && pnpm run test:unit && pnpm run build && node scripts/verify-next-migration.mjs
```

Expected: 全部 PASS

**Step 5: Commit**

```bash
git add README.md docs/plans/2026-02-24-editorial-ui-redesign-design.md
git commit -m "docs(ui): 同步 editorial 重设计后的主题与验收说明"
```

## 3. Rollback Strategy

1. 每个任务单独 commit，出现回归时 `git revert <commit>` 精确回滚。
2. 不使用 `git reset --hard`。
3. 优先回滚最新任务提交，再局部修复。

## 4. Acceptance Criteria

1. 现网范围不再出现 editorial 禁用模式（圆角、阴影、渐变、蓝色强调）。
2. 三栏阅读 + 设置抽屉信息架构保持不变。
3. 关键行为不回归（打开设置、添加源、分类管理、autosave、关闭确认）。
4. 单元测试、lint、build、迁移验证全绿。
5. README 与实际主题策略一致（浅色-only editorial）。

# FeedFuse shadcn/ui 前端改造 Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 使用 shadcn/ui（Default）替换现有前端组件与样式，移除现有字体引入与自研弹窗/抽屉基座，统一使用 shadcn token（Tailwind v4 `@theme` + `--color-*`）并保持蓝色强调与 `.dark` 深色策略。

**Architecture:** 先在 `src/app/globals.css` 建立 token 与基础样式，再引入 `src/components/ui/*` 作为组件基座，随后分模块替换：设置中心（`Sheet/Tabs`）+ 添加源弹窗（`Dialog`）→ 阅读器三栏（按钮/列表/分隔/滚动区统一）。每个阶段都保持 `data-testid`/`aria-label` 稳定并更新单测，最后清理 `src/components/common/*` 浮层基座。

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, TailwindCSS v4 (CSS-first), shadcn/ui (copied components), Radix UI primitives, `lucide-react`, Vitest + Testing Library, pnpm.

---

## Inputs（先读这些再动手）

- 设计文档：`docs/plans/2026-02-25-feedfuse-shadcn-ui-design.md`
- 前端入口链路（主要改动点）：
  - `src/app/(reader)/page.tsx` → `src/app/(reader)/ReaderApp.tsx` → `src/features/reader/ReaderLayout.tsx`
  - `src/features/reader/ReaderLayout.tsx` → `src/features/feeds/FeedList.tsx` / `src/features/articles/ArticleList.tsx` / `src/features/articles/ArticleView.tsx`
  - 设置中心：`src/features/settings/SettingsCenterModal.tsx` → `src/features/settings/SettingsCenterDrawer.tsx`
  - 添加源：`src/features/feeds/AddFeedDialog.tsx`
- 当前验证命令：
  - 单测：`pnpm run test:unit`
  - Lint：`pnpm run lint`
  - 构建：`pnpm run build`
  - 结构校验：`node scripts/verify-next-migration.mjs`（注意不要引入 `tailwind.config.js` 等 legacy 文件）

## Key Risks / Pitfalls（实现时别踩）

1) **Tailwind v4 token 对齐**：本项目不使用 `tailwind.config.*`，需要用 `@theme` 定义 `--color-*` 才能让 `bg-background`、`text-muted-foreground` 等语义类名可用；务必用 `pnpm run build` 验证编译期不会因为类名不存在而失败。  
2) **Client boundary**：`src/components/ui/*` 多为 Client Components（通常包含 `'use client'`），避免在 Server Components 直接引入导致构建错误；本项目入口 `src/app/(reader)/ReaderApp.tsx` 已是 client，可作为边界。  
3) **Dialog/Sheet 行为回退**：确保 Esc / 遮罩点击关闭、初始聚焦、焦点陷阱与回焦、阻塞关闭确认（AlertDialog）都在新实现中覆盖，并用单测验证关键点。  
4) **测试过度耦合 class**：现有测试断言 `className`（如包含 `right-0`）很脆弱；迁移后优先用 role/label/testid 断言。  
5) **残留全局样式与字体**：`src/app/globals.css` 与可能未引用的 `src/index.css` 都含字体与灰底；实现中要确认 `src/index.css` 是否被引用，若未引用则删除或同步更新，避免“看似统一但仓库仍残留旧样式”。

---

## Phase 0：准备工作（隔离变更 + 建立基线）

### Task 1: 在独立 worktree/分支上执行（推荐）

**Files:** 无

**Step 1: 创建 worktree**

Run:

```bash
git fetch
git worktree add -b codex/shadcn-ui-refresh ../feedfuse-shadcn-ui-refresh
```

Expected: 生成新目录 `../feedfuse-shadcn-ui-refresh`，后续步骤在该目录执行。

**Step 2: 基线验证（改动前先全绿）**

Run:

```bash
pnpm run lint
pnpm run test:unit
pnpm run build
node scripts/verify-next-migration.mjs
```

Expected: 全部 PASS。

**Step 3: Commit**

无需提交（仅准备步骤）。

---

## Phase 1：全局 token 与工程基础（让 shadcn 语义类名可用）

### Task 2: 添加 `@/*` 路径别名（贴近 shadcn 模板）

**Files:**

- Modify: `tsconfig.json`
- Modify: `vitest.config.ts`

**Step 1: 写失败验证（可选，先跑 build 观察报错也可）**

说明：本任务主要是工程配置；如果需要强约束，可先在任意文件临时写入 `import '@/lib/apiClient'` 并运行 `pnpm run build` 观察失败，再回滚该临时改动。

**Step 2: 最小实现**

- 在 `tsconfig.json` 添加：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- 在 `vitest.config.ts` 的 `resolve.alias` 增加（保留现有 `server-only` alias）：

```ts
import { fileURLToPath } from 'node:url'

alias: {
  'server-only': ...,
  '@': fileURLToPath(new URL('./src', import.meta.url)),
},
```

**Step 3: 验证**

Run: `pnpm run test:unit`  
Expected: PASS

**Step 4: Commit**

```bash
git add tsconfig.json vitest.config.ts
git commit -m "chore(frontend): 添加@路径别名"
```

---

### Task 3: 更新 `src/app/globals.css`（移除字体 + 引入 token + animate）

**Files:**

- Modify: `src/app/globals.css`
- Modify: `src/app/globals-css.contract.test.ts`

**Step 1: 写失败单测（扩展 contract）**

在 `src/app/globals-css.contract.test.ts` 追加断言（先让它 FAIL）：

- 包含 `@plugin "tailwindcss-animate";`
- 包含若干 token 关键字（如 `--color-background`、`--color-foreground`、`--color-primary`、`--color-ring`）
- 不再包含 `fonts.googleapis.com` 与 `.font-brand`

**Step 2: 运行单测确认失败**

Run: `pnpm run test:unit`  
Expected: FAIL（globals.css 尚未更新）

**Step 3: 实现 globals.css**

在 `src/app/globals.css`：

- 移除 `@import url('https://fonts.googleapis.com/...')`
- 移除 `.font-brand` utilities
- 增加 `@plugin "tailwindcss-animate";`
- 使用 `@layer theme { @theme default { ... } }` 定义 `--color-*` token（浅色）
- 在 `@layer base { .dark { ... } }` 覆盖深色 token（保持 `.dark` 策略不变）
- `@layer base` 中统一：
  - `* { @apply border-border; }`
  - `body { @apply bg-background text-foreground antialiased font-sans; }`
- 保留：`@import "tailwindcss";`、`@plugin "@tailwindcss/typography";`、`@custom-variant dark (&:where(.dark, .dark *));`

**Step 4: 运行单测确认通过**

Run: `pnpm run test:unit`  
Expected: PASS

**Step 5: 构建验证（关键）**

Run: `pnpm run build`  
Expected: PASS（确保 `bg-background` 等类名在编译期可用）

**Step 6: Commit**

```bash
git add src/app/globals.css src/app/globals-css.contract.test.ts
git commit -m "feat(ui): 引入shadcn主题token并移除字体"
```

---

## Phase 2：引入 shadcn 组件基座（`src/components/ui/*` + `cn`）

### Task 4: 安装 shadcn/ui 需要的依赖（最小集合）

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Step 1: 添加依赖**

Run（按需调整组件清单，但优先保持最小）：

```bash
pnpm add tailwindcss-animate class-variance-authority clsx tailwind-merge
pnpm add @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-alert-dialog
pnpm add @radix-ui/react-tabs @radix-ui/react-select @radix-ui/react-tooltip @radix-ui/react-scroll-area @radix-ui/react-collapsible
```

Expected: 依赖安装成功。

**Step 2: 验证**

Run: `pnpm run test:unit`  
Expected: PASS

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(ui): 添加shadcn与radix依赖"
```

---

### Task 5: 新增 `cn` 工具与第一批 `src/components/ui/*`

**Files:**

- Create: `src/lib/utils.ts`
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/label.tsx`
- Create: `src/components/ui/separator.tsx`
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/scroll-area.tsx`
- Create: `src/components/ui/tooltip.tsx`
- Create: `src/components/ui/tabs.tsx`
- Create: `src/components/ui/dialog.tsx`
- Create: `src/components/ui/sheet.tsx`
- Create: `src/components/ui/alert-dialog.tsx`
- Create: `src/components/ui/select.tsx`

**Step 1: 写失败单测（最小 smoke）**

Create: `src/components/ui/ui-smoke.test.tsx`，验证至少 `Button` 与 `Dialog` 能渲染：

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './button'

describe('ui smoke', () => {
  it('renders Button', () => {
    render(<Button>OK</Button>)
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument()
  })
})
```

**Step 2: 运行单测确认失败**

Run: `pnpm run test:unit`  
Expected: FAIL（`Button`/`cn` 等尚未实现）

**Step 3: 实现文件**

- `src/lib/utils.ts`：实现 `cn(...)`（`clsx` + `tailwind-merge`）
- `src/components/ui/*`：从 shadcn/ui（Default）模板复制对应组件源码到项目中，注意：
  - 使用 `@/lib/utils` 引入 `cn`
  - 需要交互/refs 的组件文件保留 `'use client'`
  - `sheet.tsx` / `select.tsx` / `tooltip.tsx` 等依赖 `lucide-react` 图标，项目已有依赖可直接用

**Step 4: 运行单测确认通过**

Run: `pnpm run test:unit`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/utils.ts src/components/ui src/components/ui/ui-smoke.test.tsx
git commit -m "feat(ui): 引入shadcn基础组件"
```

---

## Phase 3：替换弹窗/抽屉基座（Settings / Add Feed）

### Task 6: 用 `Sheet` 重写设置中心（并保留关键 testid/label）

**Files:**

- Modify: `src/features/settings/SettingsCenterDrawer.tsx`
- Modify: `src/features/settings/SettingsCenterModal.test.tsx`

**Step 1: 写失败单测（先更新断言再实现）**

在 `src/features/settings/SettingsCenterModal.test.tsx`：

- 将对 `className`（如包含 `right-0`）的断言替换为更稳定的断言：
  - `screen.getByTestId('settings-center-modal')` 存在
  - `screen.getByTestId('settings-center-overlay')` 存在
  - `screen.getByLabelText('close-settings')` 存在

先只改测试并运行，预期应 FAIL（旧实现仍存在、但断言应仍能成立；若仍 PASS，则继续下一步）。

**Step 2: 实现最小重写**

在 `src/features/settings/SettingsCenterDrawer.tsx`：

- 用 `Sheet` 替换 `AppDrawer`
- 用 `AlertDialog` 替换“阻塞关闭确认”的 `AppDialog`
- 保留并下挂：
  - `data-testid="settings-center-modal"`（放在 `SheetContent`）
  - `data-testid="settings-center-overlay"`（放在 `SheetOverlay`）
  - close 按钮 `aria-label="close-settings"`
  - `aria-label="settings-sections"`（如果从左侧 nav 改为 `TabsList`，保留该 label）
- section 导航由 `Tabs` 承载（`appearance` / `ai` / `categories`）

**Step 3: 运行单测**

Run: `pnpm run test:unit`  
Expected: PASS（至少 SettingsCenterModal 相关测试全部通过）

**Step 4: Commit**

```bash
git add src/features/settings/SettingsCenterDrawer.tsx src/features/settings/SettingsCenterModal.test.tsx
git commit -m "refactor(settings): 使用sheet重写设置中心"
```

---

### Task 7: 将设置面板控件替换为 shadcn 组件（Appearance/AI/Categories）

**Files:**

- Modify: `src/features/settings/panels/AppearanceSettingsPanel.tsx`
- Modify: `src/features/settings/panels/AISettingsPanel.tsx`
- Modify: `src/features/settings/panels/CategoriesSettingsPanel.tsx`
- Modify: `src/features/settings/panels/CategoriesSettingsPanel.test.tsx`

**Step 1: 写失败单测（仅针对标签/按钮稳定性）**

确保 `CategoriesSettingsPanel.test.tsx` 仍然只依赖：

- 输入 `aria-label="新分类名称"`
- 按钮文本 `添加分类`
- 行内输入 `分类名称-0`
- 删除按钮 `删除分类-0`

如实现中需要调整 label，请先改测试并让其 FAIL，再实现。

**Step 2: 实现**

- `AppearanceSettingsPanel.tsx`：用 shadcn `Select`（或 `Button` 组）替换硬编码按钮样式；保留中文文案（主题/字号/字体/行高）。
- `AISettingsPanel.tsx`：用 shadcn `Label` + `Input`，错误信息保持可见。
- `CategoriesSettingsPanel.tsx`：用 shadcn `Input` + `Button` + `Separator`/`Card` 风格替换现有 class 拼接，但保持现有 `aria-label` 与按钮文本，避免测试与可访问性回退。

**Step 3: 验证**

Run: `pnpm run test:unit`  
Expected: PASS

**Step 4: Commit**

```bash
git add src/features/settings/panels src/features/settings/panels/CategoriesSettingsPanel.test.tsx
git commit -m "refactor(settings): 面板控件切换为shadcn组件"
```

---

### Task 8: 用 `Dialog` 重写添加源弹窗（包含初始聚焦）

**Files:**

- Modify: `src/features/feeds/AddFeedDialog.tsx`
- (Optional) Add Test: `src/features/feeds/AddFeedDialog.test.tsx`

**Step 1: 写失败单测（可选但推荐）**

新增测试验证：

- 打开后存在标题“添加 RSS 源”
- `名称` 输入获得初始 focus（通过 `document.activeElement` 断言）

**Step 2: 实现**

- 用 shadcn `Dialog` 替换 `AppDialog`
- 表单控件用 `Input`/`Select`/`Button`/`Badge`
- 初始聚焦：在 `DialogContent` 使用 `onOpenAutoFocus` 将焦点置于“名称”输入
- 保留现有 `closeLabel="close-add-feed"` 语义（映射到 close 按钮 `aria-label`）

**Step 3: 验证**

Run: `pnpm run test:unit`  
Expected: PASS

**Step 4: Commit**

```bash
git add src/features/feeds/AddFeedDialog.tsx src/features/feeds/AddFeedDialog.test.tsx
git commit -m "refactor(feeds): 使用dialog重写新增源弹窗"
```

---

### Task 9: 移除旧浮层基座（AppDialog/AppDrawer/floatingLayerStyles）

**Files:**

- Delete: `src/components/common/AppDialog.tsx`
- Delete: `src/components/common/AppDrawer.tsx`
- Delete: `src/components/common/floatingLayerStyles.ts`
- Delete/Modify: `src/components/common/AppDrawer.test.tsx`
- Modify: 相关引用文件（若仍有残留 import）

**Step 1: 写失败验证（查找引用）**

Run:

```bash
rg -n "\\bAppDialog\\b|\\bAppDrawer\\b|floatingLayer" src
```

Expected: 在删除前应能定位到所有引用点；删除后应为 0 结果。

**Step 2: 实现删除与替换**

- 确保 `SettingsCenterDrawer` / `AddFeedDialog` 不再引用旧基座
- 移除旧测试或改写为 `Sheet/Dialog` 的行为测试

**Step 3: 验证**

Run:

```bash
pnpm run test:unit
pnpm run lint
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/components/common src/features
git commit -m "chore(ui): 移除旧浮层基座组件"
```

---

## Phase 4：阅读器三栏 UI shadcn 化（统一按钮/选中态/边框/滚动）

### Task 10: 迁移 `ReaderLayout`（容器与设置入口）

**Files:**

- Modify: `src/features/reader/ReaderLayout.tsx`
- Modify: `src/app/(reader)/ReaderApp.test.tsx`（如断言受影响）

**Step 1: 写失败单测（如需要）**

保持 `ReaderApp.test.tsx` 的稳定点：

- Logo（`alt="FeedFuse"`）可见
- “文章”标题可见
- `aria-label="open-settings"` 按钮可点击后出现 `data-testid="settings-center-modal"`

如迁移导致测试失败，先调整测试再实现。

**Step 2: 实现**

- 外层背景/边框从 `bg-gray-*`/`border-gray-*` 迁移为 token（`bg-background`、`border-border` 等）
- 设置入口按钮改为 shadcn `Button`（`variant="outline"` 或 `ghost`，按视觉选择）
- 保留 `aria-label="open-settings"`

**Step 3: 验证**

Run: `pnpm run test:unit`  
Expected: PASS

**Step 4: Commit**

```bash
git add src/features/reader/ReaderLayout.tsx src/app/(reader)/ReaderApp.test.tsx
git commit -m "refactor(reader): 迁移主布局到shadcn风格"
```

---

### Task 11: 迁移 `FeedList`（按钮/折叠/Badge）

**Files:**

- Modify: `src/features/feeds/FeedList.tsx`

**Step 1: 最小验证（手动 + 现有单测）**

说明：当前无直接单测覆盖 `FeedList` 交互，迁移时建议保持 `aria-label="add-feed"` 等可访问性标识不变，以便后续补测。

**Step 2: 实现**

- 顶部“添加源”使用 `Button variant="ghost" size="icon"`
- 选中态与 hover 统一走 token（优先 `accent/muted/primary`）
- 分类展开/收起优先使用 shadcn `Collapsible`（如引入成本过高，可先用现有逻辑但改样式，后续再补）
- 未读数使用 `Badge`

**Step 3: 验证**

Run:

```bash
pnpm run lint
pnpm run test:unit
pnpm run build
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/features/feeds/FeedList.tsx
git commit -m "refactor(feeds): 订阅源列表切换为shadcn样式"
```

---

### Task 12: 迁移 `ArticleList`（列表项/操作按钮/选中态）

**Files:**

- Modify: `src/features/articles/ArticleList.tsx`

**Step 1: 实现**

- 顶部操作按钮改为 `Button variant="ghost" size="icon"`
- 列表项选中态/hover 统一为 token（如 `bg-accent`）
- 未读指示点使用 `bg-primary`

**Step 2: 验证**

Run:

```bash
pnpm run lint
pnpm run test:unit
pnpm run build
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/features/articles/ArticleList.tsx
git commit -m "refactor(articles): 文章列表切换为shadcn样式"
```

---

### Task 13: 迁移 `ArticleView`（操作区 Button + Tooltip + prose token 化）

**Files:**

- Modify: `src/features/articles/ArticleView.tsx`

**Step 1: 实现**

- 操作区按钮统一使用 shadcn `Button`（收藏优先用 `Button` 变体实现，必要时再引入 `Toggle`）
- “翻译/AI摘要未上线”改用 `Tooltip`（替代 `title`）
- 外层容器与文字颜色改用 token；正文继续 `prose`，保留字号/行高/字体切换逻辑

**Step 2: 验证**

Run:

```bash
pnpm run lint
pnpm run test:unit
pnpm run build
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/features/articles/ArticleView.tsx
git commit -m "refactor(articles): 阅读面板切换为shadcn样式"
```

---

## Phase 5：收尾清理与验收

### Task 14: 处理 `src/index.css`（确认是否被引用）

**Files:**

- Delete or Modify: `src/index.css`

**Step 1: 查找引用**

Run:

```bash
rg -n "from '\\./index\\.css'|from \\\"\\./index\\.css\\\"|index\\.css" src
```

Expected: 如果无引用，可删除；若存在引用，需同步更新为与 `src/app/globals.css` 一致的 token/字体策略。

**Step 2: 验证**

Run:

```bash
pnpm run lint
pnpm run test:unit
pnpm run build
node scripts/verify-next-migration.mjs
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/index.css
git commit -m "chore(css): 清理遗留全局样式文件"
```

---

### Task 15: 最终手动验收（UI 走查）

**Files:** 无

**Step 1: 本地启动**

Run: `pnpm run dev`

**Step 2: 走查清单**

- 浅色/深色/自动切换正常（`AppearanceSettingsPanel`）
- 设置中心：Esc/遮罩点击/关闭按钮、阻塞关闭确认正常
- 添加源弹窗：打开后初始聚焦正确；校验状态 badge 显示正常
- 三栏布局：选中态/hover/边框/背景风格统一，无明显灰蓝硬编码残留
- 阅读区 `prose`：深色下可读，字体/字号/行高切换正常

**Step 3: 无需提交**

---

## Plan Complete → 执行方式选择

计划完成并保存到：`docs/plans/2026-02-25-feedfuse-shadcn-ui-implementation-plan.md`。

两种执行方式：

1) **Sequential（本 session）**：我在当前会话按任务逐个实现并在关键点停下来让你确认  
2) **Sequential（新 session）**：开新会话并使用 `workflow-executing-plans` 按任务批次执行与复核

你选哪一种？


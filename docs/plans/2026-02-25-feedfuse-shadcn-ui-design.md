# FeedFuse 前端 shadcn/ui 全量替换设计（Default）

日期：2026-02-25  
状态：已确认（Approved）  

## TL;DR

- 目标：使用 **shadcn/ui（Default）** 统一替换现有前端组件与样式，让全站 UI 以 shadcn 的语义 token（`bg-background`、`text-foreground`、`border-border` 等）驱动。
- 深色模式继续采用现有的 `.dark` class 策略（`src/hooks/useTheme.ts`）。
- 字体不保留现状（移除 `src/app/globals.css` 的 Google Fonts 引入与 `.font-brand`）。
- 弹窗/抽屉不保留现有基座：用 shadcn 的 **`Dialog` / `Sheet` / `AlertDialog`** 全量替换 `src/components/common/AppDialog.tsx`、`src/components/common/AppDrawer.tsx`，并同步更新依赖方与测试。
- 强调色保持“偏蓝”，但通过 shadcn token 体系表达（不再直接写 `bg-blue-*` / `text-blue-*`）。

## 背景（当前前端状态）

- 样式：TailwindCSS v4 + Typography，入口为 `src/app/globals.css`（使用 `@import "tailwindcss";` + `@custom-variant dark (&:where(.dark, .dark *));`）。
- 深色模式：`src/hooks/useTheme.ts` 通过切换 `documentElement.classList.toggle('dark')`。
- 主要界面：三栏阅读器布局在 `src/features/reader/ReaderLayout.tsx`，大量直接写 Tailwind class（含 `bg-gray-*`、`text-blue-*` 等）。
- 弹窗基座：`src/components/common/AppDialog.tsx`、`src/components/common/AppDrawer.tsx` 自研 focus/动画/遮罩，业务弹窗（如设置中心、添加源）依赖该基座。
- 现有测试覆盖：`src/app/(reader)/ReaderApp.test.tsx`、`src/components/common/AppDrawer.test.tsx` 等对 DOM/行为有依赖。

## 目标与非目标

### 目标

- 组件统一：按钮、输入、选择器、Tabs、Badge、对话框、抽屉等交互控件统一为 shadcn/ui 风格。
- 样式统一：主色、背景、边框、文字、聚焦环等全部迁移到 shadcn token；尽量消除业务层硬编码色彩 class。
- 交互不回退：Esc/遮罩点击关闭、焦点陷阱与回焦、初始聚焦等行为不弱于现状。
- 测试可维护：保留必要的 `data-testid` / `aria-label`，更新测试以适配 Radix 组件结构。

### 非目标（本次不做）

- 不改 Zustand store / API 调用 / 业务逻辑（仅做 UI 层改造）。
- 不强制引入 `react-hook-form`（先完成 UI 统一，后续再考虑表单框架化）。
- 不重写阅读正文渲染（`dangerouslySetInnerHTML` + `prose` 保留，仅做 token 适配）。

## 设计决策（已确认）

- shadcn/ui 主题风格：`Default`
- 字体：不保留现有 Google Fonts（移除 `@import url(...)` 与 `.font-brand`）
- 弹窗/抽屉：全量替换为 shadcn `Dialog` / `Sheet` / `AlertDialog`
- 强调色：保持蓝色系，但用 token 表达（`primary`/`ring` 等）

## 总体方案（推荐且已选）

采用“主题先行 + 组件层引入 + 模块逐块迁移”的全站 shadcn 化方案：

1) 在 `src/app/globals.css` 建立 shadcn token（Tailwind v4 CSS-first `@theme`），保证语义类名可用。  
2) 新增 `src/components/ui/*`（按使用到的组件逐步引入），统一从 shadcn 模板复制并纳入项目。  
3) 替换弹窗/抽屉：业务层改用 `Dialog/Sheet/AlertDialog`，并更新测试点。  
4) 三栏阅读器 UI 全量迁移：`ReaderLayout`、`FeedList`、`ArticleList`、`ArticleView` 改用 shadcn 组件与 token。  
5) 清理无引用的自研 floating layer 样式与组件（预计包含：`src/components/common/floatingLayerStyles.ts`、`src/components/common/AppDialog.tsx`、`src/components/common/AppDrawer.tsx`）。

## 全局主题与样式（Tailwind v4 + token）

### `src/app/globals.css` 变更要点

- 移除字体引入与 `.font-brand`，使用 Tailwind v4 内置 `--font-sans`（系统字体栈）。
- 保留现有 dark variant：`@custom-variant dark (&:where(.dark, .dark *));`（与 `useTheme` 一致）。
- 使用 Tailwind v4 的 `@theme` 定义 shadcn token（以 `--color-*` 为主），并提供 `.dark` 覆盖：
  - `--color-background` / `--color-foreground`
  - `--color-card` / `--color-card-foreground`
  - `--color-popover` / `--color-popover-foreground`
  - `--color-muted` / `--color-muted-foreground`
  - `--color-accent` / `--color-accent-foreground`
  - `--color-border` / `--color-input`
  - `--color-primary` / `--color-primary-foreground`（蓝色强调）
  - `--color-destructive` / `--color-destructive-foreground`
  - `--color-ring`（蓝色聚焦环）
  - 建议实现结构（示意，具体值在实现阶段确定）：

    ```css
    @layer theme {
      @theme default {
        --color-background: ...;
        --color-foreground: ...;
        --color-primary: ...;
        --color-primary-foreground: ...;
        --color-ring: ...;
      }
    }

    @layer base {
      .dark {
        --color-background: ...;
        --color-foreground: ...;
        --color-primary: ...;
        --color-primary-foreground: ...;
        --color-ring: ...;
      }
    }
    ```
- 引入 `tailwindcss-animate`（Tailwind v4 CSS 插件）以支持 shadcn 常用动画类；在 `src/app/globals.css` 中增加：`@plugin "tailwindcss-animate";`。
- `@layer base` 统一边框与 body 样式：
  - `* { @apply border-border; }`
  - `body { @apply bg-background text-foreground antialiased font-sans; }`
- Typography：继续使用 `@plugin "@tailwindcss/typography";`，阅读区 `prose` 与全局底色/文字统一走 token。

## shadcn/ui 组件层（目录、依赖、工具）

- 组件目录：`src/components/ui/*`
- 工具函数：新增 `src/lib/utils.ts` 提供 `cn(...)`（`clsx` + `tailwind-merge`）
- 第一阶段（MVP）计划引入的 shadcn 组件（对应 `src/components/ui/*`，按需增减）：
  - `button`、`input`、`label`、`select`
  - `dialog`、`sheet`、`alert-dialog`、`tabs`
  - `badge`、`separator`、`scroll-area`、`tooltip`
- 依赖（按最小集逐步安装）：
  - 通用：`class-variance-authority`、`clsx`、`tailwind-merge`、`tailwindcss-animate`
  - Radix（按需）：`@radix-ui/react-dialog`、`@radix-ui/react-alert-dialog`、`@radix-ui/react-select`、`@radix-ui/react-tabs`、`@radix-ui/react-tooltip`、`@radix-ui/react-scroll-area`、`@radix-ui/react-collapsible` 等
- 依赖控制：避免一次性安装所有 Radix 依赖；每新增一个 `src/components/ui/*` 组件时，同步确认并安装其最小依赖集合。
- 路径别名（推荐启用，贴近 shadcn 模板并减少相对路径噪音）：
  - `tsconfig.json`：增加 `baseUrl`/`paths`（例如 `@/* -> src/*`），示意：

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

  - `vitest.config.ts`：同步 alias（否则测试环境解析失败），示意：

    ```ts
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    ```

## 迁移边界（哪些必须改 / 哪些不改）

### 必改模块

- 弹窗/抽屉基座替换：
  - `src/components/common/AppDialog.tsx`
  - `src/components/common/AppDrawer.tsx`
- 自研 floating layer 样式：
  - `src/components/common/floatingLayerStyles.ts`（随基座替换一并移除/替换引用）
- 设置中心与添加源：
  - `src/features/settings/SettingsCenterDrawer.tsx`
  - `src/features/feeds/AddFeedDialog.tsx`
- 阅读器三栏与阅读面板：
  - `src/features/reader/ReaderLayout.tsx`
  - `src/features/feeds/FeedList.tsx`
  - `src/features/articles/ArticleList.tsx`
  - `src/features/articles/ArticleView.tsx`
- 测试更新：
  - `src/components/common/AppDrawer.test.tsx`（替换为 `Sheet` 的行为断言）
  - `src/app/(reader)/ReaderApp.test.tsx`（打开设置后断言新的结构/标识）

### 暂不动模块

- 数据流：Zustand store 与 API 调用保持不变
- 深色模式：`src/hooks/useTheme.ts` 保持 `.dark` class 策略
- 阅读正文渲染：保留 `prose` 与 `dangerouslySetInnerHTML`

## 弹窗 / 抽屉替换设计（Dialog / Sheet / AlertDialog）

### 引入组件

- `Dialog`：用于 `AddFeedDialog`
- `Sheet`：用于 `SettingsCenterDrawer`（右侧抽屉）
- `AlertDialog`：用于设置中心“阻塞关闭确认”（saving/error/hasErrors）

### 行为要求（对齐现状）

- 支持 Esc / 遮罩点击关闭
- 打开时初始聚焦到第一个输入（替代现有 `data-dialog-initial-focus="true"` 逻辑）
- 焦点陷阱与回焦稳定（替代现有手写 Tab 环）
- 关闭阻塞时弹出确认对话框，确认后才丢弃草稿并关闭

### 测试点策略

- 保留必要的 `data-testid`（如 `settings-center-modal`、`settings-center-overlay`），挂到 `SheetContent` / `SheetOverlay`
- 保留 close 按钮 `aria-label`（如 `close-settings`），便于测试稳定查询
- 测试断言尽量基于 role/label/testid，而非 class 片段（避免与 shadcn/Radix 内部结构耦合）

## 阅读器三栏 UI 迁移设计

### 布局（`ReaderLayout`）

- 外层统一：`bg-background text-foreground`
- 分隔线与边框统一走 token：`border-border`
- 列表与正文滚动区尽量统一使用 `ScrollArea`

### 左栏订阅源（`FeedList`）

- 顶部“添加源”改为 `Button`（`variant="ghost" size="icon"`），保留 `aria-label="add-feed"`
- 选中态/hover 统一走 token（优先用 `accent`/`muted`/`primary` 语义）
- 分类展开/收起改用 `Collapsible`（更好的可访问性与一致动画）
- 未读数改用 `Badge`

### 中栏文章列表（`ArticleList`）

- 顶部操作按钮改用 `Button`（`variant="ghost" size="icon"`）
- 列表项 hover/selected 统一使用 token（不再硬编码 `bg-blue-100/80` 等）
- 未读蓝点走 `bg-primary`

### 右栏文章阅读（`ArticleView`）

- 顶部操作统一为 `Button`；收藏优先用 `Button` 变体实现（避免引入额外 Toggle 依赖），如需要再引入 `Toggle`
- “翻译/AI摘要未上线”改用 `Tooltip`（替代 `title`）
- 正文 `prose` 保留；字号/行高/字体切换逻辑保留，仅将外层与文本色改为 token

## 风险与缓解

- Tailwind v4 + shadcn token 对齐：以 `@theme` + `--color-*` 方案落地，避免引入 `tailwind.config.*` 的大改动。
- 弹窗行为回退风险：Radix 负责可访问性与焦点管理；对关键行为（初始聚焦、阻塞关闭）写针对性测试。
- 迁移期间风格混杂：按“先全局 token + Dialog/Sheet + 设置中心/添加源 + 三栏主界面”的顺序推进，确保每一步都有可见收益与可回归测试。
- Client boundary 风险：`src/components/ui/*` 通常需要作为 Client Components 使用（包含 `'use client'`），避免在 Server Components 中直接引入导致构建失败。

## 验收标准

- 主要页面（阅读器三栏、设置中心、添加源弹窗）视觉风格一致，组件来自 `src/components/ui/*`，不再依赖自研 `AppDialog/AppDrawer`。
- 深色/浅色/自动主题切换正常（`.dark` class 策略保持）。
- 关键交互：Esc/遮罩关闭、焦点陷阱、初始聚焦、阻塞关闭确认均可用。
- 单元测试与 lint 可通过：`pnpm run test:unit`、`pnpm run lint`（至少覆盖打开设置与抽屉/弹窗存在性、关闭按钮可查询等稳定点）。

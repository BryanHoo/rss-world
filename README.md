# FeedFuse

现代化 RSS 阅读器 Web 应用。

## 功能特性

- 三栏布局（订阅源、文章列表、阅读面板）
- 文件夹分组管理订阅源
- 智能视图（全部、未读、星标）
- 阅读体验可调（字体、字号、行距）
- 浅色 / 深色 / 自动主题
- 键盘快捷键支持（可配置，默认 `j/k/s/m/v`）
- 星标收藏与自动标记已读

## 设置中心（MVP）

当前设置中心覆盖以下分组能力：

- `appearance`：主题、字号、字体、行距
- `ai`：`provider` / `model` / `apiBaseUrl` / `apiKey`
- `shortcuts`：快捷键启用开关与按键绑定
- `rss`：RSS 源新增 / 编辑 / 删除 / 启停

说明：

- `ai.apiKey` 仅保存在会话态（session），不会持久化到 `localStorage`

## 共享弹窗基座

- 基础 UI 组件位于 `src/components/ui/*`（Radix primitives + shadcn 风格封装）
- 统一弹窗壳位于 `src/components/common/AppDialog.tsx`
- 业务弹窗通过 `AppDialog` 接入（如 `SettingsCenterModal`、`AddFeedDialog`）
- 关闭交互统一支持：Esc、遮罩点击、标题栏关闭按钮、业务取消按钮

## 技术栈

- Next.js 16 App Router + React 19 + TypeScript
- TailwindCSS + Typography
- Zustand
- Lucide React
- Radix UI primitives + class-variance-authority + tailwind-merge

## 本地开发

```bash
pnpm install
pnpm run dev
```

默认地址：`http://127.0.0.1:3000`

## 构建

```bash
pnpm run build
pnpm run start
```

## 验证

```bash
pnpm run lint
pnpm run test:unit
node scripts/verify-next-migration.mjs
```

## 键盘快捷键

- `j`: 下一篇
- `k`: 上一篇
- `s`: 切换星标
- `m`: 标记已读
- `v`: 在新标签页打开原文

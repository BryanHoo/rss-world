# Settings Dialog Shadcn Integration Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 在不改 RSS 三栏页面整体设计的前提下，引入 shadcn/Radix 弹窗基座并重构 SettingsCenter 与 AddFeed 两个弹窗。

**Architecture:** 采用三层结构：`src/components/ui/*`（shadcn 风格基础组件）+ `src/components/common/AppDialog.tsx`（统一弹窗壳）+ 业务弹窗（`SettingsCenterModal`、`AddFeedDialog`）。业务状态与保存逻辑保持现有 store 实现，仅替换 UI 结构与交互壳层。通过 TDD 先补失败用例（Esc/overlay/可访问性），再迁移实现并回归。

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, Zustand, Radix UI primitives, class-variance-authority, Vitest + Testing Library

---

## 0. 现状与先验

- 设计基线：`docs/plans/2026-02-23-settings-dialog-shadcn-design.md`
- 现有弹窗入口：`src/features/settings/SettingsCenterModal.tsx`, `src/features/feeds/FeedList.tsx`
- 现有回归测试：`src/features/settings/SettingsCenterModal.test.tsx`, `src/features/reader/ReaderLayout.test.tsx`, `src/app/(reader)/ReaderApp.test.tsx`
- 先验检索：未发现 `docs/solutions/` 可复用条目（目录不存在），本次按现有代码直接制定计划。

### Task 1: Setup Worktree And UI Dependencies

**Files:**
- Create: `.worktrees/settings-dialog-shadcn/` (git worktree)
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Step 1: 创建独立 worktree**

```bash
git worktree add .worktrees/settings-dialog-shadcn -b feat/settings-dialog-shadcn
```

**Step 2: 安装最小依赖集**

```bash
pnpm add @radix-ui/react-dialog @radix-ui/react-label @radix-ui/react-select @radix-ui/react-slot @radix-ui/react-switch @radix-ui/react-tabs class-variance-authority clsx tailwind-merge
```

**Step 3: 运行基础校验**

Run: `pnpm run lint`
Expected: PASS（仅依赖变更，无 lint 破坏）

**Step 4: 提交依赖基线**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(ui): add radix and shadcn utility deps"
```

### Task 2: Write Failing Tests For New Dialog Behaviors

**Files:**
- Modify: `src/features/settings/SettingsCenterModal.test.tsx`
- Create: `src/features/feeds/AddFeedDialog.test.tsx`

**Step 1: 为 SettingsCenter 增加 Esc/overlay 关闭失败用例**

```tsx
it('closes settings dialog on Escape', async () => {
  resetSettingsStore();
  render(<ReaderLayout />);
  fireEvent.click(screen.getByLabelText('open-settings'));
  await waitFor(() => expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument());

  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByTestId('settings-center-modal')).not.toBeInTheDocument());
});

it('closes settings dialog on overlay click', async () => {
  resetSettingsStore();
  render(<ReaderLayout />);
  fireEvent.click(screen.getByLabelText('open-settings'));
  await waitFor(() => expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument());

  fireEvent.pointerDown(screen.getByTestId('settings-center-overlay'));
  fireEvent.click(screen.getByTestId('settings-center-overlay'));
  await waitFor(() => expect(screen.queryByTestId('settings-center-modal')).not.toBeInTheDocument());
});
```

**Step 2: 为 AddFeed 创建失败用例（打开、取消、提交、禁用）**

```tsx
it('opens and closes add feed dialog', () => {
  render(<ReaderLayout />);
  fireEvent.click(screen.getByLabelText('add-feed'));
  expect(screen.getByRole('dialog', { name: '添加 RSS 源' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  expect(screen.queryByRole('dialog', { name: '添加 RSS 源' })).not.toBeInTheDocument();
});

it('disables submit until title and url are filled', () => {
  render(<ReaderLayout />);
  fireEvent.click(screen.getByLabelText('add-feed'));
  expect(screen.getByRole('button', { name: '添加' })).toBeDisabled();
});
```

**Step 3: 运行测试确认失败（红灯）**

Run: `pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx src/features/feeds/AddFeedDialog.test.tsx`
Expected: FAIL（当前实现缺 Esc/overlay 语义与独立 AddFeed 组件）

**Step 4: 提交失败测试基线**

```bash
git add src/features/settings/SettingsCenterModal.test.tsx src/features/feeds/AddFeedDialog.test.tsx
git commit -m "test(dialog): add failing coverage for settings and add-feed dialog behaviors"
```

### Task 3: Build Shadcn-Style UI Primitives And AppDialog Shell

**Files:**
- Create: `src/lib/utils.ts`
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/label.tsx`
- Create: `src/components/ui/dialog.tsx`
- Create: `src/components/ui/tabs.tsx`
- Create: `src/components/ui/select.tsx`
- Create: `src/components/ui/switch.tsx`
- Create: `src/components/common/AppDialog.tsx`

**Step 1: 创建 `cn` 工具**

```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Step 2: 实现基础 UI 组件（与当前设计语言对齐）**

```tsx
// src/components/ui/dialog.tsx
'use client';
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '../../lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef(...);
export const DialogContent = React.forwardRef(...);
export const DialogTitle = React.forwardRef(...);
export const DialogDescription = React.forwardRef(...);
```

**Step 3: 实现统一弹窗壳层 `AppDialog`**

```tsx
interface AppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  testId?: string;
  overlayTestId?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}
```

要求：
- 提供统一 `DialogOverlay`、`DialogContent`、Header、Footer。
- 支持 `testId="settings-center-modal"` 与 `overlayTestId="settings-center-overlay"`。
- 样式贴合当前灰阶 + 蓝色强调，不更改全局主题。

**Step 4: 运行类型与单测（仍可能部分失败）**

Run: `pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx src/features/feeds/AddFeedDialog.test.tsx`
Expected: 部分 FAIL（业务弹窗尚未迁移）

**Step 5: 提交基础层**

```bash
git add src/lib/utils.ts src/components/ui src/components/common/AppDialog.tsx
git commit -m "feat(ui): add shadcn-style dialog primitives and app dialog shell"
```

### Task 4: Refactor SettingsCenterModal To AppDialog + Tabs

**Files:**
- Modify: `src/features/settings/SettingsCenterModal.tsx`
- Modify: `src/features/settings/panels/AppearanceSettingsPanel.tsx`
- Modify: `src/features/settings/panels/AISettingsPanel.tsx`
- Modify: `src/features/settings/panels/ShortcutsSettingsPanel.tsx`
- Modify: `src/features/settings/panels/RssSourcesSettingsPanel.tsx`

**Step 1: 迁移外壳为 `AppDialog`**

```tsx
<AppDialog
  open
  onOpenChange={(nextOpen) => {
    if (!nextOpen) handleCancel();
  }}
  title="设置中心"
  description="管理阅读体验、AI 与快捷键设置"
  testId="settings-center-modal"
  overlayTestId="settings-center-overlay"
  footer={...}
>
  {/* Tabs + panel content */}
</AppDialog>
```

**Step 2: 重构内容结构（允许完全重构内容）**

```tsx
<Tabs value={activePanel} onValueChange={(value) => setActivePanel(value as PanelKey)}>
  <TabsList className="grid grid-cols-4 ...">
    <TabsTrigger value="appearance">外观</TabsTrigger>
    <TabsTrigger value="ai">AI</TabsTrigger>
    <TabsTrigger value="shortcuts">快捷键</TabsTrigger>
    <TabsTrigger value="rss">RSS 源</TabsTrigger>
  </TabsList>
  <TabsContent value="appearance"><AppearanceSettingsPanel ... /></TabsContent>
</Tabs>
```

要求：
- 保持业务流程与 store 接口不变。
- 可调整按钮图标与布局，但整体风格继续贴合当前三栏页面。

**Step 3: 运行 settings 回归测试**

Run: `pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx`
Expected: PASS（含新增 Esc/overlay 关闭）

**Step 4: 提交 SettingsCenter 迁移**

```bash
git add src/features/settings/SettingsCenterModal.tsx src/features/settings/panels/*.tsx
git commit -m "feat(settings): migrate settings center to app dialog and tabs"
```

### Task 5: Extract And Migrate AddFeedDialog

**Files:**
- Create: `src/features/feeds/AddFeedDialog.tsx`
- Modify: `src/features/feeds/FeedList.tsx`
- (If still used) Modify: `src/components/FeedList/index.tsx`

**Step 1: 提取 AddFeedDialog 组件并接入 `AppDialog`**

```tsx
interface AddFeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: Folder[];
  onSubmit: (payload: { title: string; url: string; folderId: string }) => void;
}
```

要求：
- dialog 标题维持“添加 RSS 源”。
- 保持 `aria-label="close-add-feed"`。
- `添加` 按钮在 title/url 为空时禁用。

**Step 2: FeedList 使用新组件**

```tsx
<AddFeedDialog
  open={addFeedOpen}
  onOpenChange={setAddFeedOpen}
  folders={folders}
  onSubmit={({ title, url, folderId }) => {
    // 使用现有 addFeed + setSelectedView 逻辑
  }}
/>
```

**Step 3: 运行 add-feed 测试**

Run: `pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx src/features/reader/ReaderLayout.test.tsx`
Expected: PASS

**Step 4: 提交 AddFeed 迁移**

```bash
git add src/features/feeds/AddFeedDialog.tsx src/features/feeds/FeedList.tsx src/components/FeedList/index.tsx src/features/feeds/AddFeedDialog.test.tsx
git commit -m "feat(feeds): extract add feed dialog onto shared app dialog shell"
```

### Task 6: Full Verification And Polish

**Files:**
- Modify: `README.md`（如需补充 UI 基座说明）

**Step 1: 执行完整回归**

Run: `pnpm run test:unit`
Expected: PASS

Run: `pnpm run lint`
Expected: PASS

**Step 2: 手工验收清单**

1. 三栏布局与主视觉未改变。
2. 设置中心可通过 Esc / 遮罩 / 取消 / X 关闭。
3. AddFeed 对话框交互、禁用态、提交逻辑正常。
4. 深浅色模式下弹窗与页面视觉和谐。

**Step 3: 提交收尾**

```bash
git add README.md
git commit -m "docs: document shared dialog foundation and usage"
```

---

## 执行顺序与批次建议

- Batch A: Task 1-2（环境与红灯测试）
- Batch B: Task 3-4（基础层 + settings 迁移）
- Batch C: Task 5-6（add-feed 迁移 + 全量回归）

## 风险点检查

1. `src/components/*` 与 `src/features/*` 存在重复实现，迁移时要确认真实渲染路径，避免只改到未使用文件。
2. Radix Portal 挂载到 `document.body`，测试中需用 `screen` 全局查询，不依赖局部容器。
3. 若 overlay 点击关闭引发与保存逻辑冲突，优先保持 `discardDraft()` 行为一致。

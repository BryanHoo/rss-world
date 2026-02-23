# Settings Drawer Redesign Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 将当前设置 `Modal` 重构为右侧 `Drawer`，完成 `Minimal OS` 风格改版，并将保存策略改为自动保存（含关闭二次确认）。

**Architecture:** 保留 `useSettingsStore` 与 `validateSettingsDraft` 作为唯一状态/校验真源；新增可复用 `Sheet/AppDrawer` 容器承接右侧抽屉交互；在设置容器中引入 `debounce` 自动保存编排与关闭拦截；分组面板仅重做 UI，不新增业务字段。

**Tech Stack:** Next.js 16、React 19、TypeScript、Tailwind CSS v4、Radix Dialog primitives、Zustand、Vitest + Testing Library。

---

## Scope Lock

1. 不新增路由，继续使用 `open-settings` 入口。
2. 功能范围锁定为 `Appearance/AI/Shortcuts/RSS CRUD`。
3. 保存策略为自动保存，不提供显式 `Save` 按钮。
4. `apiKey` 保持 `sessionOnly`，不能落入 `localStorage`。

## Prior Art

1. 设计输入：`docs/plans/2026-02-23-settings-drawer-redesign-design.md`
2. 关联历史：`docs/plans/2026-02-23-settings-center-design.md`
3. `docs/solutions/` 与 `~/.agents/docs/solutions/` 当前不存在，按协议跳过复用。

### Task 1: 建立 Drawer 基础组件（`Sheet` + `AppDrawer`）

**Files:**

- Create: `src/components/ui/sheet.tsx`
- Create: `src/components/common/AppDrawer.tsx`
- Test: `src/components/common/AppDrawer.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import AppDrawer from './AppDrawer';

describe('AppDrawer', () => {
  it('renders right-side drawer shell with overlay and header actions', () => {
    render(
      <AppDrawer
        open
        onOpenChange={() => {}}
        title="设置"
        closeLabel="close-settings"
        testId="settings-center-modal"
        overlayTestId="settings-center-overlay"
      >
        <div>content</div>
      </AppDrawer>
    );

    expect(screen.getByTestId('settings-center-modal').className).toContain('right-0');
    expect(screen.getByTestId('settings-center-overlay')).toBeInTheDocument();
    expect(screen.getByLabelText('close-settings')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/common/AppDrawer.test.tsx`
Expected: FAIL with module not found for `AppDrawer`/`sheet`.

**Step 3: Write minimal implementation**

```tsx
// src/components/ui/sheet.tsx
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '../../lib/utils';

export const Sheet = DialogPrimitive.Root;
export const SheetPortal = DialogPrimitive.Portal;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

export const SheetOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} className={cn('fixed inset-0 z-50 bg-black/35', className)} {...props} />
));

export const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Content
    ref={ref}
    className={cn('fixed right-0 top-0 z-50 h-screen w-full max-w-[960px] border-l bg-white shadow-xl', className)}
    {...props}
  />
));
```

```tsx
// src/components/common/AppDrawer.tsx
import { X } from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetOverlay, SheetPortal, SheetTitle } from '../ui/sheet';

export default function AppDrawer(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  closeLabel?: string;
  testId?: string;
  overlayTestId?: string;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
}) {
  const { open, onOpenChange, title, description, closeLabel = 'close-drawer', testId, overlayTestId, children, headerExtra } = props;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPortal>
        <SheetOverlay data-testid={overlayTestId} />
        <SheetContent data-testid={testId}>
          <header className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <SheetTitle>{title}</SheetTitle>
              {description ? <SheetDescription>{description}</SheetDescription> : null}
            </div>
            <div className="flex items-center gap-2">
              {headerExtra}
              <SheetClose asChild>
                <button type="button" aria-label={closeLabel}>
                  <X size={18} />
                </button>
              </SheetClose>
            </div>
          </header>
          <div className="h-[calc(100vh-73px)] overflow-hidden">{children}</div>
        </SheetContent>
      </SheetPortal>
    </Sheet>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/common/AppDrawer.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/ui/sheet.tsx src/components/common/AppDrawer.tsx src/components/common/AppDrawer.test.tsx
git commit -m "feat(settings): add reusable drawer shell for settings"
```

### Task 2: 迁移设置容器到 Drawer 骨架（保留现有字段逻辑）

**Files:**

- Create: `src/features/settings/SettingsCenterDrawer.tsx`
- Modify: `src/features/settings/SettingsCenterModal.tsx`
- Modify: `src/features/reader/ReaderLayout.tsx`
- Test: `src/features/settings/SettingsCenterModal.test.tsx`
- Test: `src/features/reader/ReaderLayout.test.tsx`
- Test: `src/app/(reader)/ReaderApp.test.tsx`

**Step 1: Write the failing test**

```tsx
it('renders settings in right drawer layout and removes footer save button', async () => {
  render(<ReaderLayout />);
  fireEvent.click(screen.getByLabelText('open-settings'));

  await waitFor(() => {
    expect(screen.getByTestId('settings-center-modal').className).toContain('right-0');
  });

  expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/settings/SettingsCenterModal.test.tsx -t "renders settings in right drawer layout"`
Expected: FAIL because current container still renders `AppDialog` + `保存` button.

**Step 3: Write minimal implementation**

```tsx
// src/features/settings/SettingsCenterDrawer.tsx
import AppDrawer from '../../components/common/AppDrawer';

export default function SettingsCenterDrawer({ onClose }: { onClose: () => void }) {
  // 先复用原有 tabs + panels，仅替换外层容器
  return (
    <AppDrawer
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title="设置中心"
      description="管理阅读体验、AI、快捷键与 RSS"
      closeLabel="close-settings"
      testId="settings-center-modal"
      overlayTestId="settings-center-overlay"
    >
      {/* 原 SettingsCenterModal 的主体内容迁入此处 */}
    </AppDrawer>
  );
}
```

```tsx
// src/features/settings/SettingsCenterModal.tsx
export { default } from './SettingsCenterDrawer';
```

**Step 4: Run tests to verify it passes**

Run: `pnpm vitest run src/features/settings/SettingsCenterModal.test.tsx src/features/reader/ReaderLayout.test.tsx 'src/app/(reader)/ReaderApp.test.tsx'`
Expected: PASS 或仅剩自动保存相关用例失败（留待后续任务修复）。

**Step 5: Commit**

```bash
git add src/features/settings/SettingsCenterDrawer.tsx src/features/settings/SettingsCenterModal.tsx src/features/reader/ReaderLayout.tsx src/features/settings/SettingsCenterModal.test.tsx src/features/reader/ReaderLayout.test.tsx 'src/app/(reader)/ReaderApp.test.tsx'
git commit -m "refactor(settings): move settings container from modal to drawer"
```

### Task 3: 实现自动保存编排（debounce + 状态文案）

**Files:**

- Create: `src/features/settings/useSettingsAutosave.ts`
- Modify: `src/features/settings/SettingsCenterDrawer.tsx`
- Test: `src/features/settings/useSettingsAutosave.test.ts`
- Test: `src/features/settings/SettingsCenterModal.test.tsx`

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSettingsAutosave } from './useSettingsAutosave';

it('debounces saveDraft and exposes saving/saved status', async () => {
  vi.useFakeTimers();
  const saveDraft = vi.fn(() => ({ ok: true }));

  const { rerender, result } = renderHook(({ tick }) => useSettingsAutosave({
    draftVersion: tick,
    saveDraft,
    hasErrors: false,
  }), { initialProps: { tick: 0 } });

  rerender({ tick: 1 });
  expect(result.current.status).toBe('saving');
  vi.advanceTimersByTime(500);
  expect(saveDraft).toHaveBeenCalledTimes(1);
  expect(result.current.status).toBe('saved');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/settings/useSettingsAutosave.test.ts`
Expected: FAIL with missing hook implementation.

**Step 3: Write minimal implementation**

```ts
// src/features/settings/useSettingsAutosave.ts
import { useEffect, useMemo, useState } from 'react';

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useSettingsAutosave(input: {
  draftVersion: number;
  saveDraft: () => { ok: boolean };
  hasErrors: boolean;
  delayMs?: number;
}) {
  const { draftVersion, saveDraft, hasErrors, delayMs = 500 } = input;
  const [status, setStatus] = useState<AutosaveStatus>('idle');

  useEffect(() => {
    if (draftVersion === 0) return;
    if (hasErrors) {
      setStatus('error');
      return;
    }

    setStatus('saving');
    const timer = window.setTimeout(() => {
      const result = saveDraft();
      setStatus(result.ok ? 'saved' : 'error');
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [draftVersion, hasErrors, saveDraft, delayMs]);

  return useMemo(() => ({ status }), [status]);
}
```

```tsx
// SettingsCenterDrawer.tsx 顶部状态文案
const statusLabel = {
  idle: '未修改',
  saving: 'Saving...',
  saved: 'Saved',
  error: 'Fix errors to save',
}[autosave.status];
```

**Step 4: Run tests to verify it passes**

Run: `pnpm vitest run src/features/settings/useSettingsAutosave.test.ts src/features/settings/SettingsCenterModal.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/settings/useSettingsAutosave.ts src/features/settings/useSettingsAutosave.test.ts src/features/settings/SettingsCenterDrawer.tsx src/features/settings/SettingsCenterModal.test.tsx
git commit -m "feat(settings): add debounced autosave for drawer settings"
```

### Task 4: 实现关闭拦截与二次确认

**Files:**

- Modify: `src/features/settings/SettingsCenterDrawer.tsx`
- Test: `src/features/settings/SettingsCenterModal.test.tsx`

**Step 1: Write the failing test**

```tsx
it('asks for confirmation when closing with unresolved validation errors', async () => {
  render(<ReaderLayout />);
  fireEvent.click(screen.getByLabelText('open-settings'));

  fireEvent.click(screen.getByRole('tab', { name: '快捷键' }));
  fireEvent.change(screen.getByLabelText('上一条'), { target: { value: 'j' } });

  fireEvent.click(screen.getByLabelText('close-settings'));
  expect(screen.getByText('关闭后会丢失未成功保存的修改')).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/settings/SettingsCenterModal.test.tsx -t "asks for confirmation when closing"`
Expected: FAIL because close currently directly dismisses drawer.

**Step 3: Write minimal implementation**

```tsx
const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
const hasBlockingState = autosave.status === 'saving' || Object.keys(validationErrors).length > 0;

const requestClose = () => {
  if (hasBlockingState) {
    setCloseConfirmOpen(true);
    return;
  }
  discardDraft();
  onClose();
};
```

```tsx
{closeConfirmOpen ? (
  <AppDialog
    open
    onOpenChange={setCloseConfirmOpen}
    title="确认关闭"
    description="关闭后会丢失未成功保存的修改"
    closeLabel="close-discard-confirm"
    footer={
      <>
        <Button type="button" variant="secondary" onClick={() => setCloseConfirmOpen(false)}>继续编辑</Button>
        <Button type="button" onClick={() => { discardDraft(); onClose(); }}>确认关闭</Button>
      </>
    }
  >
    <p className="text-sm text-gray-600">请先修复错误，或确认放弃这些修改。</p>
  </AppDialog>
) : null}
```

**Step 4: Run tests to verify it passes**

Run: `pnpm vitest run src/features/settings/SettingsCenterModal.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/settings/SettingsCenterDrawer.tsx src/features/settings/SettingsCenterModal.test.tsx
git commit -m "feat(settings): add guarded close confirmation for drawer"
```

### Task 5: 重做四个设置分组 UI（Minimal OS）

**Files:**

- Modify: `src/features/settings/panels/AppearanceSettingsPanel.tsx`
- Modify: `src/features/settings/panels/AISettingsPanel.tsx`
- Modify: `src/features/settings/panels/ShortcutsSettingsPanel.tsx`
- Modify: `src/features/settings/panels/RssSourcesSettingsPanel.tsx`
- Test: `src/features/settings/SettingsCenterModal.test.tsx`

**Step 1: Write the failing test**

```tsx
it('renders drawer with left nav and right content workspace layout', async () => {
  render(<ReaderLayout />);
  fireEvent.click(screen.getByLabelText('open-settings'));

  await waitFor(() => {
    expect(screen.getByRole('tablist').className).toContain('flex-col');
  });

  expect(screen.getByText('Appearance')).toBeInTheDocument();
  expect(screen.getByText('RSS Sources')).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/settings/SettingsCenterModal.test.tsx -t "left nav and right content workspace layout"`
Expected: FAIL because current labels/样式未按新规范。

**Step 3: Write minimal implementation**

```tsx
// 例：Appearance panel 中统一控件风格
const optionClass =
  'h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 ' +
  'aria-[pressed=true]:border-gray-900 aria-[pressed=true]:bg-gray-100';
```

```tsx
// 例：AI panel 使用统一输入框样式
<input
  id="ai-model"
  className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-300"
/>
```

**Step 4: Run tests to verify it passes**

Run: `pnpm vitest run src/features/settings/SettingsCenterModal.test.tsx src/features/reader/ReaderLayout.test.tsx 'src/app/(reader)/ReaderApp.test.tsx'`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/settings/panels/AppearanceSettingsPanel.tsx src/features/settings/panels/AISettingsPanel.tsx src/features/settings/panels/ShortcutsSettingsPanel.tsx src/features/settings/panels/RssSourcesSettingsPanel.tsx src/features/settings/SettingsCenterModal.test.tsx src/features/reader/ReaderLayout.test.tsx 'src/app/(reader)/ReaderApp.test.tsx'
git commit -m "feat(settings): redesign settings panels with minimal os style"
```

### Task 6: 全量验证与交付收尾

**Files:**

- Modify: `README.md`（若需补充设置交互说明）
- Verify: `src/store/settingsStore.test.ts`
- Verify: `src/features/settings/validateSettingsDraft.test.ts`
- Verify: `src/features/settings/settingsSchema.test.ts`

**Step 1: Run focused regression suite**

Run:

```bash
pnpm vitest run src/components/common/AppDrawer.test.tsx src/features/settings/useSettingsAutosave.test.ts src/features/settings/SettingsCenterModal.test.tsx src/features/reader/ReaderLayout.test.tsx 'src/app/(reader)/ReaderApp.test.tsx' src/store/settingsStore.test.ts src/features/settings/validateSettingsDraft.test.ts src/features/settings/settingsSchema.test.ts
```

Expected: PASS all tests.

**Step 2: Run full unit tests**

Run: `pnpm test:unit`
Expected: PASS with zero failed tests.

**Step 3: Run lint**

Run: `pnpm lint`
Expected: PASS with zero errors.

**Step 4: Verify apiKey not persisted (manual + assertion)**

Run: `pnpm vitest run src/store/settingsStore.test.ts src/features/settings/SettingsCenterModal.test.tsx -t "apiKey"`
Expected: PASS，且 `feedfuse-settings` payload 不包含 `sk-`。

**Step 5: Commit**

```bash
git add README.md src/components/common/AppDrawer.tsx src/components/ui/sheet.tsx src/features/settings src/features/reader/ReaderLayout.tsx src/features/reader/ReaderLayout.test.tsx 'src/app/(reader)/ReaderApp.test.tsx'
git commit -m "feat(settings): ship drawer autosave redesign with full regression coverage"
```

## Risks & Guardrails

1. 风险：自动保存导致高频重渲染。
- 约束：只以 `draftVersion` 变化驱动保存，不直接监听整个对象引用。

2. 风险：关闭确认与 overlay/Esc 事件冲突。
- 约束：所有关闭入口统一走 `requestClose()`。

3. 风险：视觉重做破坏可访问性。
- 约束：保留 `label`/`aria-label`、键盘可达、错误文本可读。

4. 风险：回归测试依赖旧 selector。
- 约束：继续保留 `open-settings`、`settings-center-modal`、`settings-center-overlay`。

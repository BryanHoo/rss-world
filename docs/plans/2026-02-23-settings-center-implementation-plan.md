# Settings Center Redesign Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 将右栏顶部设置弹窗升级为可扩展的经典设置中心，落地 MVP 设置项（appearance、ai、shortcuts、rss CRUD）并保持现有阅读功能回归稳定。

**Architecture:** 采用命名空间设置模型（`persistedSettings` + `sessionSettings` + `draft`），由 `settingsStore` 统一管理草稿生命周期与保存流程。设置中心按分组面板拆分，保存前通过集中校验函数拦截错误。`ai.apiKey` 仅驻留会话态，不进入持久化存储。

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand + persist, Vitest, Testing Library, TailwindCSS

---

## Prior Art Scan

- 已扫描项目内可复用方案：`docs/solutions/` 当前不存在可复用文档。
- 设计基线文档：`docs/plans/2026-02-23-settings-center-design.md`
- 现有关键入口：`src/features/reader/ReaderLayout.tsx`, `src/features/settings/SettingsModal.tsx`, `src/store/settingsStore.ts`

## Preflight

### Task 0: Create Isolated Worktree (recommended before coding)

**Files:**

- Create: `.worktrees/settings-center/` (git worktree)

**Step 1: 创建独立工作树**

Run: `git worktree add .worktrees/settings-center -b feat/settings-center-redesign`
Expected: 新建工作树并切到新分支

**Step 2: 安装依赖（若需要）**

Run: `pnpm install`
Expected: lockfile 不变化或仅安装输出

**Step 3: 基线验证**

Run: `pnpm run test:unit`
Expected: PASS

**Step 4: 记录基线**

Run: `git status --short`
Expected: clean worktree

**Step 5: Commit**

无需提交（preflight）

---

### Task 1: Define Settings Schema and Legacy Normalization

**Files:**

- Create: `src/features/settings/settingsSchema.ts`
- Test: `src/features/settings/settingsSchema.test.ts`
- Modify: `src/types/index.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { normalizePersistedSettings } from './settingsSchema';

describe('settingsSchema normalize', () => {
  it('maps legacy flat settings to appearance namespace', () => {
    const normalized = normalizePersistedSettings({
      theme: 'dark',
      fontSize: 'large',
      fontFamily: 'serif',
      lineHeight: 'relaxed',
    });

    expect(normalized.appearance.theme).toBe('dark');
    expect(normalized.appearance.fontSize).toBe('large');
    expect(normalized.ai.provider).toBe('openai-compatible');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/settings/settingsSchema.test.ts`
Expected: FAIL with missing module/function

**Step 3: Write minimal implementation**

```ts
export interface PersistedSettings {
  appearance: { theme: 'light' | 'dark' | 'auto'; fontSize: 'small' | 'medium' | 'large'; fontFamily: 'sans' | 'serif'; lineHeight: 'compact' | 'normal' | 'relaxed' };
  ai: { summaryEnabled: boolean; translateEnabled: boolean; autoSummarize: boolean; provider: string; model: string; apiBaseUrl: string };
  shortcuts: { enabled: boolean; bindings: { nextArticle: string; prevArticle: string; toggleStar: string; markRead: string; openOriginal: string } };
  rss: { sources: Array<{ id: string; name: string; url: string; folder: string | null; enabled: boolean }> };
}

export function normalizePersistedSettings(input: unknown): PersistedSettings {
  // 支持 legacy flat UserSettings -> appearance.* 映射
  // 缺失字段回退默认值
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/features/settings/settingsSchema.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/settings/settingsSchema.ts src/features/settings/settingsSchema.test.ts src/types/index.ts
git commit -m "feat(settings): add schema defaults and legacy normalization"
```

---

### Task 2: Add Draft Validation Rules

**Files:**

- Create: `src/features/settings/validateSettingsDraft.ts`
- Test: `src/features/settings/validateSettingsDraft.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { validateSettingsDraft } from './validateSettingsDraft';

it('rejects non-http rss url and duplicate shortcut bindings', () => {
  const result = validateSettingsDraft({
    persisted: {
      shortcuts: {
        enabled: true,
        bindings: {
          nextArticle: 'j',
          prevArticle: 'j',
          toggleStar: 's',
          markRead: 'm',
          openOriginal: 'v',
        },
      },
      rss: { sources: [{ id: '1', name: 'A', url: 'ftp://bad', folder: null, enabled: true }] },
    },
  } as any);

  expect(result.valid).toBe(false);
  expect(result.errors['rss.sources.0.url']).toBeTruthy();
  expect(result.errors['shortcuts.bindings']).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/settings/validateSettingsDraft.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
export function validateSettingsDraft(draft: SettingsDraft) {
  const errors: Record<string, string> = {};

  // rss name/url required + http/https
  // ai.apiBaseUrl 非空时 URL 校验
  // shortcuts bindings 去重校验

  return { valid: Object.keys(errors).length === 0, errors };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/features/settings/validateSettingsDraft.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/settings/validateSettingsDraft.ts src/features/settings/validateSettingsDraft.test.ts
git commit -m "feat(settings): add draft validation for ai shortcuts and rss"
```

---

### Task 3: Refactor settingsStore for persisted/session/draft

**Files:**

- Modify: `src/store/settingsStore.ts`
- Test: `src/store/settingsStore.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { useSettingsStore } from './settingsStore';

it('does not persist apiKey into localStorage payload', () => {
  useSettingsStore.getState().loadDraft();
  useSettingsStore.getState().updateDraft((draft) => {
    draft.session.ai.apiKey = 'sk-test';
  });
  useSettingsStore.getState().saveDraft();

  const raw = window.localStorage.getItem('feedfuse-settings');
  expect(raw).not.toContain('sk-test');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/store/settingsStore.test.ts`
Expected: FAIL with missing actions/state shape

**Step 3: Write minimal implementation**

```ts
interface SettingsState {
  persistedSettings: PersistedSettings;
  sessionSettings: { ai: { apiKey: string } };
  draft: SettingsDraft | null;
  validationErrors: Record<string, string>;
  loadDraft: () => void;
  updateDraft: (updater: (draft: SettingsDraft) => void) => void;
  saveDraft: () => { ok: boolean };
  discardDraft: () => void;
}

persist(
  (set, get) => ({ ... }),
  {
    name: 'feedfuse-settings',
    partialize: (state) => ({ persistedSettings: state.persistedSettings }),
    version: 2,
    migrate: (persistedState) => ({ persistedSettings: normalizePersistedSettings(persistedState) }),
  }
)
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/store/settingsStore.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/store/settingsStore.ts src/store/settingsStore.test.ts
git commit -m "refactor(settings): split persisted session draft state in store"
```

---

### Task 4: Rewire Appearance Consumers to New Store Shape

**Files:**

- Modify: `src/hooks/useTheme.ts`
- Modify: `src/features/articles/ArticleView.tsx`
- Test: `src/hooks/useTheme.test.tsx`

**Step 1: Write the failing test**

```ts
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSettingsStore } from '../store/settingsStore';
import { useTheme } from './useTheme';

function Harness() {
  useTheme();
  return null;
}

it('applies dark class from persisted appearance theme', () => {
  useSettingsStore.setState((s) => ({
    ...s,
    persistedSettings: { ...s.persistedSettings, appearance: { ...s.persistedSettings.appearance, theme: 'dark' } },
  }));
  render(<Harness />);
  expect(document.documentElement.classList.contains('dark')).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/hooks/useTheme.test.tsx`
Expected: FAIL due to old selector path

**Step 3: Write minimal implementation**

```ts
const theme = useSettingsStore((state) => state.persistedSettings.appearance.theme);
// useEffect logic unchanged, only读取路径变更
```

并在 `ArticleView.tsx` 将 `settings.fontSize/fontFamily/lineHeight` 切换为 `persistedSettings.appearance.*`。

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/hooks/useTheme.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/useTheme.ts src/features/articles/ArticleView.tsx src/hooks/useTheme.test.tsx
git commit -m "refactor(settings): wire appearance consumers to namespaced store"
```

---

### Task 5: Rewire Keyboard Shortcuts to Configurable Bindings

**Files:**

- Modify: `src/hooks/useKeyboardShortcuts.ts`
- Test: `src/hooks/useKeyboardShortcuts.test.tsx`

**Step 1: Write the failing test**

```ts
it('uses configured key binding for nextArticle', () => {
  // 将 shortcuts.bindings.nextArticle 设为 n
  // 触发 keydown('n') 后应选中下一篇
});

it('ignores keydown when shortcuts.enabled is false', () => {
  // enabled=false 时 keydown('j') 不应触发跳转
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/hooks/useKeyboardShortcuts.test.tsx`
Expected: FAIL（仍硬编码 j/k/s/m/v）

**Step 3: Write minimal implementation**

```ts
const shortcuts = useSettingsStore((s) => s.persistedSettings.shortcuts);
if (!shortcuts.enabled) return;

const keyMap = {
  [shortcuts.bindings.nextArticle.toLowerCase()]: 'nextArticle',
  [shortcuts.bindings.prevArticle.toLowerCase()]: 'prevArticle',
  [shortcuts.bindings.toggleStar.toLowerCase()]: 'toggleStar',
  [shortcuts.bindings.markRead.toLowerCase()]: 'markRead',
  [shortcuts.bindings.openOriginal.toLowerCase()]: 'openOriginal',
};
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/hooks/useKeyboardShortcuts.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/useKeyboardShortcuts.ts src/hooks/useKeyboardShortcuts.test.tsx
git commit -m "feat(settings): drive keyboard shortcuts from settings bindings"
```

---

### Task 6: Replace Modal Shell with SettingsCenter + Draft Lifecycle

**Files:**

- Create: `src/features/settings/SettingsCenterModal.tsx`
- Create: `src/features/settings/panels/AppearanceSettingsPanel.tsx`
- Modify: `src/features/reader/ReaderLayout.tsx`
- Test: `src/features/settings/SettingsCenterModal.test.tsx`

**Step 1: Write the failing test**

```ts
it('loads draft on open and discards draft on cancel', async () => {
  // open-settings -> 改动 theme -> cancel -> reopen
  // 断言未保存变更被丢弃
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx`
Expected: FAIL（旧 modal 无 draft 生命周期）

**Step 3: Write minimal implementation**

```tsx
export default function SettingsCenterModal({ onClose }: { onClose: () => void }) {
  const { draft, loadDraft, discardDraft, saveDraft } = useSettingsStore();
  useEffect(() => { loadDraft(); }, [loadDraft]);

  const onCancel = () => { discardDraft(); onClose(); };
  const onSave = () => {
    const result = saveDraft();
    if (result.ok) onClose();
  };

  return <div data-testid="settings-center-modal">...</div>;
}
```

并在 `ReaderLayout.tsx` 将 `SettingsModal` 替换为 `SettingsCenterModal`。

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/settings/SettingsCenterModal.tsx src/features/settings/panels/AppearanceSettingsPanel.tsx src/features/reader/ReaderLayout.tsx src/features/settings/SettingsCenterModal.test.tsx
git commit -m "feat(settings): add settings center shell with draft save cancel flow"
```

---

### Task 7: Implement AI and Shortcuts Panels

**Files:**

- Create: `src/features/settings/panels/AISettingsPanel.tsx`
- Create: `src/features/settings/panels/ShortcutsSettingsPanel.tsx`
- Modify: `src/features/settings/SettingsCenterModal.tsx`
- Test: `src/features/settings/SettingsCenterModal.test.tsx`

**Step 1: Write the failing test**

```ts
it('shows default ai provider as openai-compatible and blocks save on duplicate shortcut', async () => {
  // 打开 AI 面板断言 provider 默认值
  // 设置 shortcuts 两个动作同键并保存 -> 显示错误且不关闭
});

it('keeps apiKey out of localStorage after save', async () => {
  // 输入 apiKey 后保存
  // localStorage payload 不包含 sk-
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

```tsx
<AISettingsPanel draft={draft} onChange={updateDraft} />
<ShortcutsSettingsPanel draft={draft} onChange={updateDraft} errors={validationErrors} />

// AI: provider/model/apiBaseUrl/apiKey 输入
// Shortcuts: enabled + bindings 输入
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/settings/panels/AISettingsPanel.tsx src/features/settings/panels/ShortcutsSettingsPanel.tsx src/features/settings/SettingsCenterModal.tsx src/features/settings/SettingsCenterModal.test.tsx
git commit -m "feat(settings): add ai and shortcuts panels with validation feedback"
```

---

### Task 8: Implement RSS Sources CRUD Panel

**Files:**

- Create: `src/features/settings/panels/RssSourcesSettingsPanel.tsx`
- Modify: `src/features/settings/SettingsCenterModal.tsx`
- Test: `src/features/settings/SettingsCenterModal.test.tsx`

**Step 1: Write the failing test**

```ts
it('supports rss source add edit delete toggle in draft and saves valid rows only', async () => {
  // 新增 source -> 填 name/url/folder/enabled
  // 编辑 name
  // toggle enabled
  // 删除 row
  // 无效 url 时保存失败，有效时保存成功
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

```tsx
// 列表渲染 draft.persisted.rss.sources
// add: push({ id: crypto.randomUUID(), name:'', url:'', folder:null, enabled:true })
// edit: 更新对应字段
// delete: 按 id 过滤
// toggle: enabled 取反
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/features/settings/SettingsCenterModal.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/settings/panels/RssSourcesSettingsPanel.tsx src/features/settings/SettingsCenterModal.tsx src/features/settings/SettingsCenterModal.test.tsx
git commit -m "feat(settings): add rss source crud panel for settings center"
```

---

### Task 9: Full Regression and Documentation Update

**Files:**

- Modify: `README.md`
- Modify: `src/features/reader/ReaderLayout.test.tsx`
- Modify: `src/app/(reader)/ReaderApp.test.tsx`

**Step 1: Write the failing test**

在 `ReaderLayout` / `ReaderApp` 测试中新增对设置中心基础可见性断言（例如打开后存在 `settings-center-modal`）。

```ts
expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
```

**Step 2: Run targeted tests to verify they fail**

Run: `pnpm run test:unit -- src/features/reader/ReaderLayout.test.tsx 'src/app/(reader)/ReaderApp.test.tsx'`
Expected: FAIL（旧断言未覆盖新容器）

**Step 3: Write minimal implementation/docs**

- 更新测试断言以匹配新设置中心入口和容器行为
- 在 `README.md` 增加“设置中心（MVP）”说明：
  - appearance/ai/shortcuts/rss 覆盖范围
  - `apiKey` 会话态，不持久化

**Step 4: Run full verification**

Run:

```bash
pnpm run lint
pnpm run test:unit
```

Expected: 全部 PASS

**Step 5: Commit**

```bash
git add README.md src/features/reader/ReaderLayout.test.tsx 'src/app/(reader)/ReaderApp.test.tsx'
git commit -m "test/docs: finalize settings center regression coverage and readme"
```

---

## Risks and Guardrails

1. `src/components/*` 存在历史同名组件，避免误改；本计划只触达 `src/features/*` 路径。
2. Zustand persist 迁移必须兼容旧 `feedfuse-settings` 数据，避免用户已有主题配置丢失。
3. 快捷键可配置后，需保证输入框聚焦场景仍不拦截键盘事件。
4. `apiKey` 不能通过任何路径进入 `localStorage`（包括 debug dump、序列化副本）。

## Final Verification Checklist

- `pnpm run lint` PASS
- `pnpm run test:unit` PASS
- 手动 smoke:
  - 打开设置中心 -> 修改 appearance -> 保存后阅读区样式生效
  - AI `apiKey` 输入后刷新页面丢失（符合 sessionOnly）
  - 快捷键冲突时无法保存并显示错误
  - RSS 源可新增/编辑/删除/启停

# Unified User Notification Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 为 FeedFuse 增加统一前端提醒能力，在第一阶段覆盖显式用户操作（新增/编辑/删除/保存等），实现成功与失败反馈一致化，并最小化分散的行内结果提示。  
**Architecture:** 采用 UI 层集中触发模型：`NotificationProvider` 负责队列与展示，业务组件通过 `useNotify()` 统一发出 success/error/info。错误文案通过 `mapApiErrorToUserMessage` 集中映射，避免散落在各组件。  
**Tech Stack:** React 19, Next.js 16, Zustand, TypeScript, Tailwind CSS v4, Vitest, Testing Library

---

## 输入采集记录（按 workflow-writing-plans 顺序）

### Step 1: Prior Art 扫描

**检索命令（已执行）**

- `ls -la /Users/bryanhu/Develop/feedfuse/docs/solutions`
- `ls -la ~/.agents/docs/solutions`
- `rg -n "通知|提醒|toast|notification|错误提示|操作失败|保存失败" /Users/bryanhu/Develop/feedfuse/docs/plans`

**结果**

- 项目与全局均无 `docs/solutions` 索引库可复用。
- 可直接复用的设计输入：
  - `/Users/bryanhu/Develop/feedfuse/docs/plans/2026-02-28-unified-user-notification-design.md`
  - `/Users/bryanhu/Develop/feedfuse/docs/plans/2026-02-25-rss-validation-reminder-design.md`（“不新增全局提示”是历史约束，当前需求已明确覆盖）

**风险/陷阱（纳入实现计划）**

1. 历史“去重提醒”设计与当前“新增统一提醒”可能被误解为冲突，需要在 PR 说明“阶段性范围变化”。
2. 没有 `docs/solutions` 可复用，验证与回归策略必须在本计划中写全。
3. 组件内已有局部 `aria-live` 状态，若粗暴替换可能破坏可访问性。
4. 若全局拦截 API 错误，容易误报后台轮询请求，不符合第一阶段边界。

### Step 2: 代码入口与调用链

**检索命令（已执行）**

- `mcp__fast-context__fast_context_search`（query: 统一提醒入口与调用链）
- `rg -n "addFeed:|updateFeed:|removeFeed:|markAsRead:|markAllAsRead:|toggleStar:" src/store/appStore.ts`
- `rg -n "onSubmit|handleSubmit|setError\(|createCategory|patchCategory|deleteCategory|autosave|saveDraft" ...`

**关键入口文件**

- Provider 挂载入口：`/Users/bryanhu/Develop/feedfuse/src/app/(reader)/ReaderApp.tsx`
- Feed 显式操作：
  - `/Users/bryanhu/Develop/feedfuse/src/features/feeds/AddFeedDialog.tsx`
  - `/Users/bryanhu/Develop/feedfuse/src/features/feeds/EditFeedDialog.tsx`
  - `/Users/bryanhu/Develop/feedfuse/src/features/feeds/FeedList.tsx`
  - `/Users/bryanhu/Develop/feedfuse/src/store/appStore.ts`
- Settings 显式操作：
  - `/Users/bryanhu/Develop/feedfuse/src/features/settings/panels/CategoriesSettingsPanel.tsx`
  - `/Users/bryanhu/Develop/feedfuse/src/features/settings/SettingsCenterDrawer.tsx`
  - `/Users/bryanhu/Develop/feedfuse/src/features/settings/useSettingsAutosave.ts`
  - `/Users/bryanhu/Develop/feedfuse/src/store/settingsStore.ts`

**风险/陷阱（纳入实现计划）**

1. `addFeed` 当前是 fire-and-forget（`void(async ()=>...)`），UI 无法可靠判断成功/失败并发提醒。
2. `FeedList` 中启停/删除缺少统一错误处理，失败可能静默。
3. `EditFeedDialog` 与 `CategoriesSettingsPanel` 已有行内错误，迁移时需保留字段校验但减少结果型错误重复。
4. `Settings` 自动保存触发频繁，success 提醒需要节流，error 提醒需要去重。
5. Reader 视图树较深，Provider 必须放在 `(reader)` 根节点，避免 Hook 在未包裹上下文中调用。

### Step 3: 现有测试/验证命令

**检索命令（已执行）**

- `rg --files src | rg "test\\.tsx$|test\\.ts$" | rg "AddFeedDialog|FeedList|CategoriesSettingsPanel|ReaderApp|appStore|settingsStore|useSettingsAutosave"`
- `cat /Users/bryanhu/Develop/feedfuse/package.json`

**现有测试文件**

- `/Users/bryanhu/Develop/feedfuse/src/features/feeds/AddFeedDialog.test.tsx`
- `/Users/bryanhu/Develop/feedfuse/src/features/feeds/FeedList.test.tsx`
- `/Users/bryanhu/Develop/feedfuse/src/features/settings/panels/CategoriesSettingsPanel.test.tsx`
- `/Users/bryanhu/Develop/feedfuse/src/features/settings/useSettingsAutosave.test.ts`
- `/Users/bryanhu/Develop/feedfuse/src/app/(reader)/ReaderApp.test.tsx`
- `/Users/bryanhu/Develop/feedfuse/src/store/appStore.test.ts`
- `/Users/bryanhu/Develop/feedfuse/src/store/settingsStore.test.ts`

**可用验证命令**

- 全量单测：`pnpm run test:unit`
- 指定文件：`pnpm run test:unit -- src/features/feeds/FeedList.test.tsx`
- Lint：`pnpm run lint`

**风险/陷阱（纳入实现计划）**

1. 现有组件测试多为 `ReaderLayout` 集成测试，新增通知 DOM 后需防止脆弱断言。
2. 若只改实现不补 store 测试，`addFeed` Promise 化可能引入行为回归。
3. fake timers 与通知自动消失计时容易造成测试不稳定，需要统一用 `vi.useFakeTimers()`。
4. `pnpm run test:unit` 成本较高，任务内应先跑最小文件集，再做全量回归。

## 实现任务

### Task 1: 建立通知域模型与错误映射基础

**Files:**

- Create: `/Users/bryanhu/Develop/feedfuse/src/features/notifications/mapApiErrorToUserMessage.ts`
- Create: `/Users/bryanhu/Develop/feedfuse/src/features/notifications/types.ts`
- Test: `/Users/bryanhu/Develop/feedfuse/src/features/notifications/mapApiErrorToUserMessage.test.ts`

**Step 1: 写失败测试（错误映射）**

```ts
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/apiClient';
import { mapApiErrorToUserMessage } from './mapApiErrorToUserMessage';

describe('mapApiErrorToUserMessage', () => {
  it('maps ApiError conflict to friendly message', () => {
    const err = new ApiError('conflict', 'conflict');
    expect(mapApiErrorToUserMessage(err, 'rename-category')).toContain('已存在');
  });

  it('falls back to generic message for unknown error', () => {
    expect(mapApiErrorToUserMessage(new Error('boom'), 'save')).toBe('操作失败，请稍后重试。');
  });
});
```

**Step 2: 运行测试确认失败**

Run: `pnpm run test:unit -- src/features/notifications/mapApiErrorToUserMessage.test.ts`  
Expected: FAIL，提示模块或导出不存在。

**Step 3: 最小实现映射函数与类型**

```ts
import { ApiError } from '../../lib/apiClient';

export function mapApiErrorToUserMessage(err: unknown, action: string): string {
  if (err instanceof ApiError) {
    if (err.code === 'conflict') return '操作失败：数据已存在。';
    if (err.code === 'validation_error') return '操作失败：输入不合法。';
    if (err.code === 'not_found') return '操作失败：目标不存在。';
    return err.message?.trim() ? `操作失败：${err.message}` : '操作失败，请稍后重试。';
  }
  return '操作失败，请稍后重试。';
}
```

**Step 4: 运行测试确认通过**

Run: `pnpm run test:unit -- src/features/notifications/mapApiErrorToUserMessage.test.ts`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/features/notifications/mapApiErrorToUserMessage.ts \
  src/features/notifications/types.ts \
  src/features/notifications/mapApiErrorToUserMessage.test.ts
git commit -m "feat(notify): 新增错误文案映射基础能力"
```

### Task 2: 实现 NotificationProvider + useNotify + 视图层

**Files:**

- Create: `/Users/bryanhu/Develop/feedfuse/src/features/notifications/NotificationProvider.tsx`
- Create: `/Users/bryanhu/Develop/feedfuse/src/features/notifications/useNotify.ts`
- Create: `/Users/bryanhu/Develop/feedfuse/src/features/notifications/NotificationViewport.tsx`
- Create: `/Users/bryanhu/Develop/feedfuse/src/features/notifications/NotificationProvider.test.tsx`

**Step 1: 写失败测试（队列/去重/自动消失/上限）**

```tsx
it('dedupes same message within 1.5s and auto-dismisses by type TTL', async () => {
  // render provider + probe component calling notify.success twice
  // assert only one item rendered
  // advance timers and assert item removed
});

it('keeps max 3 notifications and prioritizes error retention', () => {
  // push 4 messages and assert oldest success/info removed first
});
```

**Step 2: 运行测试确认失败**

Run: `pnpm run test:unit -- src/features/notifications/NotificationProvider.test.tsx`  
Expected: FAIL，Provider/Hook 未实现。

**Step 3: 最小实现 Provider 与 Hook**

```tsx
type NotifyApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: string) => void;
};

const TTL = { success: 1800, info: 2500, error: 4500 } as const;
const DEDUPE_WINDOW_MS = 1500;
const MAX_STACK = 3;
```

要点：

- Provider 内部维护 `notifications` 状态与过期定时器。
- 同 `type + message` 在 dedupe window 内忽略。
- 超过上限时优先移除最旧非 error 消息。
- `NotificationViewport` 负责 fixed 定位与样式。
- 支持 `prefers-reduced-motion` 的无动画降级类名。

**Step 4: 运行测试确认通过**

Run: `pnpm run test:unit -- src/features/notifications/NotificationProvider.test.tsx`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/features/notifications/NotificationProvider.tsx \
  src/features/notifications/useNotify.ts \
  src/features/notifications/NotificationViewport.tsx \
  src/features/notifications/NotificationProvider.test.tsx
git commit -m "feat(notify): 新增全局通知Provider与视图层"
```

### Task 3: 在 Reader 根节点挂载通知能力

**Files:**

- Modify: `/Users/bryanhu/Develop/feedfuse/src/app/(reader)/ReaderApp.tsx`
- Modify: `/Users/bryanhu/Develop/feedfuse/src/app/(reader)/ReaderApp.test.tsx`

**Step 1: 写失败测试（渲染通知容器）**

```tsx
it('renders notification viewport under reader app', async () => {
  render(<ReaderApp />);
  expect(screen.getByTestId('notification-viewport')).toBeInTheDocument();
});
```

**Step 2: 运行测试确认失败**

Run: `pnpm run test:unit -- src/app/'(reader)'/ReaderApp.test.tsx`  
Expected: FAIL，找不到通知容器。

**Step 3: 最小实现挂载**

```tsx
return (
  <NotificationProvider>
    <ReaderLayout />
  </NotificationProvider>
);
```

**Step 4: 运行测试确认通过**

Run: `pnpm run test:unit -- src/app/'(reader)'/ReaderApp.test.tsx`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/app/'(reader)'/ReaderApp.tsx src/app/'(reader)'/ReaderApp.test.tsx
git commit -m "feat(notify): 在Reader根节点挂载全局提醒"
```

### Task 4: 接入 Feed 新增流程（AddFeedDialog + appStore.addFeed Promise 化）

**Files:**

- Modify: `/Users/bryanhu/Develop/feedfuse/src/store/appStore.ts`
- Modify: `/Users/bryanhu/Develop/feedfuse/src/features/feeds/AddFeedDialog.tsx`
- Modify: `/Users/bryanhu/Develop/feedfuse/src/features/feeds/FeedList.tsx`
- Modify: `/Users/bryanhu/Develop/feedfuse/src/features/feeds/AddFeedDialog.test.tsx`
- Modify: `/Users/bryanhu/Develop/feedfuse/src/store/appStore.test.ts`

**Step 1: 写失败测试（新增成功/失败提醒 + addFeed 返回 Promise）**

```ts
it('addFeed rejects when createFeed fails', async () => {
  await expect(useAppStore.getState().addFeed(payload)).rejects.toThrow();
});
```

```tsx
it('shows success notification after add feed success', async () => {
  // submit dialog
  // expect "已添加订阅源" visible in notification viewport
});
```

**Step 2: 运行测试确认失败**

Run: `pnpm run test:unit -- src/store/appStore.test.ts src/features/feeds/AddFeedDialog.test.tsx`  
Expected: FAIL（`addFeed` 非 Promise / 提醒不存在）。

**Step 3: 最小实现**

```ts
// appStore.ts
addFeed: async (payload) => {
  const created = await createFeed(payload); // create 失败直接抛出
  // 先完成 store 更新
  // refresh/poll 包在内部 try/catch，不影响“新增成功”语义
}
```

```tsx
// AddFeedDialog.tsx
const notify = useNotify();
try {
  await onSubmit(...);
  notify.success('已添加订阅源');
  onOpenChange(false);
} catch (err) {
  notify.error(mapApiErrorToUserMessage(err, 'create-feed'));
}
```

**Step 4: 运行测试确认通过**

Run: `pnpm run test:unit -- src/store/appStore.test.ts src/features/feeds/AddFeedDialog.test.tsx`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/store/appStore.ts src/store/appStore.test.ts \
  src/features/feeds/AddFeedDialog.tsx src/features/feeds/FeedList.tsx \
  src/features/feeds/AddFeedDialog.test.tsx
git commit -m "feat(notify): 接入新增订阅源统一提醒"
```

### Task 5: 接入 Feed 编辑/启停/删除流程提醒并收敛行内结果提示

**Files:**

- Modify: `/Users/bryanhu/Develop/feedfuse/src/features/feeds/EditFeedDialog.tsx`
- Modify: `/Users/bryanhu/Develop/feedfuse/src/features/feeds/FeedList.tsx`
- Modify: `/Users/bryanhu/Develop/feedfuse/src/features/feeds/FeedList.test.tsx`

**Step 1: 写失败测试（编辑/启停/删除 success & error）**

```tsx
it('shows success notification after editing feed', async () => {
  // open edit dialog -> save
  // expect success toast
});

it('shows error notification when toggle enabled fails', async () => {
  // mock PATCH fail
  // expect error toast
});
```

**Step 2: 运行测试确认失败**

Run: `pnpm run test:unit -- src/features/feeds/FeedList.test.tsx`  
Expected: FAIL（未触发统一提醒）。

**Step 3: 最小实现**

要点：

- `EditFeedDialog` 使用 `useNotify()`，提交成功 `notify.success('保存成功')`，失败 `notify.error(...)`。
- 移除 `EditFeedDialog` 的结果型行内错误文案（字段校验保留）。
- `FeedList` 中启停/删除改为 `try/catch` 并统一提醒：
  - 启用/停用成功：`已启用订阅源` / `已停用订阅源`
  - 删除成功：`已删除订阅源`
  - 失败统一映射后提示。

**Step 4: 运行测试确认通过**

Run: `pnpm run test:unit -- src/features/feeds/FeedList.test.tsx`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/features/feeds/EditFeedDialog.tsx \
  src/features/feeds/FeedList.tsx \
  src/features/feeds/FeedList.test.tsx
git commit -m "refactor(notify): 统一订阅源管理操作反馈"
```

### Task 6: 接入分类管理与设置自动保存提醒

**Files:**

- Modify: `/Users/bryanhu/Develop/feedfuse/src/features/settings/panels/CategoriesSettingsPanel.tsx`
- Modify: `/Users/bryanhu/Develop/feedfuse/src/features/settings/panels/CategoriesSettingsPanel.test.tsx`
- Modify: `/Users/bryanhu/Develop/feedfuse/src/features/settings/SettingsCenterDrawer.tsx`
- Modify: `/Users/bryanhu/Develop/feedfuse/src/features/settings/useSettingsAutosave.test.ts`

**Step 1: 写失败测试（分类操作通知 + autosave 状态通知）**

```tsx
it('shows success notification after creating category', async () => {
  // create category
  // expect success message in viewport
});
```

```ts
it('emits error status when saveDraft returns { ok: false }', async () => {
  // existing hook test extended for error branch
});
```

**Step 2: 运行测试确认失败**

Run: `pnpm run test:unit -- src/features/settings/panels/CategoriesSettingsPanel.test.tsx src/features/settings/useSettingsAutosave.test.ts`  
Expected: FAIL（无统一提醒或状态分支覆盖不足）。

**Step 3: 最小实现**

要点：

- `CategoriesSettingsPanel` 在 create/rename/delete 成功后提示 success，失败提示 error。
- 保留字段校验（如“请输入分类名称”），但去除结果型重复错误展示。
- `SettingsCenterDrawer` 监听 autosave 状态变化：
  - `error` -> `notify.error('设置自动保存失败，请检查后重试')`
  - `saved` -> 仅在节流窗口（30s）外提示一次 `notify.success('设置已自动保存')`

**Step 4: 运行测试确认通过**

Run: `pnpm run test:unit -- src/features/settings/panels/CategoriesSettingsPanel.test.tsx src/features/settings/useSettingsAutosave.test.ts`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/features/settings/panels/CategoriesSettingsPanel.tsx \
  src/features/settings/panels/CategoriesSettingsPanel.test.tsx \
  src/features/settings/SettingsCenterDrawer.tsx \
  src/features/settings/useSettingsAutosave.test.ts
git commit -m "feat(notify): 接入分类与设置自动保存提醒"
```

### Task 7: 全量回归与文档同步

**Files:**

- Modify: `/Users/bryanhu/Develop/feedfuse/docs/plans/2026-02-28-unified-user-notification-design.md`（如有必要，仅补充“实现偏差与阶段结论”）

**Step 1: 运行关键测试集**

Run:

```bash
pnpm run test:unit -- \
  src/features/notifications/mapApiErrorToUserMessage.test.ts \
  src/features/notifications/NotificationProvider.test.tsx \
  src/features/feeds/AddFeedDialog.test.tsx \
  src/features/feeds/FeedList.test.tsx \
  src/features/settings/panels/CategoriesSettingsPanel.test.tsx \
  src/features/settings/useSettingsAutosave.test.ts \
  src/store/appStore.test.ts \
  src/app/'(reader)'/ReaderApp.test.tsx
```

Expected: PASS。

**Step 2: 运行全量单测与 lint**

Run:

```bash
pnpm run test:unit
pnpm run lint
```

Expected: 全部通过，无新增 lint error。

**Step 3: 汇总验证证据**

- 在 PR 描述中贴出关键命令与结果摘要（通过/耗时/失败重试原因）。

**Step 4: Commit（若有文档修订）**

```bash
git add docs/plans/2026-02-28-unified-user-notification-design.md
git commit -m "docs(notify): 补充统一提醒实现约束说明"
```

## 实施注意事项（强约束）

1. 第一阶段禁止接入 `markAsRead` / `toggleStar` / `markAllAsRead` 的提醒。
2. 不在 `apiClient` 全局自动弹错，避免后台轮询噪音。
3. 字段级校验保留，结果型行内错误优先迁移到统一提醒。
4. 所有提醒文案保持中文短句，避免技术细节直接暴露给用户。
5. 每个任务严格执行 TDD：先失败测试，再最小实现，再通过测试，再提交。

## 验收清单

- 显式操作路径（新增/编辑/启停/删除/分类管理/自动保存异常）都有统一提醒。
- 成功提醒轻量且快速消失，失败提醒停留更久且信息清晰。
- Provider 在 reader 根节点统一挂载，所有目标组件可直接使用 `useNotify()`。
- 组件内重复结果提示减少，字段校验不回退。
- 关键测试与全量验证命令可复现通过。


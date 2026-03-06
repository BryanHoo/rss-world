# 右键菜单主题同步轻量卡片化 Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 让 `FeedList` 中的分类右键菜单和 RSS 源右键菜单都切换到跟随浅/深主题的轻量卡片风格，并收敛菜单宽度。

**Architecture:** 主要改动集中在共享 `src/components/ui/context-menu.tsx`，将当前固定深色玻璃风格替换为 theme-aware card 视觉系统。业务层 `src/features/feeds/FeedList.tsx` 只负责菜单分组与局部宽度收敛，测试继续依赖 `src/features/feeds/FeedList.test.tsx` 回归关键交互。

**Tech Stack:** React 19, Next.js 16, Tailwind CSS v4, Radix Context Menu, Vitest, Testing Library

---

## Relevant Prior Knowledge

- `docs/summaries/2026-03-06-rss-feed-context-menu-redesign.md`
  - 已明确共享 `context-menu` 应继续承担视觉与结构能力，不要把样式逻辑回退到业务层。
- `docs/summaries/2026-03-06-rss-feed-context-menu-move-category.md`
  - `移动到分类` 子菜单已有稳定行为与禁用态语义，本次不可破坏。

### Task 1: 为共享菜单主题同步样式补最小回归

**Files:**

- Modify: `src/features/feeds/FeedList.test.tsx`

**Step 1: Write the failing test**

在 `src/features/feeds/FeedList.test.tsx` 新增一个轻量断言，验证打开 RSS 源右键菜单后，菜单容器使用主题化共享类，而不是业务层硬编码宽面板。优先断言：

```tsx
it('renders feed context menu with shared compact surface classes', async () => {
  renderWithNotifications();

  fireEvent.contextMenu(screen.getByRole('button', { name: /My Feed.*2/ }));

  const editItem = await screen.findByRole('menuitem', { name: '编辑' });
  const menu = editItem.closest('[data-radix-menu-content]');

  expect(menu).toHaveClass('bg-popover');
  expect(menu).not.toHaveClass('w-64');
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run src/features/feeds/FeedList.test.tsx -t "shared compact surface classes"
```

Expected: FAIL，因为当前菜单仍使用固定深色玻璃类，且 RSS 源菜单显式传入 `w-64`。

**Step 3: Write minimal implementation**

此任务不写生产逻辑，只确认新断言能卡住此次视觉回归目标。

**Step 4: Run test to verify it fails as expected**

Run:

```bash
pnpm exec vitest run src/features/feeds/FeedList.test.tsx -t "shared compact surface classes"
```

Expected: FAIL，失败原因明确落在菜单 surface class 和宽度上。

**Step 5: Commit**

```bash
git add src/features/feeds/FeedList.test.tsx
git commit -m "test(feeds): 约束右键菜单主题卡片样式"
```

### Task 2: 重构共享 `ContextMenu` 为主题同步轻量卡片

**Files:**

- Modify: `src/components/ui/context-menu.tsx`
- Test: `src/features/feeds/FeedList.test.tsx`

**Step 1: Write the failing test**

复用 Task 1 的失败测试，不新增第二个样式专用测试。

**Step 2: Run targeted baseline before implementation**

Run:

```bash
pnpm exec vitest run src/features/feeds/FeedList.test.tsx -t "shared compact surface classes|opens context menu and edits title"
```

Expected: `shared compact surface classes` FAIL，其它已有交互断言保持 PASS。

**Step 3: Write minimal implementation**

在 `src/components/ui/context-menu.tsx`：

1. 将 `contextMenuPanelClassName` 改为基于 `bg-popover text-popover-foreground border-border` 的主题同步卡片样式。
2. 弱化阴影与 blur，让浅色主题更像轻量卡片、深色主题更像紧凑浮层。
3. 收敛默认 `min-w`、圆角和内边距。
4. 调整 `ContextMenuItem` / `ContextMenuSubTrigger` 的 hover、focus、disabled、destructive 状态，使其基于 `accent` 与主题 token。
5. 调整 `ContextMenuSeparator` 为更轻的分隔样式。

**Step 4: Run targeted tests**

Run:

```bash
pnpm exec vitest run src/features/feeds/FeedList.test.tsx -t "shared compact surface classes|opens context menu and edits title|marks the current category inside move-to-category submenu"
```

Expected: PASS。

**Step 5: Commit**

```bash
git add src/components/ui/context-menu.tsx src/features/feeds/FeedList.test.tsx
git commit -m "feat(ui): 右键菜单改为主题同步轻量卡片"
```

### Task 3: 收敛 `FeedList` 两类菜单的宽度与节奏

**Files:**

- Modify: `src/features/feeds/FeedList.tsx`
- Test: `src/features/feeds/FeedList.test.tsx`

**Step 1: Write the failing test**

在 `src/features/feeds/FeedList.test.tsx` 再补一个断言，验证分类菜单和 RSS 源菜单都仍能正常打开，且 RSS 菜单不再带 `w-64`：

```tsx
it('keeps category and feed context menus accessible after width tightening', async () => {
  renderWithNotifications();

  fireEvent.contextMenu(screen.getByRole('button', { name: 'Tech' }));
  expect(await screen.findByRole('menuitem', { name: '编辑' })).toBeInTheDocument();

  fireEvent.contextMenu(screen.getByRole('button', { name: /My Feed.*2/ }));
  const deleteItem = await screen.findByRole('menuitem', { name: '删除' });
  expect(deleteItem).toBeInTheDocument();
  expect(deleteItem.closest('[data-radix-menu-content]')).not.toHaveClass('w-64');
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run src/features/feeds/FeedList.test.tsx -t "width tightening"
```

Expected: FAIL，因为当前业务层仍传入偏宽的类名。

**Step 3: Write minimal implementation**

在 `src/features/feeds/FeedList.tsx`：

1. 分类菜单与 RSS 菜单都改成更紧凑的宽度设置。
2. 子菜单宽度同步收敛，避免展开后横向过宽。
3. 保持现有菜单信息结构与事件处理不变。

**Step 4: Run targeted tests**

Run:

```bash
pnpm exec vitest run src/features/feeds/FeedList.test.tsx -t "width tightening|opens context menu and edits title|moves feed to uncategorized from context submenu"
```

Expected: PASS。

**Step 5: Commit**

```bash
git add src/features/feeds/FeedList.tsx src/features/feeds/FeedList.test.tsx
git commit -m "feat(feeds): 收敛右键菜单宽度与节奏"
```

### Task 4: 做最终验证并补总结文档

**Files:**

- Create: `docs/summaries/2026-03-06-context-menu-theme-card.md`
- Modify: `src/components/ui/context-menu.tsx`
- Modify: `src/features/feeds/FeedList.tsx`
- Modify: `src/features/feeds/FeedList.test.tsx`

**Step 1: Re-read requirements and changed files**

确认以下要求都已覆盖：

1. 菜单跟随浅/深主题。
2. 风格是轻量卡片，不再是厚重深色浮层。
3. 分类菜单和 RSS 菜单统一成同一套视觉系统。
4. 宽度明显收敛。

**Step 2: Run focused verification**

Run:

```bash
pnpm exec vitest run src/features/feeds/FeedList.test.tsx
```

Expected: PASS。

**Step 3: Run broader verification**

Run:

```bash
pnpm run lint
```

Expected: PASS。

**Step 4: Write summary doc**

按 `workflow-summary` 写入：

```markdown
# 右键菜单主题同步轻量卡片化总结

**Date:** 2026-03-06
**Status:** resolved
**Area:** `feeds` / `ui`
**Related:** `docs/plans/2026-03-06-context-menu-theme-card-design.md`, `docs/plans/2026-03-06-context-menu-theme-card-implementation-plan.md`
```

记录症状、根因、修复、验证命令与结果。

**Step 5: Commit**

```bash
git add docs/summaries/2026-03-06-context-menu-theme-card.md src/components/ui/context-menu.tsx src/features/feeds/FeedList.tsx src/features/feeds/FeedList.test.tsx
git commit -m "feat(feeds): 统一右键菜单主题卡片风格"
```

## Execution Notes

- 建议在 `@workflow-using-git-worktrees` 创建的 `.worktrees/context-menu-theme-card` 中执行。
- 实施时参考 `@workflow-test-driven-development`，先看红，再写最小实现。
- 完成前必须执行 `@workflow-verification-before-completion`，不得只凭代码直觉宣称完成。

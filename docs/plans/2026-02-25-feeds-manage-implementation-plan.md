# FeedList 订阅源右键管理（编辑/启停/删除） Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 在左侧订阅源列表 `FeedList` 为每条订阅源提供“右键菜单”入口，实现编辑（`title/categoryId/enabled`）、启停、删除（含二次确认）并正确处理视图回退。

**Architecture:** 在 UI 层引入 shadcn/ui `ContextMenu`（Radix）承载右键菜单；“编辑”使用 `Dialog`，删除使用 `AlertDialog`。数据层补齐 `apiClient.patchFeed/deleteFeed` 与 `useAppStore.updateFeed/removeFeed`，在本地 state 做最小差量更新（保留 `unreadCount`），删除时同步移除关联 articles 并在必要时回退 `selectedView`。

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zustand, shadcn/ui（copied components）+ Radix primitives, TailwindCSS v4, Vitest + Testing Library, pnpm.

---

## Inputs（先读这些再动手）

- 设计文档：`docs/plans/2026-02-25-feeds-manage-design.md`
- 现有订阅源 UI：
  - `src/features/feeds/FeedList.tsx`
  - `src/features/feeds/AddFeedDialog.tsx`（Dialog/表单模式参考）
- 现有后端接口（注意 zsh 里 `[]` 需要引号）：`src/app/api/feeds/route.ts`、`src/app/api/feeds/[id]/route.ts`
- 数据层与 store：
  - `src/lib/apiClient.ts`
  - `src/store/appStore.ts`
  - `src/types/index.ts`
- 验证命令：
  - 单测：`pnpm run test:unit`
  - Lint：`pnpm run lint`
  - 构建：`pnpm run build`

## Key Risks / Pitfalls（实现时别踩）

1) **`PATCH /api/feeds/:id` 不返回 `unreadCount`**：前端差量更新时必须保留原有 `unreadCount`（否则 UI 未读数会抖动/归零）。
2) **删除会级联删除文章**（DB `articles.feed_id ... on delete cascade`）：UI 删除成功后要同步从 `articles` 中过滤该 feed 的文章，避免阅读面板残留。
3) **当前选中 feed 被删的回退**：若 `selectedView === feedId`，必须回到 `all` 并清理 `selectedArticleId`（否则右栏显示“空/错”的文章）。
4) **ContextMenu 在测试里是 portal 渲染**：断言时用 `screen.getByRole('menuitem', ...)` / `screen.getByText(...)`，避免依赖 class；打开用 `fireEvent.contextMenu(...)`。
5) **不要引入额外 UI 依赖**（如 `Switch`）除非必要：本需求用现有 `Select/Button` 即可完成 `enabled` 编辑。

---

## Phase 0：准备工作（隔离变更 + 建立基线）

### Task 1: 在独立 worktree/分支上执行（推荐）

**Files:** 无

**Step 1: 创建 worktree**

Run:

```bash
git fetch
git worktree add -b codex/feeds-manage-context-menu ../feedfuse-feeds-manage-context-menu
```

Expected: 生成新目录 `../feedfuse-feeds-manage-context-menu`，后续步骤在该目录执行。

**Step 2: 基线验证（改动前先全绿）**

Run:

```bash
pnpm run lint
pnpm run test:unit
pnpm run build
```

Expected: 全部 PASS。

---

## Phase 1：补齐数据模型（Feed.enabled）与 API Client（patch/delete）

### Task 2: 给 `Feed` 增加 `enabled` 字段并在 `mapFeedDto` 注入

**Files:**

- Modify: `src/types/index.ts`
- Modify: `src/lib/apiClient.ts`

**Step 1: 修改 `Feed` 类型**

在 `src/types/index.ts`：

```ts
export interface Feed {
  id: string;
  title: string;
  url: string;
  icon?: string;
  unreadCount: number;
  enabled: boolean;
  categoryId?: string | null;
  category?: string | null;
}
```

**Step 2: 修改 `mapFeedDto`**

在 `src/lib/apiClient.ts` 的 `mapFeedDto(...)` 返回对象中补齐：

```ts
enabled: dto.enabled,
```

**Step 3: 运行验证**

Run:

```bash
pnpm run lint
pnpm run test:unit
```

Expected: PASS。

**Step 4: Commit**

```bash
git add src/types/index.ts src/lib/apiClient.ts
git commit -m "refactor(types): Feed 增加 enabled 字段"
```

---

### Task 3: 在 `apiClient` 增加 `patchFeed` / `deleteFeed`

**Files:**

- Modify: `src/lib/apiClient.ts`

**Step 1: 新增 DTO 类型（仅用于 PATCH 返回）**

在 `src/lib/apiClient.ts` 合适位置新增：

```ts
export interface FeedRowDto {
  id: string;
  title: string;
  url: string;
  siteUrl: string | null;
  iconUrl: string | null;
  enabled: boolean;
  categoryId: string | null;
  fetchIntervalMinutes: number;
}
```

**Step 2: 新增 `patchFeed`**

```ts
export async function patchFeed(
  feedId: string,
  input: { title?: string; enabled?: boolean; categoryId?: string | null },
): Promise<FeedRowDto> {
  return requestApi(`/api/feeds/${encodeURIComponent(feedId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}
```

**Step 3: 新增 `deleteFeed`**

```ts
export async function deleteFeed(feedId: string): Promise<{ deleted: true }> {
  return requestApi(`/api/feeds/${encodeURIComponent(feedId)}`, {
    method: 'DELETE',
  });
}
```

**Step 4: 运行验证并提交**

Run:

```bash
pnpm run lint
pnpm run test:unit
```

Commit:

```bash
git add src/lib/apiClient.ts
git commit -m "feat(api): 补齐订阅源更新与删除请求"
```

---

## Phase 2：先写测试（右键菜单/编辑/启停/删除）

### Task 4: 添加 `FeedList` 管理功能单测（先红）

**Files:**

- Create: `src/features/feeds/FeedList.test.tsx`

**Step 1: 写测试（预期失败）**

创建 `src/features/feeds/FeedList.test.tsx`（示例可直接用）：

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReaderLayout from '../reader/ReaderLayout';
import { useAppStore } from '../../store/appStore';

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('FeedList manage', () => {
  beforeEach(() => {
    useAppStore.setState({
      feeds: [
        {
          id: 'feed-1',
          title: 'My Feed',
          url: 'https://example.com/rss.xml',
          unreadCount: 2,
          enabled: true,
          categoryId: null,
          category: null,
        },
      ],
      categories: [
        { id: 'cat-tech', name: '科技', expanded: true },
        { id: 'cat-uncategorized', name: '未分类', expanded: true },
      ],
      articles: [{ id: 'a-1', feedId: 'feed-1', title: 'A', content: '', summary: '', publishedAt: '', link: '', isRead: false, isStarred: false }],
      selectedView: 'feed-1',
      selectedArticleId: 'a-1',
      sidebarCollapsed: false,
      snapshotLoading: false,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';

        if (url.includes('/api/feeds/feed-1') && method === 'PATCH') {
          const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
          return jsonResponse({
            ok: true,
            data: {
              id: 'feed-1',
              title: String(body.title ?? 'My Feed'),
              url: 'https://example.com/rss.xml',
              siteUrl: null,
              iconUrl: null,
              enabled: typeof body.enabled === 'boolean' ? body.enabled : true,
              categoryId: body.categoryId ?? null,
              fetchIntervalMinutes: 30,
            },
          });
        }

        if (url.includes('/api/feeds/feed-1') && method === 'DELETE') {
          return jsonResponse({ ok: true, data: { deleted: true } });
        }

        throw new Error(`Unexpected fetch: ${method} ${url}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens context menu and edits title', async () => {
    render(<ReaderLayout />);

    fireEvent.contextMenu(screen.getByText('My Feed'));

    fireEvent.click(await screen.findByRole('menuitem', { name: '编辑…' }));
    expect(screen.getByRole('dialog', { name: '编辑 RSS 源' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('名称'), { target: { value: 'My Feed Updated' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(screen.getByText('My Feed Updated')).toBeInTheDocument();
    });
  });

  it('toggles enabled via context menu', async () => {
    render(<ReaderLayout />);

    fireEvent.contextMenu(screen.getByText('My Feed'));
    fireEvent.click(await screen.findByRole('menuitem', { name: '停用' }));

    await waitFor(() => {
      expect(useAppStore.getState().feeds[0].enabled).toBe(false);
    });
  });

  it('deletes feed and falls back selectedView to all', async () => {
    render(<ReaderLayout />);

    fireEvent.contextMenu(screen.getByText('My Feed'));
    fireEvent.click(await screen.findByRole('menuitem', { name: '删除…' }));

    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    await waitFor(() => {
      expect(screen.queryByText('My Feed')).not.toBeInTheDocument();
      expect(useAppStore.getState().selectedView).toBe('all');
      expect(useAppStore.getState().selectedArticleId).toBeNull();
    });
  });
});
```

**Step 2: 运行测试确认失败**

Run:

```bash
pnpm run test:unit -- src/features/feeds/FeedList.test.tsx
```

Expected: FAIL（因为尚未实现右键菜单/编辑弹窗/启停/删除逻辑）。

> 注意：不要提交（保持红 → 绿 → 提交的节奏）。

---

## Phase 3：实现 UI 与 store（让测试变绿）

### Task 5: 引入 shadcn/ui `ContextMenu`

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/components/ui/context-menu.tsx`

**Step 1: 安装依赖**

Run:

```bash
pnpm add @radix-ui/react-context-menu
```

**Step 2: 新增 `context-menu` 组件**

创建 `src/components/ui/context-menu.tsx`（按 shadcn 模板）：

```tsx
'use client';

import * as React from 'react';
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import { Check, ChevronRight, Circle } from 'lucide-react';

import { cn } from '@/lib/utils';

const ContextMenu = ContextMenuPrimitive.Root;

const ContextMenuTrigger = ContextMenuPrimitive.Trigger;

const ContextMenuGroup = ContextMenuPrimitive.Group;

const ContextMenuPortal = ContextMenuPrimitive.Portal;

const ContextMenuSub = ContextMenuPrimitive.Sub;

const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

const ContextMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & { inset?: boolean }
>(({ className, inset, children, ...props }, ref) => (
  <ContextMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      'flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent',
      inset && 'pl-8',
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </ContextMenuPrimitive.SubTrigger>
));
ContextMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName;

const ContextMenuSubContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
      className,
    )}
    {...props}
  />
));
ContextMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName;

const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      ref={ref}
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
));
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName;

const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      inset && 'pl-8',
      className,
    )}
    {...props}
  />
));
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName;

const ContextMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <ContextMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.CheckboxItem>
));
ContextMenuCheckboxItem.displayName = ContextMenuPrimitive.CheckboxItem.displayName;

const ContextMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.RadioItem>
));
ContextMenuRadioItem.displayName = ContextMenuPrimitive.RadioItem.displayName;

const ContextMenuLabel = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Label
    ref={ref}
    className={cn('px-2 py-1.5 text-sm font-semibold text-foreground', inset && 'pl-8', className)}
    {...props}
  />
));
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName;

const ContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-border', className)}
    {...props}
  />
));
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName;

const ContextMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)} {...props} />;
};
ContextMenuShortcut.displayName = 'ContextMenuShortcut';

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
};
```

**Step 3: 运行 `FeedList` 测试（应仍失败，但不再因为缺依赖挂掉）**

Run:

```bash
pnpm run test:unit -- src/features/feeds/FeedList.test.tsx
```

Expected: 仍 FAIL（UI/store 未实现）。

**Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/ui/context-menu.tsx
git commit -m "feat(ui): 添加 ContextMenu 组件"
```

---

### Task 6: 新增 `EditFeedDialog`

**Files:**

- Create: `src/features/feeds/EditFeedDialog.tsx`

**Step 1: 创建组件（参考 `AddFeedDialog`，但不做 URL 验证）**

实现要点：
- 标题：`编辑 RSS 源`
- 字段：名称（Input）、URL（只读 Input）、分类（Select）、状态（Select：启用/停用）
- 保存：调用 `onSubmit({ title, categoryId, enabled })`
- 失败：显示错误文案

建议实现（可直接用）：

```tsx
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Category, Feed } from '../../types';

interface EditFeedDialogProps {
  open: boolean;
  feed: Feed;
  categories: Category[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: { title: string; categoryId: string | null; enabled: boolean }) => Promise<void>;
}

export default function EditFeedDialog({ open, feed, categories, onOpenChange, onSubmit }: EditFeedDialogProps) {
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const uncategorizedValue = '__uncategorized__';
  const selectableCategories = useMemo(() => categories.filter((item) => item.name !== '未分类'), [categories]);

  const [title, setTitle] = useState(feed.title);
  const [categoryId, setCategoryId] = useState(() => feed.categoryId ?? uncategorizedValue);
  const [enabled, setEnabled] = useState(() => (typeof feed.enabled === 'boolean' ? feed.enabled : true));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedTitle = title.trim();
  const canSave = Boolean(trimmedTitle) && !saving;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) return;

    void (async () => {
      setSaving(true);
      setError(null);
      try {
        await onSubmit({
          title: trimmedTitle,
          categoryId: categoryId === uncategorizedValue ? null : categoryId,
          enabled,
        });
        onOpenChange(false);
      } catch {
        setError('保存失败，请稍后重试。');
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel="close-edit-feed"
        className="max-w-[34rem]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleInputRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>编辑 RSS 源</DialogTitle>
          <DialogDescription>修改名称、分类与启用状态。</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-feed-title" className="text-xs">
                名称
              </Label>
              <Input
                ref={titleInputRef}
                id="edit-feed-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="edit-feed-url" className="text-xs">
                URL
              </Label>
              <Input id="edit-feed-url" type="url" value={feed.url} readOnly />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="edit-feed-category" className="text-xs">
                分类
              </Label>
              <Select value={categoryId ?? uncategorizedValue} onValueChange={setCategoryId}>
                <SelectTrigger id="edit-feed-category" aria-label="分类">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectableCategories.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={uncategorizedValue}>未分类</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="edit-feed-enabled" className="text-xs">
                状态
              </Label>
              <Select value={enabled ? 'enabled' : 'disabled'} onValueChange={(v) => setEnabled(v === 'enabled')}>
                <SelectTrigger id="edit-feed-enabled" aria-label="状态">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">启用</SelectItem>
                  <SelectItem value="disabled">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              取消
            </Button>
            <Button type="submit" disabled={!canSave}>
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: 运行测试（预期仍失败）**

Run:

```bash
pnpm run test:unit -- src/features/feeds/FeedList.test.tsx
```

Expected: FAIL（FeedList 尚未集成）。

**Step 3: Commit**

```bash
git add src/features/feeds/EditFeedDialog.tsx
git commit -m "feat(feeds): 新增订阅源编辑弹窗"
```

---

### Task 7: 在 `useAppStore` 增加 `updateFeed/removeFeed`

**Files:**

- Modify: `src/store/appStore.ts`

**Step 1: 增加 action 签名**

在 `AppState` interface 里新增：

```ts
updateFeed: (feedId: string, patch: { title?: string; enabled?: boolean; categoryId?: string | null }) => Promise<void>;
removeFeed: (feedId: string) => Promise<void>;
```

**Step 2: 实现 `updateFeed`（差量更新 + 保留 unreadCount）**

实现要点：
- `const updated = await patchFeed(feedId, patch)`
- `set` 时更新目标 feed：`title/enabled/categoryId`，并按当前 categories 重新计算 `category`
- 保留原 `unreadCount`

**Step 3: 实现 `removeFeed`（清理 feed + 清理 articles + 视图回退）**

实现要点：
- `await deleteFeed(feedId)`
- `feeds` 过滤掉该项
- `articles` 过滤 `article.feedId === feedId`
- 若 `selectedView === feedId`：`selectedView = 'all'` 且 `selectedArticleId = null`

**Step 4: Commit**

```bash
git add src/store/appStore.ts
git commit -m "feat(store): 支持订阅源更新与删除"
```

---

### Task 8: 集成到 `FeedList`（右键菜单 + 编辑/启停/删除）

**Files:**

- Modify: `src/features/feeds/FeedList.tsx`

**Step 1: 引入 ContextMenu 与 EditFeedDialog**

```ts
import EditFeedDialog from './EditFeedDialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
```

**Step 2: 为每条 feed 包裹 ContextMenu**

实现要点：
- `ContextMenuTrigger asChild` 包裹现有 `<button ...>` 订阅源行
- 菜单项文案与测试对齐：`编辑…`、`停用/启用`、`删除…`

**Step 3: 在列表中弱化停用 feed**

例如在按钮 class 里附加：

```ts
!feed.enabled && 'opacity-60'
```

**Step 4: 连接 store action**

- `编辑…`：打开 `EditFeedDialog`，提交时 `await updateFeed(feed.id, payload)`
- `停用/启用`：`await updateFeed(feed.id, { enabled: !feed.enabled })`
- `删除…`：打开 `AlertDialog`，确认后 `await removeFeed(feed.id)`

**Step 5: 运行测试并修到全绿**

Run:

```bash
pnpm run test:unit -- src/features/feeds/FeedList.test.tsx
pnpm run test:unit
pnpm run lint
```

Expected: PASS。

**Step 6: Commit（包含 FeedList 改动 + 测试一起提交）**

```bash
git add src/features/feeds/FeedList.tsx src/features/feeds/FeedList.test.tsx src/store/appStore.ts src/lib/apiClient.ts src/types/index.ts
git commit -m "feat(feeds): 支持订阅源右键编辑启停删除"
```

---

## Phase 4：收尾与回归

### Task 9: 全量验证

Run:

```bash
pnpm run test:unit
pnpm run lint
pnpm run build
```

Expected: PASS。

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-02-25-feeds-manage-implementation-plan.md`. Two execution options:

1) Sequential (this session) - 在本会话按任务逐个执行并在关键点停下来复核  
2) Sequential (separate session) - 另开会话用 `workflow-executing-plans` 分批执行

Which approach?


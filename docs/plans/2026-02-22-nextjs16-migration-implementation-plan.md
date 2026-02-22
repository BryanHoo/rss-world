# Next.js 16 一次性迁移（保留现有 UI）Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 将 `rss-world` 从 `Vite` 一次性迁移到 `Next.js 16 App Router`，保留现有 UI 视觉与交互，不实现后端，但完成可扩展数据层抽象。  

**Architecture:** 使用 `App Router + Client Reader Shell` 承载现有三栏阅读器；通过 `ReaderDataProvider` 抽象数据来源（当前 `mockProvider`），将 UI 与数据来源解耦；升级至 Tailwind v4 并保持 class 驱动 dark mode。  

**Tech Stack:** Next.js 16, React 19.2, TypeScript 5.9, Zustand, TailwindCSS 4.2, Vitest, Testing Library.

---

## Preflight（必须先做）

1. 创建独立工作树（避免污染当前分支）：

```bash
git worktree add .worktrees/next16-migration -b feat/next16-migration
cd .worktrees/next16-migration
```

2. 安装依赖：

```bash
pnpm install
```

3. 记录基线（用于 UI 回归对照）：

- 路径：`artifacts/baseline-ui/`
- 采集三张图：侧栏、文章列表、阅读面板（浅色/深色）
- 记录关键交互：`j/k/s/m/v`、设置弹窗、未读筛选

## Prior Art Scan

- 已按 `solutions-retrieval` 流程扫描：
  - `project/docs/solutions`: 不存在
  - `~/.agents/docs/solutions`: 不存在
- 本计划不复用历史方案文档，直接按当前仓库实现。

## Scope Lock（不可偏离）

- 不做 UI 视觉重设计。
- 不改变三栏信息架构和主要交互路径。
- 后端 API / 抓取 / 同步不在本次范围。

## Task 1: 建立单元测试基线（先把测试跑起来）

**Files:**

- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/utils/date.test.ts`
- Modify: `package.json`
- Test: `src/utils/date.test.ts`

**Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime } from './date';

describe('formatRelativeTime', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('formats recent timestamps in Chinese', () => {
    vi.setSystemTime(new Date('2026-02-22T12:00:00.000Z'));
    expect(formatRelativeTime('2026-02-22T11:59:40.000Z')).toBe('刚刚');
    expect(formatRelativeTime('2026-02-22T11:50:00.000Z')).toBe('10分钟前');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit`  
Expected: FAIL，提示缺少 `test:unit` script。

**Step 3: Write minimal implementation**

- 在 `package.json` 增加：
  - `"test:unit": "vitest run"`
  - `"test:unit:watch": "vitest"`
- 安装 dev 依赖：`vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
- 新建 `vitest.config.ts` 与 `src/test/setup.ts`：

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit`  
Expected: PASS（`src/utils/date.test.ts` 通过）。

**Step 5: Commit**

```bash
git add package.json vitest.config.ts src/test/setup.ts src/utils/date.test.ts
git commit -m "test: setup vitest baseline for migration"
```

### Task 2: 建立 Next.js App Router 入口壳（保持现有 UI）

**Files:**

- Create: `next.config.mjs`
- Create: `next-env.d.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/(reader)/ReaderApp.tsx`
- Create: `src/app/(reader)/page.tsx`
- Create: `src/app/(reader)/ReaderApp.test.tsx`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `.gitignore`
- Test: `src/app/(reader)/ReaderApp.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import ReaderApp from './ReaderApp';

describe('ReaderApp', () => {
  it('renders current reader chrome', () => {
    render(<ReaderApp />);
    expect(screen.getByText('rss-world')).toBeInTheDocument();
    expect(screen.getByText('文章')).toBeInTheDocument();
    expect(screen.getByLabelText('open-settings')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit src/app/(reader)/ReaderApp.test.tsx`  
Expected: FAIL，`ReaderApp` 文件不存在。

**Step 3: Write minimal implementation**

- `package.json` scripts 切换为：
  - `"dev": "next dev"`
  - `"build": "next build"`
  - `"start": "next start"`
- 增加依赖：`next@16.1.6`
- `src/app/(reader)/ReaderApp.tsx` 使用现有 `Layout` + hooks：

```tsx
'use client';

import Layout from '../../components/Layout';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useTheme } from '../../hooks/useTheme';

export default function ReaderApp() {
  useTheme();
  useKeyboardShortcuts();
  return <Layout />;
}
```

- `src/app/(reader)/page.tsx`：

```tsx
import ReaderApp from './ReaderApp';

export default function ReaderPage() {
  return <ReaderApp />;
}
```

- `src/app/layout.tsx` 导入 `globals.css` 并设置基础 metadata。
- `tsconfig.json` 合并为 Next 形态（移除 `references`，加入 `next` plugin 与 `next-env.d.ts` include）。

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm run test:unit src/app/\(reader\)/ReaderApp.test.tsx
pnpm run build
```

Expected: PASS；`next build` 成功。

**Step 5: Commit**

```bash
git add next.config.mjs next-env.d.ts src/app tsconfig.json package.json .gitignore
git commit -m "feat: bootstrap nextjs app router reader shell"
```

### Task 3: 引入 ReaderDataProvider 抽象（为未来后端留口）

**Files:**

- Create: `src/data/provider/readerDataProvider.ts`
- Create: `src/data/mock/mockProvider.ts`
- Create: `src/data/provider/readerDataProvider.test.ts`
- Test: `src/data/provider/readerDataProvider.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { createMockProvider } from '../mock/mockProvider';

describe('ReaderDataProvider', () => {
  it('returns mutable snapshot and supports markAsRead', () => {
    const provider = createMockProvider();
    const first = provider.getSnapshot().articles[0];
    expect(first.isRead).toBe(false);

    provider.markAsRead(first.id);

    const updated = provider.getSnapshot().articles.find((a) => a.id === first.id);
    expect(updated?.isRead).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit src/data/provider/readerDataProvider.test.ts`  
Expected: FAIL，provider 模块不存在。

**Step 3: Write minimal implementation**

- 定义 provider 接口：

```ts
export interface ReaderSnapshot {
  feeds: Feed[];
  folders: Folder[];
  articles: Article[];
}

export interface ReaderDataProvider {
  getSnapshot(): ReaderSnapshot;
  markAsRead(articleId: string): ReaderSnapshot;
  markAllAsRead(feedId?: string): ReaderSnapshot;
  toggleStar(articleId: string): ReaderSnapshot;
  addFeed(feed: Feed): ReaderSnapshot;
  toggleFolder(folderId: string): ReaderSnapshot;
}
```

- `createMockProvider()` 内部持有可变 state，每次 mutation 返回深拷贝 snapshot。

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit src/data/provider/readerDataProvider.test.ts`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/data/provider/readerDataProvider.ts src/data/mock/mockProvider.ts src/data/provider/readerDataProvider.test.ts
git commit -m "feat: add reader data provider abstraction with mock provider"
```

### Task 4: 将 appStore 改为 provider 驱动（行为不变）

**Files:**

- Modify: `src/store/appStore.ts`
- Create: `src/store/appStore.test.ts`
- Modify: `src/hooks/useKeyboardShortcuts.ts`
- Test: `src/store/appStore.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { useAppStore } from './appStore';

describe('appStore provider integration', () => {
  it('marks article as read via store action', () => {
    const firstId = useAppStore.getState().articles[0].id;
    useAppStore.getState().markAsRead(firstId);

    const updated = useAppStore.getState().articles.find((a) => a.id === firstId);
    expect(updated?.isRead).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit src/store/appStore.test.ts`  
Expected: FAIL（store 初始和 mutation 未通过 provider 统一驱动）。

**Step 3: Write minimal implementation**

- 在 `appStore` 中注入 provider：

```ts
import { createMockProvider } from '../data/mock/mockProvider';

const provider = createMockProvider();
const initial = provider.getSnapshot();
```

- `markAsRead / markAllAsRead / toggleStar / addFeed / toggleFolder` 均通过 provider mutation 后 `set(snapshot)`。
- `useKeyboardShortcuts` 保持快捷键行为，不新增/删除按键映射。

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm run test:unit src/store/appStore.test.ts
pnpm run test:unit src/app/\(reader\)/ReaderApp.test.tsx
```

Expected: PASS。

**Step 5: Commit**

```bash
git add src/store/appStore.ts src/store/appStore.test.ts src/hooks/useKeyboardShortcuts.ts
git commit -m "refactor: drive app store mutations through data provider"
```

### Task 5: 升级 Tailwind v4 并锁定 class-based dark mode

**Files:**

- Modify: `package.json`
- Modify: `postcss.config.js` -> `postcss.config.mjs`
- Modify: `src/app/globals.css`
- Create: `src/app/globals-css.contract.test.ts`
- Modify: `src/hooks/useTheme.ts`
- Test: `src/app/globals-css.contract.test.ts`

**Step 1: Write the failing test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('globals.css contract', () => {
  it('uses tailwind v4 import and class-based dark variant', () => {
    const css = readFileSync('src/app/globals.css', 'utf-8');
    expect(css).toContain('@import "tailwindcss";');
    expect(css).toContain('@custom-variant dark (&:where(.dark, .dark *));');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit src/app/globals-css.contract.test.ts`  
Expected: FAIL（尚未迁移 Tailwind v4 语法）。

**Step 3: Write minimal implementation**

- 依赖迁移：
  - `tailwindcss` 升级到 `^4.2.0`
  - 增加 `@tailwindcss/postcss`
  - 移除 `autoprefixer`（v4 可省）
- `postcss.config.mjs`：

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- `src/app/globals.css`：

```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Manrope:wght@400;500;600;700&display=swap');
@import "tailwindcss";
@plugin "@tailwindcss/typography";
@custom-variant dark (&:where(.dark, .dark *));
```

- 保留 `body` 与 `.font-brand` 现有设计语义，不变更视觉方向。

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm run test:unit src/app/globals-css.contract.test.ts
pnpm run build
```

Expected: PASS。

**Step 5: Commit**

```bash
git add package.json postcss.config.mjs src/app/globals.css src/app/globals-css.contract.test.ts src/hooks/useTheme.ts
git commit -m "chore: migrate tailwind to v4 with class-based dark mode"
```

### Task 6: 按 feature 重组组件目录（UI 不变）

**Files:**

- Create: `src/features/feeds/FeedList.tsx`
- Create: `src/features/articles/ArticleList.tsx`
- Create: `src/features/articles/ArticleView.tsx`
- Create: `src/features/settings/SettingsModal.tsx`
- Create: `src/features/reader/ReaderLayout.tsx`
- Create: `src/features/reader/ReaderLayout.test.tsx`
- Modify: `src/app/(reader)/ReaderApp.tsx`
- Modify: import paths in moved files
- Test: `src/features/reader/ReaderLayout.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import ReaderLayout from './ReaderLayout';

describe('ReaderLayout', () => {
  it('keeps the existing 3-column reader interactions', () => {
    render(<ReaderLayout />);
    expect(screen.getByLabelText('add-feed')).toBeInTheDocument();
    expect(screen.getByLabelText('open-settings')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit src/features/reader/ReaderLayout.test.tsx`  
Expected: FAIL（`ReaderLayout` 不存在）。

**Step 3: Write minimal implementation**

- 将 `src/components/*` 迁到 `src/features/*`（文件内容先尽量不改，仅改 import）。
- `ReaderApp` 改为引用 `src/features/reader/ReaderLayout`。
- 保留 className、布局宽度、按钮 aria-label 与文案，防止 UI 漂移。

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm run test:unit src/features/reader/ReaderLayout.test.tsx
pnpm run test:unit
```

Expected: PASS。

**Step 5: Commit**

```bash
git add src/features src/app/\(reader\)/ReaderApp.tsx
git commit -m "refactor: reorganize reader ui into feature modules"
```

### Task 7: 清理 Vite 资产 + 自托管交付物 + 最终验证

**Files:**

- Delete: `src/main.tsx`
- Delete: `src/App.tsx`
- Delete: `src/App.css`
- Delete: `index.html`
- Delete: `vite.config.ts`
- Delete: `tsconfig.app.json`
- Delete: `tsconfig.node.json`
- Delete: `tailwind.config.js`（若已无必要）
- Modify: `README.md`
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `scripts/verify-next-migration.mjs`
- Create: `docs/deployment/self-hosted-nextjs.md`
- Test: `scripts/verify-next-migration.mjs`

**Step 1: Write the failing test**

```js
// scripts/verify-next-migration.mjs
import { existsSync } from 'node:fs';

const forbidden = [
  'vite.config.ts',
  'src/main.tsx',
  'src/App.tsx',
];

const stillThere = forbidden.filter((path) => existsSync(path));
if (stillThere.length > 0) {
  console.error('Forbidden legacy files still exist:', stillThere.join(', '));
  process.exit(1);
}

console.log('Migration structure check passed.');
```

**Step 2: Run test to verify it fails**

Run: `node scripts/verify-next-migration.mjs`  
Expected: FAIL（旧 Vite 资产仍存在）。

**Step 3: Write minimal implementation**

- 删除 Vite 入口与配置残留。
- `README.md` 更新为 Next.js 启动方式与脚本。
- 增加 Docker 运行：

```dockerfile
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app .
EXPOSE 3000
CMD ["pnpm", "start"]
```

- 新增 `docs/deployment/self-hosted-nextjs.md`，覆盖 `next start` + 反向代理要点。

**Step 4: Run test to verify it passes**

Run:

```bash
node scripts/verify-next-migration.mjs
pnpm run lint
pnpm run test:unit
pnpm run build
```

Expected: 全部 PASS。

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove vite artifacts and finalize self-hosted nextjs delivery"
```

## Final Verification Checklist（合并前）

- [ ] 三栏布局视觉对照通过（浅色/深色）
- [ ] 快捷键 `j/k/s/m/v` 与迁移前一致
- [ ] 设置项（主题/字体/字号/行高）刷新后仍恢复
- [ ] `pnpm run lint` 通过
- [ ] `pnpm run test:unit` 通过
- [ ] `pnpm run build` 通过
- [ ] `node scripts/verify-next-migration.mjs` 通过

## Risks & Guardrails

- Tailwind v4 utility 变更导致样式偏差：严格按 UI 对照清单验收。
- hydration 闪烁：主题切换逻辑保留 class 驱动 dark mode，并尽量在客户端初始化早期执行。
- 一次性迁移风险集中：必须小步提交，每个 task 一个 commit，确保可回滚。


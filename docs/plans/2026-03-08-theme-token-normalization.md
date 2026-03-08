# Theme Token Normalization Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 收敛设置中心与通知层的主题 token，消除硬编码配色，并修正浏览器主题色与应用主题不一致的问题。

**Architecture:** 以 `src/app/globals.css` 为单一主题 token 来源，补充状态语义 token，并让设置中心与通知样式改用语义化类名。通过契约测试锁定 token 使用和 `viewport.themeColor` 一致性，避免回归到硬编码调色板。

**Tech Stack:** Next.js 16、React 19、Tailwind CSS v4、shadcn/ui、Vitest、Testing Library

---

### Task 1: 为主题状态补齐 token 合约

**Files:**
- Modify: `src/app/globals.css`
- Test: `src/app/globals-css.contract.test.ts`

**Step 1: Write the failing test**
- 断言 `globals.css` 包含 `--color-success`、`--color-success-foreground`、`--color-warning`、`--color-warning-foreground`。

**Step 2: Run test to verify it fails**
- Run: `pnpm test:unit -- src/app/globals-css.contract.test.ts`

**Step 3: Write minimal implementation**
- 在 light/dark theme 中添加状态语义 token，保持命名与现有 `--color-*` 体系一致。

**Step 4: Run test to verify it passes**
- Run: `pnpm test:unit -- src/app/globals-css.contract.test.ts`

### Task 2: 归一化设置中心样式

**Files:**
- Modify: `src/features/settings/SettingsCenterDrawer.tsx`
- Test: `src/features/settings/SettingsCenterModal.test.tsx`

**Step 1: Write the failing test**
- 断言设置中心标签、状态文案和错误徽标使用语义 token class，且不再包含 `slate`、`gray`、`red-500` 等硬编码调色板。

**Step 2: Run test to verify it fails**
- Run: `pnpm test:unit -- src/features/settings/SettingsCenterModal.test.tsx`

**Step 3: Write minimal implementation**
- 将 header、sidebar、tabs、autosave 状态和错误徽标切到 `background`、`foreground`、`muted`、`border`、`primary`、`destructive`、`success`、`warning` token。

**Step 4: Run test to verify it passes**
- Run: `pnpm test:unit -- src/features/settings/SettingsCenterModal.test.tsx`

### Task 3: 归一化通知主题与浏览器主题色

**Files:**
- Modify: `src/features/notifications/NotificationViewport.tsx`
- Modify: `src/app/layout.tsx`
- Test: `src/app/layout.metadata.test.ts`

**Step 1: Write the failing test**
- 断言通知 tone class 不再依赖 `slate` 等硬编码中性色，并断言 `viewport.themeColor` 与主题背景值保持一致。

**Step 2: Run test to verify it fails**
- Run: `pnpm test:unit -- src/app/layout.metadata.test.ts`

**Step 3: Write minimal implementation**
- 将通知面板改用语义 token surface，并把 `viewport.themeColor` 更新为与深色背景一致的值。

**Step 4: Run test to verify it passes**
- Run: `pnpm test:unit -- src/app/layout.metadata.test.ts`

### Task 4: 运行针对性验证

**Files:**
- Test: `src/app/globals-css.contract.test.ts`
- Test: `src/app/layout.metadata.test.ts`
- Test: `src/features/settings/SettingsCenterModal.test.tsx`

**Step 1: Run focused tests**
- Run: `pnpm test:unit -- src/app/globals-css.contract.test.ts src/app/layout.metadata.test.ts src/features/settings/SettingsCenterModal.test.tsx`

**Step 2: Run lint on touched files if needed**
- Run: `pnpm lint`

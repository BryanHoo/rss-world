# AddFeedDialog URL 优先 + 自动填充名称 Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 新增 RSS 源时先填写 URL，失焦自动校验；校验成功后若名称为空则自动填充名称；同时移除提示文案 `URL 输入框失焦后会自动校验。`

**Architecture:** 继续复用 `AddFeedDialog` 现有的校验状态机（`validationState` + `lastVerifiedUrl` + `validationRequestIdRef`）。在 `handleValidate` 成功分支中读取 `validateRssUrl` 返回的 `title`，仅在当前名称为空时进行一次性自动填充；UI 侧将 URL 字段前置并在弹窗打开时聚焦 URL 输入框。

**Tech Stack:** Next.js / React, shadcn/ui（`Dialog`/`Input`/`Select`/`Badge`）, Vitest + Testing Library。

---

## Prior Art（可复用参考）

- 设计：`docs/plans/2026-02-28-add-feed-url-first-auto-title-design.md`
- 相关实现计划片段（单测命令与 AddFeedDialog 改法参考）：`docs/plans/2026-02-27-rss-fulltext-per-feed-implementation-plan.md`（Task 9）

## 影响范围

- Modify: `src/features/feeds/AddFeedDialog.tsx`
- Modify: `src/features/feeds/AddFeedDialog.test.tsx`
- 预期不改：`src/features/feeds/EditFeedDialog.tsx`、`src/features/feeds/services/rssValidationService.ts`

## 风险 / 坑位（务必在实现时留意）

1) **异步回包覆盖用户输入**：校验请求返回时，用户可能已手动填写“名称”。自动填充必须使用函数式 `setTitle((prev) => ...)` 并检查 `prev.trim()`，确保“仅填空，不覆盖”。
2) **竞态请求**：继续使用 `validationRequestIdRef` 丢弃过期返回；不要引入会绕过该机制的新流程。
3) **焦点测试稳定性**：`DialogContent` 有 `onOpenAutoFocus` 并 `event.preventDefault()`，单测里断言 focus 要在弹窗打开后立即获取目标 input。

---

### Task 0: 准备执行环境（建议 worktree）

**Files:** none

**Step 1: 创建分支 / worktree（可选但推荐）**

Run:

```bash
git checkout -b codex/add-feed-url-first-auto-title
```

Expected: 成功切到新分支。

---

### Task 1: 为“URL 优先 + 自动填充名称”补齐/调整单测（先写失败测试）

**Files:**

- Modify: `src/features/feeds/AddFeedDialog.test.tsx`

**Step 1: 调整 `validateRssUrl` mock（success 返回带 title）**

在 `vi.mock('./services/rssValidationService', ...)` 中把 success 分支改为：

```ts
return { ok: true, kind: 'rss' as const, title: 'Mock Feed Title' };
```

**Step 2: 新增用例：弹窗打开后自动聚焦 URL 输入框**

新增测试（示意）：

```ts
it('autofocuses url input on open', () => {
  render(<ReaderLayout />);
  fireEvent.click(screen.getByLabelText('add-feed'));
  const urlInput = screen.getByLabelText('URL');
  expect(urlInput).toHaveFocus();
});
```

Expected: 当前实现下应 FAIL（还在聚焦名称输入框）。

**Step 3: 新增用例：名称为空时校验成功会自动填充名称**

新增测试（示意）：

```ts
it('auto fills title when validation succeeds and title is empty', async () => {
  render(<ReaderLayout />);
  fireEvent.click(screen.getByLabelText('add-feed'));

  const titleInput = screen.getByLabelText('名称');
  const urlInput = screen.getByLabelText('URL');

  fireEvent.change(urlInput, { target: { value: 'https://example.com/success.xml' } });
  fireEvent.blur(urlInput);

  await waitFor(() => {
    expect(titleInput).toHaveValue('Mock Feed Title');
  });
});
```

Expected: 当前实现下应 FAIL（因为尚未实现自动填充逻辑）。

**Step 4: 新增用例：名称非空时不覆盖用户输入**

新增测试（示意）：

```ts
it('does not overwrite title when user already filled it', async () => {
  render(<ReaderLayout />);
  fireEvent.click(screen.getByLabelText('add-feed'));

  const titleInput = screen.getByLabelText('名称');
  const urlInput = screen.getByLabelText('URL');

  fireEvent.change(titleInput, { target: { value: 'Custom Title' } });
  fireEvent.change(urlInput, { target: { value: 'https://example.com/success.xml' } });
  fireEvent.blur(urlInput);

  await waitFor(() => {
    expect(screen.getByRole('button', { name: '添加' })).toBeEnabled();
  });
  expect(titleInput).toHaveValue('Custom Title');
});
```

Expected: 当前实现下应 PASS 或 FAIL（取决于后续实现是否错误覆盖），用于回归保护。

**Step 5: 运行单测，确认新增用例确实失败（红）**

Run:

```bash
pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx
```

Expected: 至少 `autofocuses url input on open` 与 `auto fills title...` 失败。

**Step 6: Commit（只提交测试变更）**

```bash
git add src/features/feeds/AddFeedDialog.test.tsx
git commit -m "🧪 tests(feeds): 新增源URL优先与名称自动填充单测"
```

---

### Task 2: 实现 AddFeedDialog：URL 前置 + 自动聚焦 + 校验成功仅填空补全名称 + 删除提示文案

**Files:**

- Modify: `src/features/feeds/AddFeedDialog.tsx`

**Step 1: URL 输入框 ref + 弹窗打开自动聚焦 URL**

将 `titleInputRef` 替换/扩展为 `urlInputRef`，并在 `DialogContent` 的 `onOpenAutoFocus` 中聚焦 URL 输入框：

```ts
const urlInputRef = useRef<HTMLInputElement | null>(null);

// ...
onOpenAutoFocus={(event) => {
  event.preventDefault();
  urlInputRef.current?.focus();
}}
```

并把 URL 的 `<Input ...>` 加上 `ref={urlInputRef}`。

**Step 2: 调整字段顺序：URL 在前、名称在后**

在表单 JSX 中将 URL 区块移动到“名称”区块之前（保持 `id`/`htmlFor` 不变）。

**Step 3: 校验成功后自动填充名称（仅当名称为空）**

在 `handleValidate` 成功分支内，在 `setValidationMessage('链接验证成功。');` 之前或之后加入：

```ts
const suggestedTitle = typeof result.title === 'string' ? result.title.trim() : '';
if (suggestedTitle) {
  setTitle((prev) => (prev.trim() ? prev : suggestedTitle));
}
```

Guardrails:

- 必须使用函数式 `setTitle((prev) => ...)`，避免异步回包覆盖用户输入。
- 不要改变 `canSave` 门禁规则（仍需 verified + lastVerifiedUrl 匹配）。

**Step 4: 删除默认提示文案**

将 URL 下方状态行的 else 分支从：

```ts
'URL 输入框失焦后会自动校验。'
```

改为不渲染任何默认文本（例如 `null`）。

**Step 5: 运行单测，确认通过（绿）**

Run:

```bash
pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx
```

Expected: PASS。

（可选）运行全量单测与 lint：

```bash
pnpm run test:unit
pnpm run lint
```

**Step 6: Commit**

```bash
git add src/features/feeds/AddFeedDialog.tsx
git commit -m "✨ feat(feeds): 新增源URL优先并校验后自动填充名称"
```

---

### Task 3: 手动验收（本地 UI smoke test）

**Files:** none

**Step 1: 本地启动**

Run:

```bash
pnpm run dev
```

**Step 2: 手动检查**

- 打开“添加 RSS 源”弹窗：焦点在 URL 输入框
- 输入一个可校验成功的 feed URL，离开输入框触发校验：
  - Badge 从“待验证”→“验证中”→“验证成功”
  - 若名称为空，名称自动填充为 feed title（如果接口返回）
- 手动输入名称后再校验：名称不被覆盖
- 不再出现提示文案 `URL 输入框失焦后会自动校验。`

---

## Done 定义

- 单测：`pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx` 通过
- UI：满足“URL 优先输入 → 校验成功自动补全名称（仅填空） → 删除提示文案”的验收标准


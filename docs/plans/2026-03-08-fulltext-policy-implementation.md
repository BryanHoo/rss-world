# 全文抓取配置与右栏手动触发 Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 为全文抓取补齐 feed 级配置入口与阅读器右栏手动触发能力，并通过 `force` 语义区分自动触发和手动触发。

**Architecture:** 复用现有 `fullTextOnOpenEnabled` 作为唯一自动规则，在 feed 菜单层新增独立 `全文抓取配置` 弹窗，在阅读器 `ArticleView` 中新增常驻 `抓取全文` 按钮。服务端继续使用 `POST /api/articles/[id]/fulltext`，但增加 `force` 请求体，使手动触发可以绕过自动开关限制，同时保留现有去重与跳过逻辑。

**Tech Stack:** React 19、TypeScript、Zustand、Next.js App Router、Vitest、Testing Library、pnpm

---

## 参考资料

- 设计文档：`docs/plans/2026-03-08-fulltext-policy-design.md`
- 历史总结：`docs/summaries/` 当前为空，未发现可复用 incident / learnings

### Task 1: 为全文接口补齐 force 语义测试

**Files:**

- Modify: `src/app/api/articles/routes.test.ts`
- Modify: `src/lib/apiClient.test.ts`

**Step 1: 写失败的路由测试，覆盖手动触发绕过自动开关**

```ts
it('POST /:id/fulltext force=true bypasses disabled flag and enqueues', async () => {
  getFeedFullTextOnOpenEnabled.mockResolvedValue(false);

  const mod = await import('./[id]/fulltext/route');
  const res = await mod.POST(
    new Request(`http://localhost/api/articles/${articleId}/fulltext`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ force: true }),
    }),
    { params: Promise.resolve({ id: articleId }) },
  );

  expect((await res.json()).data.enqueued).toBe(true);
});
```

**Step 2: 运行路由测试并确认失败**

Run: `pnpm test:unit -- src/app/api/articles/routes.test.ts --runInBand`
Expected: FAIL，表现为 `force=true` 仍返回 `enqueued=false` 或未解析请求体

**Step 3: 写失败的 `apiClient` 测试，覆盖请求体透传**

```ts
await enqueueArticleFulltext('00000000-0000-0000-0000-000000000000', { force: true });
expect(fetchMock).toHaveBeenCalledWith(
  expect.stringContaining('/api/articles/00000000-0000-0000-0000-000000000000/fulltext'),
  expect.objectContaining({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ force: true }),
  }),
);
```

**Step 4: 运行 `apiClient` 测试并确认失败**

Run: `pnpm test:unit -- src/lib/apiClient.test.ts --runInBand`
Expected: FAIL，表现为 `enqueueArticleFulltext` 不接受第二个参数或未发送 body

**Step 5: Commit**

```bash
git add src/app/api/articles/routes.test.ts src/lib/apiClient.test.ts
git commit -m "test(fulltext): 补充手动抓取 force 语义测试" -m "- 添加全文接口 force=true 绕过自动开关的失败用例
- 添加 apiClient 发送 force 请求体的失败用例"
```

### Task 2: 实现全文接口 force 语义与客户端调用

**Files:**

- Modify: `src/app/api/articles/[id]/fulltext/route.ts`
- Modify: `src/lib/apiClient.ts`
- Test: `src/app/api/articles/routes.test.ts`
- Test: `src/lib/apiClient.test.ts`

**Step 1: 在全文路由中解析 `force` 请求体**

```ts
const json = await request.json().catch(() => null);
const force = Boolean(isRecord(json) && json.force === true);
```

**Step 2: 用 `force` 控制自动开关判断**

```ts
const fullTextOnOpenEnabled = await getFeedFullTextOnOpenEnabled(pool, article.feedId);
if (!force && fullTextOnOpenEnabled !== true) {
  return ok({ enqueued: false });
}
```

**Step 3: 更新 `enqueueArticleFulltext` 的签名与请求体**

```ts
export async function enqueueArticleFulltext(
  articleId: string,
  input?: { force?: boolean },
): Promise<{ enqueued: boolean; jobId?: string }> {
  return requestApi(`/api/articles/${encodeURIComponent(articleId)}/fulltext`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ force: Boolean(input?.force) }),
  });
}
```

**Step 4: 运行针对性测试并确认通过**

Run: `pnpm test:unit -- src/app/api/articles/routes.test.ts src/lib/apiClient.test.ts --runInBand`
Expected: PASS，新增 `force=true` 相关断言通过，现有全文接口测试继续通过

**Step 5: Commit**

```bash
git add src/app/api/articles/[id]/fulltext/route.ts src/lib/apiClient.ts src/app/api/articles/routes.test.ts src/lib/apiClient.test.ts
git commit -m "feat(fulltext): 支持手动抓取绕过自动开关" -m "- 解析全文抓取接口的 force 请求体
- 允许手动抓取忽略 fullTextOnOpenEnabled 限制
- 更新客户端全文抓取请求签名"
```

### Task 3: 为全文抓取配置弹窗补齐测试

**Files:**

- Modify: `src/features/feeds/FeedPolicyDialogs.test.tsx`
- Create: `src/features/feeds/FeedFulltextPolicyDialog.tsx`

**Step 1: 写失败的弹窗测试**

```tsx
it('fulltext policy dialog saves fullTextOnOpenEnabled', async () => {
  const onSubmit = vi.fn(async () => undefined);

  render(
    <FeedFulltextPolicyDialog
      open
      feed={buildFeed({ fullTextOnOpenEnabled: false })}
      onOpenChange={() => {}}
      onSubmit={onSubmit}
    />,
  );

  await user.click(screen.getByLabelText('打开文章时自动抓取全文'));
  await user.click(screen.getByRole('button', { name: '保存配置' }));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith({ fullTextOnOpenEnabled: true });
  });
});
```

**Step 2: 运行弹窗测试并确认失败**

Run: `pnpm test:unit -- src/features/feeds/FeedPolicyDialogs.test.tsx --runInBand`
Expected: FAIL，表现为找不到 `FeedFulltextPolicyDialog` 或缺少相关断言目标

**Step 3: 实现最小弹窗组件**

```tsx
export interface FeedFulltextPolicyPatch {
  fullTextOnOpenEnabled: boolean;
}

export default function FeedFulltextPolicyDialog(...) {
  const [fullTextOnOpenEnabled, setFullTextOnOpenEnabled] = useState(false);
  // useEffect 同步 feed 值
  // Dialog + Switch + 保存逻辑对齐 FeedSummaryPolicyDialog
}
```

**Step 4: 重新运行弹窗测试并确认通过**

Run: `pnpm test:unit -- src/features/feeds/FeedPolicyDialogs.test.tsx --runInBand`
Expected: PASS，新增全文弹窗测试和既有摘要/翻译弹窗测试全部通过

**Step 5: Commit**

```bash
git add src/features/feeds/FeedPolicyDialogs.test.tsx src/features/feeds/FeedFulltextPolicyDialog.tsx
git commit -m "feat(fulltext): 添加全文抓取配置弹窗" -m "- 新增全文抓取策略弹窗组件
- 补充 fullTextOnOpenEnabled 保存测试"
```

### Task 4: 将全文抓取配置接入 Feed 菜单

**Files:**

- Modify: `src/features/feeds/FeedList.tsx`
- Modify: `src/features/feeds/FeedList.test.tsx`
- Test: `src/features/feeds/FeedPolicyDialogs.test.tsx`
- Test: `src/features/feeds/FeedFulltextPolicyDialog.tsx`

**Step 1: 写失败的菜单集成测试**

```tsx
it('opens fulltext policy dialog from feed context menu', async () => {
  render(<FeedList />);

  await user.pointer([{ keys: '[MouseRight]', target: screen.getByText('Example Feed') }]);
  await user.click(screen.getByText('全文抓取配置'));

  expect(screen.getByRole('dialog', { name: '全文抓取配置' })).toBeInTheDocument();
});
```

**Step 2: 运行 FeedList 测试并确认失败**

Run: `pnpm test:unit -- src/features/feeds/FeedList.test.tsx --runInBand`
Expected: FAIL，表现为菜单项不存在或未渲染全文弹窗

**Step 3: 以最小改动接入状态与弹窗**

```tsx
const [fulltextPolicyFeedId, setFulltextPolicyFeedId] = useState<string | null>(null);
const activeFulltextPolicyFeed = useMemo(
  () => fulltextPolicyFeedId ? feeds.find((feed) => feed.id === fulltextPolicyFeedId) ?? null : null,
  [fulltextPolicyFeedId, feeds],
);
```

```tsx
<ContextMenuItem onSelect={() => setFulltextPolicyFeedId(feed.id)}>
  <ContextMenuItemLabel>全文抓取配置</ContextMenuItemLabel>
</ContextMenuItem>

<FeedFulltextPolicyDialog
  open={Boolean(activeFulltextPolicyFeed)}
  feed={activeFulltextPolicyFeed}
  onOpenChange={(open) => {
    if (!open) setFulltextPolicyFeedId(null);
  }}
  onSubmit={async (patch) => {
    if (!activeFulltextPolicyFeed) return;
    await updateFeed(activeFulltextPolicyFeed.id, patch);
  }}
/>
```

**Step 4: 重新运行菜单与弹窗测试并确认通过**

Run: `pnpm test:unit -- src/features/feeds/FeedList.test.tsx src/features/feeds/FeedPolicyDialogs.test.tsx --runInBand`
Expected: PASS，全文抓取配置入口能打开并保存，原有菜单行为不回归

**Step 5: Commit**

```bash
git add src/features/feeds/FeedList.tsx src/features/feeds/FeedList.test.tsx src/features/feeds/FeedPolicyDialogs.test.tsx src/features/feeds/FeedFulltextPolicyDialog.tsx
git commit -m "feat(fulltext): 接入订阅源全文抓取配置入口" -m "- 在 feed 右键菜单新增全文抓取配置入口
- 连接全文抓取弹窗与 updateFeed 保存流程"
```

### Task 5: 为 ArticleView 手动全文抓取补齐测试

**Files:**

- Modify: `src/features/articles/ArticleView.aiSummary.test.tsx`
- Modify: `src/features/articles/ArticleView.aiTranslate.test.tsx`
- Modify: `src/features/articles/ArticleView.tsx`

**Step 1: 写失败的手动按钮显示与触发测试**

```tsx
it('shows 抓取全文 button and allows manual fetch when auto fulltext is disabled', async () => {
  await seedArticleViewState({ fullTextOnOpenEnabled: false });
  vi.mocked(apiClient.enqueueArticleFulltext).mockResolvedValue({ enqueued: true, jobId: 'job-1' });
  vi.mocked(apiClient.getArticleTasks)
    .mockResolvedValueOnce(idleTasks)
    .mockResolvedValueOnce({ ...idleTasks, fulltext: { ...idleTasks.fulltext, status: 'succeeded' } });

  render(<ArticleView />);
  await user.click(screen.getByRole('button', { name: '抓取全文' }));

  expect(apiClient.enqueueArticleFulltext).toHaveBeenCalledWith('article-1', { force: true });
});
```

**Step 2: 写失败的 pending 态按钮禁用测试**

```tsx
it('disables 抓取全文 button while fulltext task is queued', async () => {
  vi.mocked(apiClient.getArticleTasks).mockResolvedValue({
    ...idleTasks,
    fulltext: { ...idleTasks.fulltext, status: 'queued', jobId: 'job-fulltext-1' },
  });

  render(<ArticleView />);
  expect(await screen.findByRole('button', { name: '抓取全文' })).toBeDisabled();
});
```

**Step 3: 运行 ArticleView 相关测试并确认失败**

Run: `pnpm test:unit -- src/features/articles/ArticleView.aiSummary.test.tsx src/features/articles/ArticleView.aiTranslate.test.tsx --runInBand`
Expected: FAIL，表现为缺少 `抓取全文` 按钮、未发送 `force:true` 或 pending 态未禁用

**Step 4: 保持最小抽象，整理全文抓取请求入口**

```tsx
const fulltextButtonDisabled = fulltextPending;

function onFulltextButtonClick() {
  if (!article?.id) return;
  void requestFulltext(article.id, { force: true });
}
```

**Step 5: Commit**

```bash
git add src/features/articles/ArticleView.aiSummary.test.tsx src/features/articles/ArticleView.aiTranslate.test.tsx src/features/articles/ArticleView.tsx
git commit -m "test(fulltext): 补充右栏手动抓取测试" -m "- 添加手动抓取全文按钮显示与触发测试
- 添加全文抓取 pending 态禁用测试"
```

### Task 6: 实现 ArticleView 右栏手动抓取全文

**Files:**

- Modify: `src/features/articles/ArticleView.tsx`
- Test: `src/features/articles/ArticleView.aiSummary.test.tsx`
- Test: `src/features/articles/ArticleView.aiTranslate.test.tsx`

**Step 1: 抽出现有自动全文抓取为共享请求函数**

```tsx
const requestFulltext = useCallback(
  async (articleId: string, input?: { signal?: AbortSignal; force?: boolean }) => {
    const signal = input?.signal;
    const force = Boolean(input?.force);

    await enqueueArticleFulltext(articleId, { force });
    const result = await pollWithBackoff({
      fn: () => getArticleTasks(articleId),
      stop: (value) => ['idle', 'succeeded', 'failed'].includes(value.fulltext.status),
      onValue: (value) => {
        if (!signal?.aborted) setTasks(value);
      },
      signal,
    });

    if (result.value?.fulltext.status === 'succeeded') {
      await refreshArticle(articleId);
    }
  },
  [refreshArticle],
);
```

**Step 2: 让自动触发走 `requestFulltext(articleId, { signal, force: false })`**

```tsx
if (feedFullTextOnOpenEnabled && articleLink) {
  void requestFulltext(articleId, { signal, force: false });
}
```

**Step 3: 在右栏动作区新增 `抓取全文` 按钮并接入手动触发**

```tsx
<Button
  type="button"
  variant="secondary"
  className="h-8 px-3 text-sm cursor-pointer transition-shadow hover:shadow-md"
  onClick={onFulltextButtonClick}
  disabled={fulltextPending}
>
  <FileText />
  <span>抓取全文</span>
</Button>
```

**Step 4: 运行 ArticleView 定向测试并确认通过**

Run: `pnpm test:unit -- src/features/articles/ArticleView.aiSummary.test.tsx src/features/articles/ArticleView.aiTranslate.test.tsx --runInBand`
Expected: PASS，新增手动抓取用例通过，现有摘要/翻译行为不回归

**Step 5: Commit**

```bash
git add src/features/articles/ArticleView.tsx src/features/articles/ArticleView.aiSummary.test.tsx src/features/articles/ArticleView.aiTranslate.test.tsx
git commit -m "feat(fulltext): 添加右栏手动抓取全文入口" -m "- 复用自动抓取逻辑支持手动全文抓取
- 在阅读器右栏新增抓取全文按钮并处理 pending 状态"
```

### Task 7: 做最终针对性验证

**Files:**

- Verify: `src/app/api/articles/[id]/fulltext/route.ts`
- Verify: `src/lib/apiClient.ts`
- Verify: `src/features/feeds/FeedFulltextPolicyDialog.tsx`
- Verify: `src/features/feeds/FeedList.tsx`
- Verify: `src/features/articles/ArticleView.tsx`

**Step 1: 运行全文接口与客户端测试**

Run: `pnpm test:unit -- src/app/api/articles/routes.test.ts src/lib/apiClient.test.ts --runInBand`
Expected: PASS

**Step 2: 运行 feed 配置相关测试**

Run: `pnpm test:unit -- src/features/feeds/FeedPolicyDialogs.test.tsx src/features/feeds/FeedList.test.tsx --runInBand`
Expected: PASS

**Step 3: 运行 ArticleView 定向测试**

Run: `pnpm test:unit -- src/features/articles/ArticleView.aiSummary.test.tsx src/features/articles/ArticleView.aiTranslate.test.tsx --runInBand`
Expected: PASS

**Step 4: 查看工作区变更并确认只包含计划范围内文件**

Run: `git status --short`
Expected: 只出现全文抓取相关代码与测试文件，以及本计划文档（若尚未提交）

**Step 5: Commit**

```bash
git add src/app/api/articles/[id]/fulltext/route.ts src/lib/apiClient.ts src/lib/apiClient.test.ts src/app/api/articles/routes.test.ts src/features/feeds/FeedFulltextPolicyDialog.tsx src/features/feeds/FeedPolicyDialogs.test.tsx src/features/feeds/FeedList.tsx src/features/feeds/FeedList.test.tsx src/features/articles/ArticleView.tsx src/features/articles/ArticleView.aiSummary.test.tsx src/features/articles/ArticleView.aiTranslate.test.tsx
git commit -m "feat(fulltext): 完成全文抓取配置与手动触发" -m "- 添加全文抓取配置入口与策略弹窗
- 支持右栏手动抓取全文和接口 force 语义
- 补齐前端与服务端回归测试"
```

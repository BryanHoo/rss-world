# AI 摘要打字机效果 Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 让文章详情里的 AI 摘要对新增流式增量呈现更连续的打字机效果，并把新增量首字显示延迟压到 300-500ms，同时保持现有摘要恢复、切换文章和完成收敛语义稳定。

**Architecture:** 保持现有 `worker -> SSE route -> useStreamingAiSummary -> ArticleView` 的真实摘要链路不变，只缩短 SSE route 的回放节奏，并在前端新增一个独立显示 hook，把真实 `sourceText` 派生为动画用的 `displayText`。`summary.delta` 只驱动动画，`summary.snapshot` 与 `session.completed / session.failed` 拥有更高优先级，收到后立即纠偏或收敛。

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Testing Library, SSE (`EventSource` / `ReadableStream`), pnpm

**Relevant Context:**

- Design doc: [`docs/plans/2026-03-11-ai-summary-typewriter-design.md`](./2026-03-11-ai-summary-typewriter-design.md)
- Summary: [`docs/summaries/2026-03-09-streaming-summary-hook-reset.md`](../summaries/2026-03-09-streaming-summary-hook-reset.md)
- Summary: [`docs/summaries/2026-03-11-streaming-summary-switch-loss-and-force-duplicate.md`](../summaries/2026-03-11-streaming-summary-switch-loss-and-force-duplicate.md)
- Summary: [`docs/summaries/2026-03-11-reader-background-refresh-overwrites-foreground-view.md`](../summaries/2026-03-11-reader-background-refresh-overwrites-foreground-view.md)
- Use `@workflow-test-driven-development` for each task.
- Use `@vitest` for timer-driven unit tests and `@vercel-react-best-practices` for the React display hook integration.

---

### Task 1: 缩短 AI 摘要 SSE 回放节奏

**Files:**

- Modify: `src/app/api/articles/[id]/ai-summary/stream/route.ts`
- Test: `src/app/api/articles/[id]/ai-summary/stream/route.test.ts`

**Step 1: Write the failing test**

在 `src/app/api/articles/[id]/ai-summary/stream/route.test.ts` 新增一个定时器驱动的回归测试，验证 route 不再等满 1000ms 才拿到后续事件。

```ts
it('replays follow-up events within the short poll window', async () => {
  vi.useFakeTimers();

  listAiSummaryEventsAfterMock
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        eventId: 9,
        sessionId: 'summary-session-id-1',
        eventType: 'summary.delta',
        payload: { deltaText: ' 第二条' },
        createdAt: '2026-03-11T00:00:01.000Z',
      },
    ]);

  const mod = await import('./route');
  const res = await mod.GET(new Request(`http://localhost/api/articles/${articleId}/ai-summary/stream`), {
    params: Promise.resolve({ id: articleId }),
  });

  const reader = res.body!.getReader();
  const pendingRead = reader.read();

  await vi.advanceTimersByTimeAsync(300);

  const chunk = await pendingRead;
  const text = new TextDecoder().decode(chunk.value ?? new Uint8Array());
  expect(text).toContain('event: summary.delta');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/app/api/articles/[id]/ai-summary/stream/route.test.ts -t "replays follow-up events within the short poll window"`

Expected: FAIL，因为 route 仍然使用 1000ms 轮询，300ms 内拿不到第二次查询结果。

**Step 3: Write minimal implementation**

在 `src/app/api/articles/[id]/ai-summary/stream/route.ts` 引入显式常量并把 replay 轮询缩短到设计目标区间，保持 heartbeat、`Last-Event-ID` 和回放逻辑不变。

```ts
const SUMMARY_STREAM_REPLAY_INTERVAL_MS = 250;

const replayTimer = setInterval(() => {
  void listAiSummaryEventsAfter(pool, {
    sessionId: session.id,
    afterEventId: lastEventId,
  })
    .then((events) => {
      pushEvents(events);
    })
    .catch(() => {
      // Keep stream alive for transient poll errors.
    });
}, SUMMARY_STREAM_REPLAY_INTERVAL_MS);
```

如果测试需要更稳定的可观察点，可以把常量放在文件顶部并在测试里只断言“300ms 内能收到后续事件”，不要把断言绑死到具体 250ms。

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/app/api/articles/[id]/ai-summary/stream/route.test.ts`

Expected: PASS，现有 Last-Event-ID 回放测试继续通过，新用例证明 route 会在短窗口内回放后续事件。

**Step 5: Commit**

```bash
git add src/app/api/articles/[id]/ai-summary/stream/route.ts src/app/api/articles/[id]/ai-summary/stream/route.test.ts
git commit -m "feat(reader): 缩短摘要SSE回放节奏" -m "- 添加 AI 摘要流短轮询回放常量\n- 保持 Last-Event-ID 与 heartbeat 语义不变\n- 补充 短时间窗口内回放后续事件的回归测试"
```

### Task 2: 新增独立的摘要打字机显示 hook

**Files:**

- Create: `src/features/articles/useAnimatedAiSummaryText.ts`
- Test: `src/features/articles/useAnimatedAiSummaryText.test.ts`

**Step 1: Write the failing test**

新建 `src/features/articles/useAnimatedAiSummaryText.test.ts`，用 fake timers 覆盖三类核心行为：恢复态直接显示全文、delta 以短片段推进、snapshot/completed 立即纠偏或收敛。

```ts
it('animates only newly appended summary text', async () => {
  vi.useFakeTimers();

  const { result, rerender } = renderHook(
    ({ articleId, sourceText, status }) =>
      useAnimatedAiSummaryText({ articleId, sourceText, status }),
    {
      initialProps: {
        articleId: 'article-1',
        sourceText: 'TL;DR',
        status: 'running' as const,
      },
    },
  );

  expect(result.current.displayText).toBe('TL;DR');

  rerender({
    articleId: 'article-1',
    sourceText: 'TL;DR\n- 第一条',
    status: 'running' as const,
  });

  expect(result.current.displayText).toBe('TL;DR');

  await act(async () => {
    await vi.advanceTimersByTimeAsync(80);
  });

  expect(result.current.displayText.length).toBeGreaterThan('TL;DR'.length);
  expect(result.current.displayText).not.toBe('TL;DR\n- 第一条');
});

it('snaps to the latest full text on article change and terminal states', async () => {
  // articleId 切换时直接显示新文章草稿
  // status 变成 succeeded / failed 时立即对齐 sourceText
});
```

再补一个 `prefers-reduced-motion` 用例，验证关闭动画时新增量直接显示。

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/features/articles/useAnimatedAiSummaryText.test.ts`

Expected: FAIL，因为 hook 文件尚不存在，或还没有实现“只动画新增量”和“终态立即收敛”。

**Step 3: Write minimal implementation**

新建 `src/features/articles/useAnimatedAiSummaryText.ts`，实现一个只依赖 `articleId`、`sourceText`、`status` 的纯显示 hook。关键约束：

- `articleId` 变化时，立刻把 `displayText` 同步到新文章的 `sourceText`；
- `summary.snapshot` 对应的 `sourceText` 变长时，按差量进入缓冲；
- `status === 'succeeded' || status === 'failed'` 时立即对齐 `sourceText`；
- 若 `prefers-reduced-motion` 为真，则跳过动画；
- 清理 timer 时不要影响 `useStreamingAiSummary` 的 `EventSource` 生命周期。

建议骨架：

```ts
interface UseAnimatedAiSummaryTextInput {
  articleId: string | null;
  sourceText: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | null;
}

export function useAnimatedAiSummaryText(input: UseAnimatedAiSummaryTextInput) {
  const [displayText, setDisplayText] = useState(input.sourceText);
  const pendingTextRef = useRef('');
  const timerRef = useRef<number | null>(null);
  const lastArticleIdRef = useRef(input.articleId);

  // articleId change -> sync immediately
  // terminal state or reduced motion -> sync immediately
  // sourceText appended while running -> enqueue appended suffix
  // cleanup timer on unmount

  return { displayText };
}
```

步进建议直接写进实现常量，避免 magic number：

- `SUMMARY_TYPING_MIN_CHARS = 2`
- `SUMMARY_TYPING_MAX_CHARS = 6`
- `SUMMARY_TYPING_MIN_DELAY_MS = 40`
- `SUMMARY_TYPING_MAX_DELAY_MS = 70`

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/features/articles/useAnimatedAiSummaryText.test.ts`

Expected: PASS，覆盖恢复态直显、新增量分步播放、终态对齐和 reduced motion 关闭动画。

**Step 5: Commit**

```bash
git add src/features/articles/useAnimatedAiSummaryText.ts src/features/articles/useAnimatedAiSummaryText.test.ts
git commit -m "feat(reader): 添加摘要打字机显示hook" -m "- 添加 独立的摘要显示动画 hook\n- 保持 真实摘要状态与视觉播放状态分层\n- 补充 恢复、终态与 reduced motion 的单测"
```

### Task 3: 将打字机显示层接入 ArticleView

**Files:**

- Modify: `src/features/articles/ArticleView.tsx`
- Modify: `src/features/articles/ArticleView.aiSummary.test.tsx`
- Read for safety: `src/features/articles/useStreamingAiSummary.ts`

**Step 1: Write the failing test**

在 `src/features/articles/ArticleView.aiSummary.test.tsx` 新增页面级用例，覆盖两个行为：

1. 收到 `summary.delta` 后不会整块瞬时出现，而是在若干 timer tick 后补齐；
2. 重新进入已有运行中草稿的文章时，直接显示完整草稿，不重放历史内容。

建议写法：

```ts
it('plays summary delta in chunks instead of rendering the full block immediately', async () => {
  vi.useFakeTimers();
  await seedArticleViewState();
  render(<ArticleView />);

  await waitFor(() => {
    expect(getArticleAiSummarySnapshotMock).toHaveBeenCalledWith('article-1');
  });

  await act(async () => {
    fakeEventSource.emit('summary.snapshot', { draftText: 'TL;DR' });
  });

  await act(async () => {
    fakeEventSource.emit('summary.delta', { deltaText: '\n- 第一条' });
  });

  const summaryCard = screen.getByLabelText('AI 摘要');
  expect(summaryCard.textContent).toContain('TL;DR');
  expect(summaryCard.textContent).not.toContain('TL;DR - 第一条');

  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });

  expect(summaryCard.textContent).toContain('TL;DR - 第一条');
});
```

已有“存在运行中的 `aiSummarySession` 时隐藏旧摘要并显示新草稿”的测试也要同步调整断言，确保它仍然是立即显示完整草稿，而不是重放。

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/features/articles/ArticleView.aiSummary.test.tsx -t "plays summary delta in chunks instead of rendering the full block immediately"`

Expected: FAIL，因为 `ArticleView` 目前直接渲染真实 `draftText`，delta 一到就会整块显示。

**Step 3: Write minimal implementation**

在 `src/features/articles/ArticleView.tsx` 接入 `useAnimatedAiSummaryText`，只替换摘要卡片展示文本的来源，不改 `useStreamingAiSummary` 的真实状态逻辑。

```ts
const activeAiSummarySession = streamingAiSummary.session;
const sourceAiSummaryText = showingStreamingSummary
  ? activeAiSummarySession?.finalText?.trim() || activeAiSummarySession?.draftText?.trim() || ''
  : article.aiSummary?.trim() ?? '';

const { displayText: animatedAiSummaryText } = useAnimatedAiSummaryText({
  articleId: currentArticleId,
  sourceText: sourceAiSummaryText,
  status: activeAiSummarySession?.status ?? null,
});

const aiSummaryText = showingStreamingSummary ? animatedAiSummaryText : sourceAiSummaryText;
```

实现时注意：

- 非流式正式摘要可以继续直显，不必走动画；
- 当 `activeAiSummarySession` 为空时，不要创建无意义动画状态；
- 保持现有展开/收起、失败提示、按钮可用性与 `refreshArticle` 逻辑不变。

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/features/articles/ArticleView.aiSummary.test.tsx`

Expected: PASS，现有 AI 摘要页面测试继续通过，并新增页面级打字机与恢复态回归覆盖。

**Step 5: Commit**

```bash
git add src/features/articles/ArticleView.tsx src/features/articles/ArticleView.aiSummary.test.tsx src/features/articles/useAnimatedAiSummaryText.ts src/features/articles/useAnimatedAiSummaryText.test.ts
git commit -m "feat(reader): 接入摘要打字机展示" -m "- 接入 AI 摘要显示层并仅动画新增量\n- 保持 运行中草稿恢复与失败提示语义不变\n- 更新 页面级回归测试覆盖打字机与恢复行为"
```

### Task 4: 全量回归、lint 与交接检查

**Files:**

- Verify only: `src/app/api/articles/[id]/ai-summary/stream/route.ts`
- Verify only: `src/features/articles/useAnimatedAiSummaryText.ts`
- Verify only: `src/features/articles/ArticleView.tsx`
- Verify only: `docs/plans/2026-03-11-ai-summary-typewriter-design.md`
- Verify only: `docs/plans/2026-03-11-ai-summary-typewriter.md`

**Step 1: Run the focused summary test suite**

Run:

```bash
pnpm test:unit \
  src/app/api/articles/[id]/ai-summary/stream/route.test.ts \
  src/features/articles/useStreamingAiSummary.test.ts \
  src/features/articles/useAnimatedAiSummaryText.test.ts \
  src/features/articles/ArticleView.aiSummary.test.tsx
```

Expected: PASS；确认服务端节奏、真实 session、显示层动画和页面集成都通过。

**Step 2: Run lint on touched source files**

Run:

```bash
pnpm exec eslint \
  src/app/api/articles/[id]/ai-summary/stream/route.ts \
  src/app/api/articles/[id]/ai-summary/stream/route.test.ts \
  src/features/articles/useAnimatedAiSummaryText.ts \
  src/features/articles/useAnimatedAiSummaryText.test.ts \
  src/features/articles/ArticleView.tsx \
  src/features/articles/ArticleView.aiSummary.test.tsx
```

Expected: PASS；无新增 lint 错误。

**Step 3: Smoke-check for regressions called out in prior summaries**

人工检查实现是否仍满足以下约束：

- `useStreamingAiSummary` 未引入新的显示态依赖，避免 stream reset；
- 切换文章后返回仍直接显示该文章的真实草稿；
- `session.completed` 到来时不会留下半截动画；
- `refreshArticle` 不会导致草稿重播。

把这四项检查写进提交说明或 PR 描述。

**Step 4: Review git diff before final handoff**

Run: `git diff --stat HEAD~3..HEAD`

Expected: 只包含本计划约定的 route、display hook、ArticleView 与测试文件，没有无关改动。

**Step 5: Commit final cleanup if needed**

如果第 1-4 步没有再产生文件改动，则不要额外提交；如果为了修复 lint、测试或边界问题做了补丁，再执行：

```bash
git add <touched-files>
git commit -m "test(reader): 补齐摘要打字机回归验证" -m "- 修复 回归测试或 lint 暴露的边界问题\n- 校验 打字机显示与摘要恢复语义兼容\n- 确认 关键摘要测试集全部通过"
```

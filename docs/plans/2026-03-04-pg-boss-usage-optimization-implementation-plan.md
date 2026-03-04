# pg-boss 使用优化 Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 在不改变现有 API 协议与 AI 手动重试策略的前提下，系统化落地 pg-boss 的队列契约、吞吐调优、失败恢复与可观测能力。  

**Architecture:** 采用“Queue Contract 驱动”方式，把 `send/createQueue/work` 参数集中到 `contracts`，并通过 `bootstrap + workerRegistry` 注入 worker 生命周期。路由层统一使用结构化 enqueue 结果，替代字符串错误分支。`feed/fulltext` 启用自动重试 + backoff + DLQ，`ai*` 保持 `retryLimit: 0`。  

**Tech Stack:** Next.js App Router、TypeScript、pg-boss@12.13.0、Vitest、PostgreSQL、Node.js 20  

---

## 0. 前置上下文与约束

- 设计文档：`docs/plans/2026-03-04-pg-boss-usage-optimization-design.md`
- 历史总结（必须复用）：`docs/summaries/2026-03-04-async-tasks-refactor.md`
- 当前关键实现：
  - `src/server/queue/boss.ts`
  - `src/server/queue/queue.ts`
  - `src/worker/index.ts`
  - `src/app/api/articles/routes.test.ts`
  - `src/app/api/feeds/routes.test.ts`

执行要求：

- 遵循 `@workflow-test-driven-development`（先写失败测试，再最小实现）。
- 每个任务结束后执行局部验证并提交小步 commit。
- 最终收口遵循 `@workflow-verification-before-completion`。

---

### Task 1: 建立 Queue Contract 单一事实源

**Files:**

- Create: `src/server/queue/contracts.ts`
- Test: `src/server/queue/contracts.test.ts`
- Modify: `src/server/queue/jobs.ts`（仅在需要补齐 job 常量时）

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import {
  QUEUE_CONTRACTS,
  getQueueCreateOptions,
  getQueueSendOptions,
  getWorkerOptions,
} from './contracts';

describe('queue contracts', () => {
  it('keeps ai jobs manual retry (retryLimit=0)', () => {
    expect(getQueueSendOptions('ai.summarize_article', { articleId: 'a1' }).retryLimit).toBe(0);
    expect(getQueueSendOptions('ai.translate_article_zh', { articleId: 'a1' }).retryLimit).toBe(0);
  });

  it('enables retry+dlq for fulltext/feed', () => {
    expect(getQueueCreateOptions('article.fetch_fulltext').deadLetter).toBe('dlq.article.fulltext');
    expect(getQueueCreateOptions('feed.fetch').retryLimit).toBeGreaterThan(0);
  });

  it('provides worker concurrency defaults', () => {
    expect(getWorkerOptions('feed.fetch').localConcurrency).toBeGreaterThanOrEqual(1);
    expect(Object.keys(QUEUE_CONTRACTS)).toContain('ai.translate_title_zh');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/server/queue/contracts.test.ts`  
Expected: FAIL，提示 `Cannot find module './contracts'` 或导出不存在。

**Step 3: Write minimal implementation**

```ts
// src/server/queue/contracts.ts
export interface QueueCreateOptions {
  retryLimit?: number;
  retryDelay?: number;
  retryBackoff?: boolean;
  retryDelayMax?: number;
  heartbeatSeconds?: number;
  expireInSeconds?: number;
  deadLetter?: string;
  warningQueueSize?: number;
}

export interface WorkerOptions {
  localConcurrency: number;
  batchSize: number;
  pollingIntervalSeconds?: number;
}

type SendContext = { articleId?: string; feedId?: string; force?: boolean };

interface QueueContract {
  queue: QueueCreateOptions;
  worker: WorkerOptions;
  send: (ctx: SendContext) => Record<string, unknown>;
}

export const QUEUE_CONTRACTS: Record<string, QueueContract> = {
  'feed.fetch': {
    queue: { retryLimit: 4, retryDelay: 20, retryBackoff: true, retryDelayMax: 600, deadLetter: 'dlq.feed.fetch', warningQueueSize: 200 },
    worker: { localConcurrency: 3, batchSize: 1 },
    send: () => ({}),
  },
  'article.fetch_fulltext': {
    queue: { retryLimit: 3, retryDelay: 30, retryBackoff: true, retryDelayMax: 900, deadLetter: 'dlq.article.fulltext', heartbeatSeconds: 60, expireInSeconds: 1200, warningQueueSize: 300 },
    worker: { localConcurrency: 4, batchSize: 2 },
    send: (ctx) => ({ singletonKey: ctx.articleId, singletonSeconds: 600 }),
  },
  'ai.summarize_article': {
    queue: { heartbeatSeconds: 60, expireInSeconds: 1800, warningQueueSize: 300 },
    worker: { localConcurrency: 2, batchSize: 1 },
    send: (ctx) => ({ singletonKey: ctx.articleId, singletonSeconds: 600, retryLimit: 0 }),
  },
  'ai.translate_article_zh': {
    queue: { heartbeatSeconds: 60, expireInSeconds: 1800, warningQueueSize: 300 },
    worker: { localConcurrency: 2, batchSize: 1 },
    send: (ctx) => ({ singletonKey: ctx.articleId, singletonSeconds: 600, retryLimit: 0 }),
  },
  'ai.translate_title_zh': {
    queue: { warningQueueSize: 300 },
    worker: { localConcurrency: 2, batchSize: 1 },
    send: (ctx) => ({ singletonKey: ctx.articleId, singletonSeconds: 600, retryLimit: 0 }),
  },
  'feed.refresh_all': {
    queue: { warningQueueSize: 50 },
    worker: { localConcurrency: 1, batchSize: 1 },
    send: () => ({}),
  },
};

export function getQueueCreateOptions(name: string): QueueCreateOptions {
  return QUEUE_CONTRACTS[name]?.queue ?? {};
}

export function getWorkerOptions(name: string): WorkerOptions {
  return QUEUE_CONTRACTS[name]?.worker ?? { localConcurrency: 1, batchSize: 1 };
}

export function getQueueSendOptions(name: string, ctx: SendContext): Record<string, unknown> {
  return QUEUE_CONTRACTS[name]?.send(ctx) ?? {};
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/server/queue/contracts.test.ts`  
Expected: PASS（3 tests passed）。

**Step 5: Commit**

```bash
git add src/server/queue/contracts.ts src/server/queue/contracts.test.ts
git commit -m "feat(queue): 新增 pg-boss 队列契约定义"
```

---

### Task 2: 为 enqueue 增加结构化返回语义

**Files:**

- Modify: `src/server/queue/queue.ts`
- Create: `src/server/queue/queue.test.ts`

**Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const startBossMock = vi.fn();
vi.mock('./boss', () => ({ startBoss: (...args: unknown[]) => startBossMock(...args) }));

describe('queue enqueueWithResult', () => {
  beforeEach(() => startBossMock.mockReset());

  it('returns throttled_or_duplicate when send resolves null', async () => {
    startBossMock.mockResolvedValue({ createQueue: vi.fn().mockResolvedValue(undefined), send: vi.fn().mockResolvedValue(null) });
    const mod = await import('./queue');
    const res = await mod.enqueueWithResult('ai.summarize_article', { articleId: 'a1' }, {});
    expect(res).toEqual({ status: 'throttled_or_duplicate' });
  });

  it('keeps legacy enqueue API returning jobId', async () => {
    startBossMock.mockResolvedValue({ createQueue: vi.fn().mockResolvedValue(undefined), send: vi.fn().mockResolvedValue('job-1') });
    const mod = await import('./queue');
    await expect(mod.enqueue('feed.fetch', { feedId: 'f1' }, {})).resolves.toBe('job-1');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/server/queue/queue.test.ts`  
Expected: FAIL，`enqueueWithResult is not a function`。

**Step 3: Write minimal implementation**

```ts
// src/server/queue/queue.ts
export type EnqueueResult =
  | { status: 'enqueued'; jobId: string }
  | { status: 'throttled_or_duplicate' };

export async function enqueueWithResult(
  name: string,
  data: object | null,
  options?: unknown,
): Promise<EnqueueResult> {
  const instance = await startBoss();
  await ensureQueue(instance, name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobId = await instance.send(name, data, options as any);
  if (!jobId) return { status: 'throttled_or_duplicate' };
  return { status: 'enqueued', jobId: String(jobId) };
}

export async function enqueue(name: string, data: object | null, options?: unknown): Promise<string> {
  const result = await enqueueWithResult(name, data, options);
  if (result.status !== 'enqueued') throw new Error('Failed to enqueue job');
  return result.jobId;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/server/queue/queue.test.ts`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/server/queue/queue.ts src/server/queue/queue.test.ts
git commit -m "refactor(queue): 入队结果改为结构化语义"
```

---

### Task 3: ai-summary route 改用结构化 enqueue 结果

**Files:**

- Modify: `src/app/api/articles/[id]/ai-summary/route.ts`
- Modify: `src/app/api/articles/routes.test.ts`

**Step 1: Write the failing test**

```ts
it('POST /:id/ai-summary returns already_enqueued when enqueueWithResult reports duplicate', async () => {
  enqueueWithResultMock.mockResolvedValue({ status: 'throttled_or_duplicate' });
  const mod = await import('./[id]/ai-summary/route');
  const res = await mod.POST(new Request(`http://localhost/api/articles/${articleId}/ai-summary`), {
    params: Promise.resolve({ id: articleId }),
  });
  const json = await res.json();
  expect(json.data).toEqual({ enqueued: false, reason: 'already_enqueued' });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/app/api/articles/routes.test.ts -t "ai-summary returns already_enqueued"`  
Expected: FAIL，mock/导入名称不匹配。

**Step 3: Write minimal implementation**

```ts
// route.ts
import { enqueueWithResult } from '../../../../../server/queue/queue';
import { getQueueSendOptions } from '../../../../../server/queue/contracts';

const enqueueResult = await enqueueWithResult(
  JOB_AI_SUMMARIZE,
  { articleId },
  getQueueSendOptions(JOB_AI_SUMMARIZE, { articleId }),
);

if (enqueueResult.status !== 'enqueued') {
  return ok({ enqueued: false, reason: 'already_enqueued' });
}

await upsertTaskQueued(pool, { articleId, type: 'ai_summary', jobId: enqueueResult.jobId });
return ok({ enqueued: true, jobId: enqueueResult.jobId });
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/app/api/articles/routes.test.ts -t "ai-summary"`  
Expected: PASS，包含 enqueued 与 duplicate 分支。

**Step 5: Commit**

```bash
git add src/app/api/articles/[id]/ai-summary/route.ts src/app/api/articles/routes.test.ts
git commit -m "refactor(api): ai_summary 接入结构化入队结果"
```

---

### Task 4: ai-translate + fulltext routes 改用结构化 enqueue 结果

**Files:**

- Modify: `src/app/api/articles/[id]/ai-translate/route.ts`
- Modify: `src/app/api/articles/[id]/fulltext/route.ts`
- Modify: `src/app/api/articles/routes.test.ts`

**Step 1: Write the failing test**

```ts
it('POST /:id/ai-translate returns already_enqueued on duplicate result', async () => {
  enqueueWithResultMock.mockResolvedValue({ status: 'throttled_or_duplicate' });
  // ...expect { enqueued:false, reason:'already_enqueued' }
});

it('POST /:id/fulltext returns enqueued=false on duplicate result', async () => {
  enqueueWithResultMock.mockResolvedValue({ status: 'throttled_or_duplicate' });
  // ...expect { enqueued:false }
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/app/api/articles/routes.test.ts -t "ai-translate|fulltext"`  
Expected: FAIL（仍依赖 rejected error 分支）。

**Step 3: Write minimal implementation**

```ts
const result = await enqueueWithResult(
  JOB_AI_TRANSLATE,
  { articleId },
  getQueueSendOptions(JOB_AI_TRANSLATE, { articleId }),
);
if (result.status !== 'enqueued') return ok({ enqueued: false, reason: 'already_enqueued' });

const fulltextResult = await enqueueWithResult(
  JOB_ARTICLE_FULLTEXT_FETCH,
  { articleId },
  getQueueSendOptions(JOB_ARTICLE_FULLTEXT_FETCH, { articleId }),
);
if (fulltextResult.status !== 'enqueued') return ok({ enqueued: false });
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/app/api/articles/routes.test.ts`  
Expected: PASS（articles routes 全绿）。

**Step 5: Commit**

```bash
git add src/app/api/articles/[id]/ai-translate/route.ts src/app/api/articles/[id]/fulltext/route.ts src/app/api/articles/routes.test.ts
git commit -m "refactor(api): ai_translate 与 fulltext 统一入队语义"
```

---

### Task 5: feed refresh routes 接入队列契约

**Files:**

- Modify: `src/app/api/feeds/[id]/refresh/route.ts`
- Modify: `src/app/api/feeds/refresh/route.ts`
- Modify: `src/app/api/feeds/routes.test.ts`

**Step 1: Write the failing test**

```ts
it('POST /refresh passes contract send options to feed.fetch', async () => {
  enqueueWithResultMock.mockResolvedValue({ status: 'enqueued', jobId: 'job-id-1' });
  // assert enqueueWithResult called with getQueueSendOptions('feed.fetch', { feedId, force: true })
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/app/api/feeds/routes.test.ts -t "refresh"`  
Expected: FAIL（仍调用旧 enqueue）。

**Step 3: Write minimal implementation**

```ts
import { enqueueWithResult } from '../../../../../server/queue/queue';
import { getQueueSendOptions } from '../../../../../server/queue/contracts';

const result = await enqueueWithResult(
  JOB_REFRESH_ALL,
  { force: true },
  getQueueSendOptions(JOB_REFRESH_ALL, { force: true }),
);
if (result.status !== 'enqueued') return ok({ enqueued: false });
return ok({ enqueued: true, jobId: result.jobId });
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/app/api/feeds/routes.test.ts`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/app/api/feeds/[id]/refresh/route.ts src/app/api/feeds/refresh/route.ts src/app/api/feeds/routes.test.ts
git commit -m "refactor(api): feed 刷新接口接入队列契约"
```

---

### Task 6: 引入 queue bootstrap（createQueue + DLQ + queue options）

**Files:**

- Create: `src/server/queue/bootstrap.ts`
- Create: `src/server/queue/bootstrap.test.ts`
- Modify: `src/worker/index.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { bootstrapQueues } from './bootstrap';

it('creates queues and dead-letter queues from contracts', async () => {
  const createQueue = vi.fn().mockResolvedValue(undefined);
  await bootstrapQueues({ createQueue } as unknown as { createQueue: (name: string, options?: unknown) => Promise<void> });
  expect(createQueue).toHaveBeenCalledWith('article.fetch_fulltext', expect.any(Object));
  expect(createQueue).toHaveBeenCalledWith('dlq.article.fulltext', expect.any(Object));
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/server/queue/bootstrap.test.ts`  
Expected: FAIL（模块不存在）。

**Step 3: Write minimal implementation**

```ts
import { QUEUE_CONTRACTS } from './contracts';

export async function bootstrapQueues(boss: { createQueue: (name: string, options?: unknown) => Promise<void> }) {
  for (const [name, contract] of Object.entries(QUEUE_CONTRACTS)) {
    await boss.createQueue(name, contract.queue);
    if (contract.queue.deadLetter) {
      await boss.createQueue(contract.queue.deadLetter, {});
    }
  }
}
```

并在 `src/worker/index.ts` 的 `main()` 中替换硬编码 `createQueue(...)`：

```ts
await bootstrapQueues(boss);
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/server/queue/bootstrap.test.ts`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/server/queue/bootstrap.ts src/server/queue/bootstrap.test.ts src/worker/index.ts
git commit -m "feat(worker): 引入队列启动引导与死信队列创建"
```

---

### Task 7: 引入 worker registry 并配置化并发/批量

**Files:**

- Create: `src/worker/workerRegistry.ts`
- Create: `src/worker/workerRegistry.test.ts`
- Modify: `src/worker/index.ts`

**Step 1: Write the failing test**

```ts
it('registers work handlers with contract worker options', async () => {
  const work = vi.fn().mockResolvedValue('worker-id');
  await registerWorkers({ work } as unknown as { work: (...args: unknown[]) => Promise<string> }, {
    // handlers...
  });
  expect(work).toHaveBeenCalledWith(
    'article.fetch_fulltext',
    expect.objectContaining({ localConcurrency: 4, batchSize: 2 }),
    expect.any(Function),
  );
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/worker/workerRegistry.test.ts`  
Expected: FAIL（模块不存在）。

**Step 3: Write minimal implementation**

```ts
import { getWorkerOptions } from '../server/queue/contracts';

export async function registerWorkers(
  boss: { work: (name: string, options: unknown, handler: (jobs: unknown[]) => Promise<void>) => Promise<string> },
  handlers: Record<string, (jobs: unknown[]) => Promise<void>>,
) {
  for (const [name, handler] of Object.entries(handlers)) {
    await boss.work(name, getWorkerOptions(name), handler);
  }
}
```

并把 `src/worker/index.ts` 里每个 `boss.work(...)` 注册调用迁移为 registry 调度（handler 逻辑保留原函数体）。

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/worker/workerRegistry.test.ts`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/worker/workerRegistry.ts src/worker/workerRegistry.test.ts src/worker/index.ts
git commit -m "perf(worker): 配置化 worker 并发与批量参数"
```

---

### Task 8: 增强 pg-boss 可观测（error/warning/wip/stopped + stats 采样）

**Files:**

- Modify: `src/server/queue/boss.ts`
- Create: `src/server/queue/observability.ts`
- Create: `src/server/queue/observability.test.ts`
- Modify: `src/worker/index.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { attachBossObservers } from './observability';

it('attaches error/warning/stopped listeners', () => {
  const on = vi.fn();
  attachBossObservers({ on } as unknown as { on: (event: string, cb: (...args: unknown[]) => void) => void });
  expect(on).toHaveBeenCalledWith('error', expect.any(Function));
  expect(on).toHaveBeenCalledWith('warning', expect.any(Function));
  expect(on).toHaveBeenCalledWith('stopped', expect.any(Function));
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/server/queue/observability.test.ts`  
Expected: FAIL（模块不存在）。

**Step 3: Write minimal implementation**

```ts
export function attachBossObservers(boss: { on: (event: string, cb: (...args: unknown[]) => void) => void }) {
  boss.on('error', (err) => console.error('[pgboss.error]', err));
  boss.on('warning', (payload) => console.warn('[pgboss.warning]', payload));
  boss.on('wip', (payload) => console.info('[pgboss.wip]', payload));
  boss.on('stopped', () => console.info('[pgboss.stopped]'));
}

export async function sampleQueueStats(
  boss: { getQueueStats: (name: string) => Promise<unknown> },
  names: string[],
) {
  await Promise.all(names.map((name) => boss.getQueueStats(name)));
}
```

并在 `boss.ts` 创建实例后调用 `attachBossObservers(boss)`；在 worker 启动后增加低频 stats 采样（例如每 60s）。

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/server/queue/observability.test.ts`  
Expected: PASS。

**Step 5: Commit**

```bash
git add src/server/queue/boss.ts src/server/queue/observability.ts src/server/queue/observability.test.ts src/worker/index.ts
git commit -m "feat(queue): 增加 pg-boss 观测事件与队列采样"
```

---

### Task 9: 回归测试与文档收口

**Files:**

- Modify: `docs/plans/2026-03-04-pg-boss-usage-optimization-design.md`（必要时补充“as-built”备注）
- Create: `docs/summaries/2026-03-04-pg-boss-usage-optimization.md`

**Step 1: Write the failing test**

本任务为验证与文档收口，不新增失败测试；先执行全量测试作为基线。

```bash
pnpm run test:unit
```

**Step 2: Run test to verify baseline**

Run: `pnpm run test:unit`  
Expected: PASS（若 FAIL，先用 `@workflow-systematic-debugging` 定位后再继续）。

**Step 3: Write minimal implementation**

新增总结文档，记录：

- 变更范围（contracts/enqueue/bootstrap/registry/observability）
- 指标前后对比口径（queue lag、enqueue->active、失败率）
- 回滚开关与参数
- 相关证据命令输出摘要

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit`  
Expected: PASS（全量绿）。

**Step 5: Commit**

```bash
git add docs/summaries/2026-03-04-pg-boss-usage-optimization.md docs/plans/2026-03-04-pg-boss-usage-optimization-design.md
git commit -m "docs(queue): 补充 pg-boss 优化结果与验证证据"
```

---

## 最终验收命令（执行完成后）

```bash
pnpm run test:unit
pnpm run lint
```

预期：

- 测试全绿；
- lint 无新增错误；
- queue 相关路由行为保持兼容（`enqueued/reason` 不变）；
- `ai*` 任务仍不自动重试，`feed/fulltext` 自动重试 + DLQ 生效。

## 执行注意事项

- 当前会话不在独立 worktree；正式执行前建议按 `workflow-using-git-worktrees` 创建隔离 worktree。
- 若任何任务中出现非预期外部改动，立即暂停并确认。
- 每个任务只做最小变更，避免跨任务耦合。


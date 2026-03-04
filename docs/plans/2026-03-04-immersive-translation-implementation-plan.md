# Immersive Paragraph Translation Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 在文章页实现“主内容区逐段翻译 + 每段持久化 + SSE 增量回传 + 自动恢复”，达到沉浸式“上原文、下译文”阅读体验。  

**Architecture:** 保留现有 `pg-boss` 的 `ai.translate_article_zh` 任务作为执行入口，新增 `session + segments + events` 三层数据模型承载段落级进度；前端点击“翻译”后走 `POST /ai-translate` 创建/恢复会话，再通过 `GET /ai-translate` 快照 + `GET /ai-translate/stream` SSE 增量更新渲染。后端并发翻译段落，前端固定按 `segmentIndex` 顺序展示。  

**Tech Stack:** Next.js Route Handlers, TypeScript, pg/SQL migration, pg-boss worker, React 19, Zustand, Vitest, Testing Library, SSE (`EventSource`)  

---

## 0. 执行前提与参考

- 建议在独立 worktree 执行（见 `workflow-using-git-worktrees`）。
- 实施时强制使用：
  - `@workflow-test-driven-development`
  - `@workflow-verification-before-completion`
  - `@workflow-summary`
- 复用历史经验（必须在实现中引用）：
  - `docs/summaries/2026-03-04-async-tasks-refactor.md`
  - `docs/summaries/2026-03-04-pg-boss-usage-optimization.md`

---

### Task 1: 增加翻译会话/段落/事件数据表（Migration）

**Files:**

- Create: `src/server/db/migrations/0014_article_translation_sessions.sql`
- Create: `src/server/db/migrations/articleTranslationSessionsMigration.test.ts`

**Step 1: Write the failing test**

```ts
// src/server/db/migrations/articleTranslationSessionsMigration.test.ts
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('db migrations', () => {
  it('adds translation session/segment/event tables', () => {
    const migrationPath = 'src/server/db/migrations/0014_article_translation_sessions.sql';
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('create table if not exists article_translation_sessions');
    expect(sql).toContain('create table if not exists article_translation_segments');
    expect(sql).toContain('create table if not exists article_translation_events');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/server/db/migrations/articleTranslationSessionsMigration.test.ts`  
Expected: FAIL（migration 文件不存在或断言失败）

**Step 3: Write minimal implementation**

```sql
-- src/server/db/migrations/0014_article_translation_sessions.sql
create table if not exists article_translation_sessions (...);
create table if not exists article_translation_segments (...);
create table if not exists article_translation_events (...);
```

关键约束：

- `article_translation_sessions.article_id` 唯一
- `article_translation_segments` 唯一键 `(session_id, segment_index)`
- `article_translation_events.event_id` 使用 `bigserial`

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/server/db/migrations/articleTranslationSessionsMigration.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/db/migrations/0014_article_translation_sessions.sql src/server/db/migrations/articleTranslationSessionsMigration.test.ts
git commit -m "feat(db): 新增沉浸式翻译会话与段落事件表"
```

---

### Task 2: 实现翻译会话 Repository 与单测

**Files:**

- Create: `src/server/repositories/articleTranslationRepo.ts`
- Create: `src/server/repositories/articleTranslationRepo.test.ts`

**Step 1: Write the failing test**

```ts
// src/server/repositories/articleTranslationRepo.test.ts
import { describe, expect, it, vi } from 'vitest';

describe('articleTranslationRepo', () => {
  it('upsertSession stores running session with hash and counters', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const mod = await import('./articleTranslationRepo');
    await mod.upsertTranslationSession(pool as never, {
      articleId: 'a1',
      sourceHtmlHash: 'hash-1',
      status: 'running',
      totalSegments: 3,
      translatedSegments: 0,
      failedSegments: 0,
    });
    expect(pool.query).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/server/repositories/articleTranslationRepo.test.ts`  
Expected: FAIL（module not found / function not found）

**Step 3: Write minimal implementation**

```ts
// src/server/repositories/articleTranslationRepo.ts
export async function upsertTranslationSession(...) { ... }
export async function listTranslationSegmentsBySessionId(...) { ... }
export async function upsertTranslationSegment(...) { ... }
export async function insertTranslationEvent(...) { ... }
export async function listTranslationEventsAfter(...) { ... }
```

要求：

- SQL 显式维护 `updated_at = now()`
- `upsertTranslationSegment` 支持 `pending/running/succeeded/failed`
- 段落失败时记录 `error_code/error_message`

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/server/repositories/articleTranslationRepo.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/repositories/articleTranslationRepo.ts src/server/repositories/articleTranslationRepo.test.ts
git commit -m "feat(repo): 新增沉浸式翻译会话仓储接口"
```

---

### Task 3: 增加段落抽取与会话构建服务（仅主内容区指定标签）

**Files:**

- Create: `src/server/ai/immersiveTranslationSession.ts`
- Create: `src/server/ai/immersiveTranslationSession.test.ts`
- Modify: `src/server/ai/bilingualHtmlTranslator.ts`

**Step 1: Write the failing test**

```ts
// src/server/ai/immersiveTranslationSession.test.ts
import { describe, expect, it } from 'vitest';
import { extractImmersiveSegments } from './immersiveTranslationSession';

it('extracts only p/h1-h6/li/blockquote segments in source order', () => {
  const segments = extractImmersiveSegments('<article><h1>T</h1><p>A</p><td>X</td><li>B</li></article>');
  expect(segments.map((s) => s.tagName)).toEqual(['h1', 'p', 'li']);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/server/ai/immersiveTranslationSession.test.ts`  
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// src/server/ai/immersiveTranslationSession.ts
export const immersiveSelectors = ['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'] as const;
export function extractImmersiveSegments(html: string): ImmersiveSegment[] { ... }
export function hashSourceHtml(html: string): string { ... } // 使用 node:crypto sha256
```

实现要求：

- 复用现有文本规整逻辑（过滤空白、排除 `code/pre`）
- 返回稳定 `segmentIndex` 与 `domPath`

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/server/ai/immersiveTranslationSession.test.ts src/server/ai/bilingualHtmlTranslator.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/ai/immersiveTranslationSession.ts src/server/ai/immersiveTranslationSession.test.ts src/server/ai/bilingualHtmlTranslator.ts
git commit -m "feat(ai): 新增沉浸式段落抽取与内容哈希"
```

---

### Task 4: 扩展 ai-translate API 为会话创建/恢复 + 快照读取

**Files:**

- Modify: `src/app/api/articles/[id]/ai-translate/route.ts`
- Modify: `src/app/api/articles/routes.test.ts`

**Step 1: Write the failing test**

```ts
// src/app/api/articles/routes.test.ts
it('GET /:id/ai-translate returns session snapshot with segments', async () => {
  // mock getArticleById + session repo
  // expect json.data.session.status toBe('running')
});
```

新增用例：

- `POST` 首次创建会话返回 `sessionId`
- `POST` 已有运行中会话时幂等恢复
- `GET` 返回会话摘要 + 已有段落状态

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/app/api/articles/routes.test.ts -t "ai-translate returns session snapshot|create or resume session"`  
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// route.ts
export async function GET(...) { ... } // 返回快照
export async function POST(...) { ... } // 创建或恢复会话
```

兼容要求：

- 保留 `missing_api_key` / `body_translate_disabled` / `fulltext_pending`
- 继续写入 `article_tasks.ai_translate` queued/running/succeeded/failed 高层状态

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/app/api/articles/routes.test.ts -t "ai-translate"`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/articles/[id]/ai-translate/route.ts src/app/api/articles/routes.test.ts
git commit -m "feat(api): ai-translate 支持会话创建恢复与快照查询"
```

---

### Task 5: 增加段落重试接口

**Files:**

- Create: `src/app/api/articles/[id]/ai-translate/segments/[index]/retry/route.ts`
- Modify: `src/app/api/articles/routes.test.ts`

**Step 1: Write the failing test**

```ts
it('POST /:id/ai-translate/segments/:index/retry retries failed segment only', async () => {
  // mock failed segment -> expect enqueue single segment job
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/app/api/articles/routes.test.ts -t "segments/:index/retry"`  
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// retry route
export async function POST(...) {
  // validate index
  // ensure segment is failed
  // enqueue retry payload { articleId, sessionId, segmentIndex }
}
```

实现要求：

- 仅允许 `failed` 段触发重试
- 已 `succeeded` 段返回幂等 no-op

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/app/api/articles/routes.test.ts -t "retry"`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/articles/[id]/ai-translate/segments/[index]/retry/route.ts src/app/api/articles/routes.test.ts
git commit -m "feat(api): 新增沉浸式翻译单段重试接口"
```

---

### Task 6: 增加 SSE stream route（含 Last-Event-ID 补偿）

**Files:**

- Create: `src/app/api/articles/[id]/ai-translate/stream/route.ts`
- Create: `src/app/api/articles/[id]/ai-translate/stream/route.test.ts`

**Step 1: Write the failing test**

```ts
it('SSE stream replays events after Last-Event-ID', async () => {
  // expect response headers includes text/event-stream
  // expect replayed payload event_id > lastEventId
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/app/api/articles/[id]/ai-translate/stream/route.test.ts`  
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const lastEventId = request.headers.get('last-event-id');
  // 1) 回放历史事件
  // 2) 挂接实时事件
  // 3) 定时心跳 ": ping\n\n"
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/app/api/articles/[id]/ai-translate/stream/route.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/articles/[id]/ai-translate/stream/route.ts src/app/api/articles/[id]/ai-translate/stream/route.test.ts
git commit -m "feat(api): 新增 ai-translate SSE 流式事件接口"
```

---

### Task 7: worker 支持段落并发翻译 + 每段持久化 + 事件写入

**Files:**

- Modify: `src/worker/index.ts`
- Create: `src/worker/immersiveTranslateWorker.ts`
- Create: `src/worker/immersiveTranslateWorker.test.ts`
- Modify: `src/worker/articleTaskStatus.ts`

**Step 1: Write the failing test**

```ts
it('continues translating when one segment fails and marks session partial_failed', async () => {
  // mock 3 segments, second fails
  // expect segment 1/3 succeeded, 2 failed
  // expect session status partial_failed
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/worker/immersiveTranslateWorker.test.ts`  
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// immersiveTranslateWorker.ts
export async function runImmersiveTranslateSession(input: {...}) {
  // 并发上限例如 3
  // 每段完成 => upsert segment + insert event
  // 全局结束 => succeeded / partial_failed
}
```

实现要求：

- 并发翻译，展示顺序由 `segmentIndex` 保证
- 段落失败不抛出终止全局（仅记录）
- 系统级错误才将会话置为 `failed`

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/worker/immersiveTranslateWorker.test.ts src/worker/articleTaskStatus.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/worker/index.ts src/worker/immersiveTranslateWorker.ts src/worker/immersiveTranslateWorker.test.ts src/worker/articleTaskStatus.ts
git commit -m "feat(worker): 支持段落并发翻译与逐段事件持久化"
```

---

### Task 8: API Client 增加会话快照/重试/SSE 客户端能力

**Files:**

- Modify: `src/lib/apiClient.ts`
- Modify: `src/lib/apiClient.test.ts`

**Step 1: Write the failing test**

```ts
it('getArticleAiTranslateSnapshot GETs /api/articles/:id/ai-translate', async () => {});
it('retryArticleAiTranslateSegment POSTs /api/articles/:id/ai-translate/segments/:index/retry', async () => {});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/lib/apiClient.test.ts -t "AiTranslateSnapshot|retryArticleAiTranslateSegment"`  
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
export async function getArticleAiTranslateSnapshot(articleId: string): Promise<...> { ... }
export async function retryArticleAiTranslateSegment(articleId: string, segmentIndex: number): Promise<...> { ... }
export function createArticleAiTranslateEventSource(articleId: string): EventSource { ... }
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/lib/apiClient.test.ts -t "ai-translate"`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/apiClient.ts src/lib/apiClient.test.ts
git commit -m "feat(web-api): 补充沉浸式翻译快照与单段重试客户端"
```

---

### Task 9: ArticleView 接入 SSE 增量渲染（上原文下译文）

**Files:**

- Modify: `src/features/articles/ArticleView.tsx`
- Create: `src/features/articles/useImmersiveTranslation.ts`
- Modify: `src/features/articles/ArticleView.aiTranslate.test.tsx`
- Create: `src/features/articles/useImmersiveTranslation.test.ts`

**Step 1: Write the failing test**

```tsx
it('shows original first and appends translated paragraph below when SSE segment arrives', async () => {
  // render original paragraph
  // dispatch segment.succeeded event
  // assert translated paragraph appears below original
});
```

新增用例：

- 并发乱序事件到达时仍按 `segmentIndex` 稳定渲染
- 切换“原文/翻译”不丢已完成段
- 失败段显示“重试该段”按钮并触发 API

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/features/articles/ArticleView.aiTranslate.test.tsx src/features/articles/useImmersiveTranslation.test.ts`  
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// useImmersiveTranslation.ts
// 1) click translate -> POST create/resume + GET snapshot
// 2) connect EventSource stream
// 3) maintain map<segmentIndex, state>
```

```tsx
// ArticleView.tsx
// translation mode: render segment blocks
// <div className="ff-bilingual-block"><p className="ff-original">...</p><p className="ff-translation">...</p></div>
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/features/articles/ArticleView.aiTranslate.test.tsx src/features/articles/useImmersiveTranslation.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/articles/ArticleView.tsx src/features/articles/useImmersiveTranslation.ts src/features/articles/ArticleView.aiTranslate.test.tsx src/features/articles/useImmersiveTranslation.test.ts
git commit -m "feat(article-view): 实现沉浸式逐段翻译与顺序渲染"
```

---

### Task 10: 端到端契约回归与文档补充

**Files:**

- Modify: `src/app/api/articles/routes.test.ts`
- Modify: `docs/summaries/2026-03-04-async-tasks-refactor.md`（追加“沉浸式翻译”链接）
- Create: `docs/summaries/2026-03-04-immersive-translation.md`

**Step 1: Write the failing test**

```ts
it('ai-translate stream + snapshot + retry APIs keep existing reason semantics', async () => {
  // verify missing_api_key/fulltext_pending/body_translate_disabled not regressed
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit -- src/app/api/articles/routes.test.ts -t "ai-translate stream|reason semantics"`  
Expected: FAIL

**Step 3: Write minimal implementation**

实现内容：

- 修复回归并补齐 contract 断言
- 在 `docs/summaries` 记录：
  - 成功指标（首段出现耗时、失败段重试成功率）
  - 已知限制（仅主内容区、不支持整页翻译）

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit -- src/app/api/articles/routes.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/articles/routes.test.ts docs/summaries/2026-03-04-async-tasks-refactor.md docs/summaries/2026-03-04-immersive-translation.md
git commit -m "docs(translation): 补充沉浸式翻译验证结论与回归证据"
```

---

### Task 11: 全量验证与交付前检查

**Files:**

- Modify: `docs/plans/2026-03-04-immersive-translation-implementation-plan.md`（勾选完成项与偏差记录）

**Step 1: Write the failing check**

执行前先定义必须通过的验证命令清单（作为 gate）：

```bash
pnpm run test:unit -- src/server/db/migrations/articleTranslationSessionsMigration.test.ts
pnpm run test:unit -- src/server/repositories/articleTranslationRepo.test.ts
pnpm run test:unit -- src/app/api/articles/routes.test.ts
pnpm run test:unit -- src/app/api/articles/[id]/ai-translate/stream/route.test.ts
pnpm run test:unit -- src/worker/immersiveTranslateWorker.test.ts
pnpm run test:unit -- src/features/articles/ArticleView.aiTranslate.test.tsx
pnpm run test:unit
```

**Step 2: Run check to verify current state fails before full completion**

Run: 上述命令（在未全实现前应出现 FAIL）  
Expected: 至少一项 FAIL（证明 gate 有效）

**Step 3: Complete remaining fixes**

根据失败项最小修复，不扩 scope，不引入额外特性。

**Step 4: Run full verification**

Run: 上述命令完整执行  
Expected: 全部 PASS

**Step 5: Commit**

```bash
git add docs/plans/2026-03-04-immersive-translation-implementation-plan.md
git commit -m "chore(plan): 更新沉浸式翻译实施计划执行状态"
```

---

## 执行状态（2026-03-04）

### 任务完成记录

- [x] Task 1 `feat(db): 新增沉浸式翻译会话与段落事件表`
- [x] Task 2 `feat(repo): 新增沉浸式翻译会话仓储接口`
- [x] Task 3 `feat(ai): 新增沉浸式段落抽取与内容哈希`
- [x] Task 4 `feat(api): ai-translate 支持会话创建恢复与快照查询`
- [x] Task 5 `feat(api): 新增沉浸式翻译单段重试接口`
- [x] Task 6 `feat(api): 新增 ai-translate SSE 流式事件接口`
- [x] Task 7 `f301ce4` `feat(worker): 支持段落并发翻译与逐段事件持久化`
- [x] Task 8 `f6d2686` `feat(web-api): 补充沉浸式翻译快照与单段重试客户端`
- [x] Task 9 `5f0db54` `feat(article-view): 实现沉浸式逐段翻译与顺序渲染`
- [x] Task 10 `ce6373b` `docs(translation): 补充沉浸式翻译验证结论与回归证据`
- [x] Task 11 `chore(plan): 更新沉浸式翻译实施计划执行状态`（本次提交）

### Gate 验证结果

- `pnpm run test:unit -- src/server/db/migrations/articleTranslationSessionsMigration.test.ts` PASS
- `pnpm run test:unit -- src/server/repositories/articleTranslationRepo.test.ts` PASS
- `pnpm run test:unit -- src/app/api/articles/routes.test.ts` PASS
- `pnpm run test:unit -- 'src/app/api/articles/[id]/ai-translate/stream/route.test.ts'` PASS
- `pnpm run test:unit -- src/worker/immersiveTranslateWorker.test.ts` PASS
- `pnpm run test:unit -- src/features/articles/ArticleView.aiTranslate.test.tsx` PASS
- `pnpm run test:unit` PASS

### 偏差记录

- 计划文件在当前 worktree 初始不存在（主工作区为未跟踪文件）；Task 11 已将其纳入当前分支并补齐执行状态。
- 当前项目脚本下，`pnpm run test:unit -- <file>` 会触发全量 Vitest 运行；命令口径保持一致，结果均为 PASS。
- 已知 `act(...)` 与 `--localstorage-file` warning 仍存在，但不影响本计划 gate 判定。

## 交付检查清单（必须全部满足）

- [x] 仅翻译主内容区（无整页翻译开关）
- [x] 段落范围仅 `p + h1-h6 + li + blockquote`
- [x] 每段翻译完成即持久化
- [x] 前端稳定呈现“上原文、下译文”
- [x] 后端可并发翻译，前端按顺序展示
- [x] 切文后自动恢复（快照 + SSE）
- [x] 段落失败不阻断整篇，且支持单段重试
- [x] 兼容既有 `missing_api_key/fulltext_pending/body_translate_disabled` 语义

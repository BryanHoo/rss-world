# Cross-Source Duplicate Article Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: 由于仓库策略禁止 subagent，实现时使用 `superwork-executing-plans` 按任务顺序内联执行。步骤使用 checkbox (`- [ ]`) 语法跟踪。

**Goal:** 为文章过滤链路增加跨源重复 / 近似转载过滤，保留最早入库文章，默认隐藏重复项，并在 feed 的“查看已过滤文章”模式下可见。

**Architecture:** 在现有 `article.filter` worker 中新增“重复判定”子阶段，顺序放在关键词预过滤之后、全文抓取和 AI 过滤之前。后端通过 migration 与 `articlesRepo` 持久化重复判定元数据，`articleDuplicateService` 负责标准化、候选召回与内容指纹判定，前端继续复用 `includeFiltered` 读取逻辑，并补充重复过滤原因文案。

**Tech Stack:** Next.js 16、React 19、TypeScript、Zustand、Vitest、PostgreSQL、pg、pg-boss、pnpm

---

## Relevant Summaries

- 未命中可复用 summary；按现有 `article.filter`、`reader snapshot` 和已过滤视图的代码结构直接规划。

## Planned File Structure

- `src/server/db/migrations/0024_article_duplicate_filtering.sql`
  责任：为 `articles` 增加重复判定列、约束和索引。
- `src/server/db/migrations/articleDuplicateFilteringMigration.test.ts`
  责任：锁定 migration 中的新列、约束与索引。
- `src/server/repositories/articlesRepo.ts`
  责任：扩展 `ArticleRow` 的 `fetchedAt` 与重复判定字段，提供候选查询与重复过滤结果写入。
- `src/server/repositories/articlesRepo.filtering.test.ts`
  责任：锁定过滤结果更新 SQL 对重复元数据的写入契约。
- `src/server/repositories/articlesRepo.duplicate.test.ts`
  责任：覆盖 `72 小时` 候选召回、最早代表排序和窗口排除逻辑。
- `src/server/services/articleDuplicateService.ts`
  责任：实现标题 / 链接标准化、候选文本选择、内容指纹生成，以及“纯判定函数 + repo orchestrator”两层重复判定接口。
- `src/server/services/articleDuplicateService.test.ts`
  责任：锁定 `same_normalized_url`、`same_title`、`similar_content`、短文本跳过和窗口外排除行为。
- `src/worker/articleFilterWorker.ts`
  责任：把重复判定接入关键词预过滤之后，并在命中时提前结束后续高成本流程。
- `src/worker/articleFilterWorker.test.ts`
  责任：覆盖重复命中时的提前退出、元数据写入和未命中时的正常后续链路。
- `src/server/services/readerSnapshotService.test.ts`
  责任：补回归测试，锁定 feed `includeFiltered` 模式下重复过滤文章仍可进入中栏。
- `src/features/articles/ArticleList.tsx`
  责任：在中栏列表中为 `filteredBy.includes('duplicate')` 的文章显示更具体的已过滤原因。
- `src/features/articles/ArticleList.test.tsx`
  责任：覆盖重复过滤文章在 card / list 模式下的原因文案。
- `src/features/articles/ArticleView.tsx`
  责任：在右栏文章元信息区为重复过滤文章显示原因文案。
- `src/features/articles/ArticleView.titleLink.test.tsx`
  责任：覆盖右栏过滤 badge / 文案在重复过滤场景下的展示。

### Task 1: 扩展数据库结构与仓库契约

**Files:**
- Create: `src/server/db/migrations/0024_article_duplicate_filtering.sql`
- Create: `src/server/db/migrations/articleDuplicateFilteringMigration.test.ts`
- Modify: `src/server/repositories/articlesRepo.ts`
- Modify: `src/server/repositories/articlesRepo.filtering.test.ts`
- Create: `src/server/repositories/articlesRepo.duplicate.test.ts`
- Check: `docs/superwork/specs/2026-03-22-article-duplicate-filter-design.md`

- [ ] **Step 1: 先写 migration 和仓库失败测试**

```ts
it('adds duplicate filtering columns and indexes', () => {
  const sql = readFileSync('src/server/db/migrations/0024_article_duplicate_filtering.sql', 'utf8');
  expect(sql).toContain('normalized_title');
  expect(sql).toContain('normalized_link');
  expect(sql).toContain('content_fingerprint');
  expect(sql).toContain('duplicate_of_article_id');
  expect(sql).toContain('duplicate_reason');
  expect(sql).toContain('duplicate_checked_at');
});

it('setArticleFilterResult updates duplicate filtering metadata fields', async () => {
  await mod.setArticleFilterResult(pool, 'a1', {
    filterStatus: 'filtered',
    isFiltered: true,
    filteredBy: ['duplicate'],
    duplicateOfArticleId: 'a0',
    duplicateReason: 'same_normalized_url',
    duplicateScore: 1,
  });

  expect(sql).toContain('duplicate_of_article_id = $');
  expect(sql).toContain('duplicate_reason = $');
  expect(sql).toContain('duplicate_score = $');
  expect(sql).toContain('duplicate_checked_at = now()');
});
```

- [ ] **Step 2: 运行 migration 与仓库单测，确认契约尚未实现**

Run: `pnpm test:unit -- src/server/db/migrations/articleDuplicateFilteringMigration.test.ts src/server/repositories/articlesRepo.filtering.test.ts src/server/repositories/articlesRepo.duplicate.test.ts`
Expected: FAIL，提示 migration 文件缺失，且仓库 SQL 尚未包含重复判定字段或候选查询方法。

- [ ] **Step 3: 以最小实现补齐 schema 和仓库层**

```ts
export interface ArticleRow {
  fetchedAt: string;
  normalizedTitle: string | null;
  normalizedLink: string | null;
  contentFingerprint: string | null;
  duplicateOfArticleId: string | null;
  duplicateReason: 'same_normalized_url' | 'same_title' | 'similar_content' | null;
  duplicateScore: number | null;
  duplicateCheckedAt: string | null;
}

export async function listArticleDuplicateCandidates(
  pool: DbClient,
  input: { articleId: string; publishedAt: string | null; fetchedAt: string },
): Promise<ArticleRow[]> {
  // 仅召回 72 小时窗口内、当前文章之前已存在的候选，按最早入库顺序返回
}
```

实现要求：

- migration 新增 `normalized_title`、`normalized_link`、`content_fingerprint`、`duplicate_of_article_id`、`duplicate_reason`、`duplicate_score`、`duplicate_checked_at`
- 为 `duplicate_reason` 增加约束，限定为 `same_normalized_url` / `same_title` / `similar_content`
- 为窗口查询补索引，至少覆盖 `published_at` 和 `normalized_link`
- `ArticleRow` 与 `getArticleById()` / `insertArticleIgnoreDuplicate()` / `setArticleFilterPending()` / `setArticleFilterResult()` 全部带上新字段
- `setArticleFilterPending()` 必须清空上一次重复判定元数据，避免重跑残留
- 候选查询使用 `coalesce(published_at, fetched_at)` 做 `72 小时` 窗口判断，并按最早入库顺序返回
- 在候选 SQL 前加简短注释，解释为何只能比较当前文章之前已存在的记录

- [ ] **Step 4: 重跑仓库相关单测并执行构建验证**

Run: `pnpm test:unit -- src/server/db/migrations/articleDuplicateFilteringMigration.test.ts src/server/repositories/articlesRepo.filtering.test.ts src/server/repositories/articlesRepo.duplicate.test.ts`
Expected: PASS

Run: `pnpm build`
Expected: PASS

- [ ] **Step 5: 提交 schema / repo 改动**

```bash
git add src/server/db/migrations/0024_article_duplicate_filtering.sql src/server/db/migrations/articleDuplicateFilteringMigration.test.ts src/server/repositories/articlesRepo.ts src/server/repositories/articlesRepo.filtering.test.ts src/server/repositories/articlesRepo.duplicate.test.ts
git commit -m "feat(article-duplicate): 添加重复过滤仓库元数据" -m "- 添加重复判定字段、约束和窗口查询索引
- 更新 articlesRepo 读写契约并暴露候选召回方法
- 锁定 migration 与仓库 SQL 回归测试"
```

### Task 2: 实现重复判定服务

**Files:**
- Create: `src/server/services/articleDuplicateService.ts`
- Create: `src/server/services/articleDuplicateService.test.ts`
- Reuse: `src/server/repositories/articlesRepo.ts`
- Check: `docs/superwork/specs/2026-03-22-article-duplicate-filter-design.md`

- [ ] **Step 1: 先写重复判定服务失败测试**

```ts
it('matches same normalized url before content comparison', async () => {
  const result = await findDuplicateCandidate({
    article,
    candidates: [candidate],
  });

  expect(result).toEqual(
    expect.objectContaining({
      matched: true,
      duplicateOfArticleId: candidate.id,
      duplicateReason: 'same_normalized_url',
      duplicateScore: 1,
    }),
  );
});

it('skips similar_content when normalized text is too short', async () => {
  const result = await findDuplicateCandidate({
    article: makeArticle({ contentHtml: '<p>短讯</p>' }),
    candidates: [candidate],
  });

  expect(result.matched).toBe(false);
  expect(result.contentFingerprint).toBeNull();
});
```

- [ ] **Step 2: 运行服务单测，确认标准化和判定逻辑尚未实现**

Run: `pnpm test:unit -- src/server/services/articleDuplicateService.test.ts`
Expected: FAIL，提示 `findDuplicateCandidate`、标准化函数或内容指纹逻辑不存在。

- [ ] **Step 3: 用最小实现补齐标准化与两阶段判定**

```ts
export interface ArticleDuplicateMatchResult {
  matched: boolean;
  duplicateOfArticleId: string | null;
  duplicateReason: 'same_normalized_url' | 'same_title' | 'similar_content' | null;
  duplicateScore: number | null;
  normalizedTitle: string | null;
  normalizedLink: string | null;
  contentFingerprint: string | null;
}

export function findDuplicateCandidate(input: {
  article: ArticleRow;
  candidates: ArticleRow[];
}): ArticleDuplicateMatchResult {
  // 先做 same_normalized_url / same_title，再在满足最小文本长度时执行 similar_content
}

export async function evaluateArticleDuplicate(input: {
  pool: DbClient;
  article: ArticleRow;
}): Promise<ArticleDuplicateMatchResult> {
  const candidates = await listArticleDuplicateCandidates(input.pool, input.article);
  return findDuplicateCandidate({ article: input.article, candidates });
}
```

实现要求：

- 标题标准化统一大小写、空白与常见标点
- 链接标准化移除常见追踪参数，保留可区分正文的路径和查询参数
- 候选文本优先级为 `contentFullHtml -> contentHtml -> title + summary`
- 指纹实现保持纯函数，返回稳定十六进制字符串，避免引入外部依赖
- 文本低于最小长度门槛时，跳过 `similar_content`
- `same_normalized_url` 和 `same_title` 命中后直接返回，不再继续内容比较
- 命中多个候选时，始终返回列表中最早的候选
- repo orchestrator 只负责拉取候选并复用纯判定函数，不要把标准化逻辑分散到仓库层
- 仅在复杂标准化或指纹计算前补 1 条简短注释，不要堆无效注释

- [ ] **Step 4: 重跑服务单测并执行构建验证**

Run: `pnpm test:unit -- src/server/services/articleDuplicateService.test.ts`
Expected: PASS

Run: `pnpm build`
Expected: PASS

- [ ] **Step 5: 提交重复判定服务**

```bash
git add src/server/services/articleDuplicateService.ts src/server/services/articleDuplicateService.test.ts src/server/repositories/articlesRepo.ts
git commit -m "feat(article-duplicate): 添加重复判定服务" -m "- 添加标题、链接和正文标准化与内容指纹逻辑
- 实现 same_normalized_url、same_title 和 similar_content 两阶段判定
- 锁定短文本跳过与最早代表选择的服务测试"
```

### Task 3: 把重复判定接入文章过滤 worker

**Files:**
- Modify: `src/worker/articleFilterWorker.ts`
- Modify: `src/worker/articleFilterWorker.test.ts`
- Reuse: `src/server/services/articleDuplicateService.ts`
- Reuse: `src/server/repositories/articlesRepo.ts`

- [ ] **Step 1: 先写 worker 失败测试，锁定重复命中后的提前退出**

```ts
it('writes duplicate filtered result before fulltext and ai work', async () => {
  const evaluateArticleDuplicate = vi.fn().mockResolvedValue({
    matched: true,
    duplicateOfArticleId: 'a0',
    duplicateReason: 'similar_content',
    duplicateScore: 0.93,
    normalizedTitle: 'same title',
    normalizedLink: 'https://example.com/post',
    contentFingerprint: 'abcd1234',
  });

  await runArticleFilterWorker({ ...input, deps: { evaluateArticleDuplicate } });

  expect(setArticleFilterResult).toHaveBeenCalledWith(
    pool,
    'a1',
    expect.objectContaining({
      filterStatus: 'filtered',
      filteredBy: ['duplicate'],
      duplicateOfArticleId: 'a0',
      duplicateReason: 'similar_content',
    }),
  );
  expect(fetchFulltextAndStore).not.toHaveBeenCalled();
  expect(enqueueAutoAiTriggersOnFetch).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行 worker 单测，确认重复阶段尚未接入**

Run: `pnpm test:unit -- src/worker/articleFilterWorker.test.ts`
Expected: FAIL，提示缺少重复判定依赖、写入参数或提前退出行为。

- [ ] **Step 3: 最小改动接入重复阶段**

```ts
const duplicateResult = await deps.evaluateArticleDuplicate({
  pool: input.pool,
  article,
});

if (duplicateResult.matched) {
  await deps.setArticleFilterResult(input.pool, article.id, {
    filterStatus: 'filtered',
    isFiltered: true,
    filteredBy: ['duplicate'],
    duplicateOfArticleId: duplicateResult.duplicateOfArticleId,
    duplicateReason: duplicateResult.duplicateReason,
    duplicateScore: duplicateResult.duplicateScore,
    normalizedTitle: duplicateResult.normalizedTitle,
    normalizedLink: duplicateResult.normalizedLink,
    contentFingerprint: duplicateResult.contentFingerprint,
  });
  return;
}
```

实现要求：

- 重复阶段放在关键词预过滤之后、全文抓取之前
- 命中重复时直接返回，不再继续全文抓取、AI 过滤、AI 摘要和标题翻译
- 未命中重复时，也要持久化 `normalizedTitle`、`normalizedLink`、`contentFingerprint` 与 `duplicateCheckedAt`
- 发生异常时继续沿用现有 `filterStatus = 'error'` 逻辑
- worker 依赖注入保持现有测试风格，避免把 repo 细节塞进测试

- [ ] **Step 4: 重跑 worker 单测并执行构建验证**

Run: `pnpm test:unit -- src/worker/articleFilterWorker.test.ts`
Expected: PASS

Run: `pnpm build`
Expected: PASS

- [ ] **Step 5: 提交 worker 接入改动**

```bash
git add src/worker/articleFilterWorker.ts src/worker/articleFilterWorker.test.ts src/server/services/articleDuplicateService.ts src/server/repositories/articlesRepo.ts
git commit -m "feat(article-filter): 接入重复文章过滤阶段" -m "- 在关键词预过滤后接入跨源重复判定
- 命中重复时提前结束全文抓取和 AI 后续任务
- 锁定重复过滤元数据写入与提前退出回归测试"
```

### Task 4: 补已过滤视图与重复原因展示

**Files:**
- Modify: `src/server/services/readerSnapshotService.test.ts`
- Modify: `src/features/articles/ArticleList.tsx`
- Modify: `src/features/articles/ArticleList.test.tsx`
- Modify: `src/features/articles/ArticleView.tsx`
- Modify: `src/features/articles/ArticleView.titleLink.test.tsx`

- [ ] **Step 1: 先写前端与 snapshot 回归测试**

```ts
it('keeps duplicate filtered articles visible when includeFiltered is enabled for a feed', () => {
  const filter = buildArticleFilter({ view: 'feed-id-1', includeFiltered: true });
  expect(filter.params[1]).toEqual(['passed', 'error', 'filtered']);
});

it('shows duplicate filter reason in article cards', async () => {
  render(<ArticleList />);
  expect(screen.getByText('已过滤 · 重复/相似转载')).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行相关测试，确认重复原因文案尚未实现**

Run: `pnpm test:unit -- src/server/services/readerSnapshotService.test.ts src/features/articles/ArticleList.test.tsx src/features/articles/ArticleView.titleLink.test.tsx`
Expected: FAIL，提示列表或右栏尚未展示 `duplicate` 的具体过滤原因。

- [ ] **Step 3: 以最小 UI 改动补齐重复原因展示**

```ts
function getFilteredReasonLabel(filteredBy: string[]) {
  if (filteredBy.includes('duplicate')) return '已过滤 · 重复/相似转载';
  if (filteredBy.includes('keyword')) return '已过滤 · 关键词';
  if (filteredBy.includes('ai')) return '已过滤 · AI';
  return '已过滤';
}
```

实现要求：

- 中栏和右栏都继续基于现有 `filterStatus` / `isFiltered` / `filteredBy` 渲染，不新增 API
- `duplicate` 文案只在对应场景展示，其他过滤原因不要退化成模糊的统一 badge
- 不改动 `includeFiltered` 请求参数或 appStore 逻辑，只新增回归测试锁定现有行为
- 保持现有 badge 样式，不做新的复杂交互

- [ ] **Step 4: 重跑前端与 snapshot 测试并执行构建验证**

Run: `pnpm test:unit -- src/server/services/readerSnapshotService.test.ts src/features/articles/ArticleList.test.tsx src/features/articles/ArticleView.titleLink.test.tsx`
Expected: PASS

Run: `pnpm build`
Expected: PASS

- [ ] **Step 5: 提交可见性与文案改动**

```bash
git add src/server/services/readerSnapshotService.test.ts src/features/articles/ArticleList.tsx src/features/articles/ArticleList.test.tsx src/features/articles/ArticleView.tsx src/features/articles/ArticleView.titleLink.test.tsx
git commit -m "feat(reader): 展示重复过滤原因" -m "- 在已过滤文章模式中展示重复或相似转载原因
- 锁定 feed includeFiltered 下重复过滤文章的可见性回归
- 保持现有快照读取与 badge 交互结构不变"
```

### Task 5: 运行整体验证

**Files:**
- Verify: `src/server/db/migrations/0024_article_duplicate_filtering.sql`
- Verify: `src/server/repositories/articlesRepo.ts`
- Verify: `src/server/services/articleDuplicateService.ts`
- Verify: `src/worker/articleFilterWorker.ts`
- Verify: `src/features/articles/ArticleList.tsx`
- Verify: `src/features/articles/ArticleView.tsx`

- [ ] **Step 1: 运行本次相关单测**

Run: `pnpm test:unit -- src/server/db/migrations/articleDuplicateFilteringMigration.test.ts src/server/repositories/articlesRepo.filtering.test.ts src/server/repositories/articlesRepo.duplicate.test.ts src/server/services/articleDuplicateService.test.ts src/worker/articleFilterWorker.test.ts src/server/services/readerSnapshotService.test.ts src/features/articles/ArticleList.test.tsx src/features/articles/ArticleView.titleLink.test.tsx`
Expected: PASS

- [ ] **Step 2: 运行完整构建验证**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: 检查工作区只包含预期改动**

Run: `git status --short`
Expected: 只看到本次重复过滤相关文件变更，无意外文件被修改。

# OPML Import Export Implementation Plan

> **For agentic workers:** REQUIRED: Use workflow-subagent-driven-development (if subagents available) or workflow-executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在“设置 > RSS”中交付标准 OPML 导入导出能力，保留 `title`、`xmlUrl`、分类，导入支持部分成功摘要，且不会触发批量抓取。

**Architecture:** 服务端新增纯 OPML 文档模块与导入导出编排服务，再通过 `POST /api/opml/import` 和 `GET /api/opml/export` 暴露能力。前端通过 `src/lib/apiClient.ts` 增加专用 helper，并在设置中心用局部状态接入导入结果与导出下载，避免复用 `useAppStore.addFeed` 的单条新增抓取语义。

**Tech Stack:** Next.js Route Handlers, TypeScript, Vitest, Zod, JSDOM, ky, pg repositories/services, Zustand

---

## Context To Carry Forward

- 已确认的 spec 在 `docs/superpowers/specs/2026-03-12-opml-import-export-design.md`，实现不得偏离以下约束：
  - 仅保留 `title`、`xmlUrl`、分类
  - 重复 URL 默认跳过
  - 导入后只 reload snapshot，不自动调用 `refreshFeed`
  - 仅 XML/OPML 结构损坏时整份失败；空 OPML 和“全部条目都被跳过”都返回结构化结果
- `src/store/appStore.ts` 的 `addFeed()` 会自动触发 `refreshFeed()` 和 snapshot 轮询；OPML 批量导入禁止复用它。
- `src/lib/apiClient.ts` 的 `requestApi()` 只适合 JSON envelope；OPML 导出应走专用 text/XML helper，不要为了一个下载接口把整套 client 过度泛化。
- `docs/summaries/2026-03-11-accessible-name-token-leak.md` 已记录无障碍回归：新增按钮、文件输入触发器、测试断言都必须使用中文用户文案，不能再把内部 token 写进 `aria-label`。
- 现有分类规则已经集中在 `src/server/services/feedCategoryLifecycleService.ts`，导入逻辑必须复用它，不要在 OPML service 中复制“分类名去重、空分类清理”实现。
- 无需新增数据库 migration；现有 `feeds`、`categories` 结构足够支撑本功能。
- 参考技能：`@vitest` 用于测试分解，`@nodejs-best-practices` 用于服务端模块边界。

## File Map

### Create

- `src/server/opml/opmlDocument.ts`
  - 纯函数：解析标准 OPML 为内部条目列表，并将 feed/category 数据序列化回 OPML XML
- `src/server/opml/opmlDocument.test.ts`
  - 纯文档层单测，不接数据库
- `src/server/services/opmlService.ts`
  - 编排导入/导出，负责去重、调用 repository/lifecycle service、汇总结果
- `src/server/services/opmlService.test.ts`
  - mock `listFeeds` / `listCategories` / `createFeedWithCategoryResolution`，覆盖导入导出结果 contract
- `src/app/api/opml/import/route.ts`
  - `POST /api/opml/import`，解析 JSON body，调用 import service，返回 JSON envelope
- `src/app/api/opml/import/route.test.ts`
  - route contract 测试
- `src/app/api/opml/export/route.ts`
  - `GET /api/opml/export`，返回 XML `Response`
- `src/app/api/opml/export/route.test.ts`
  - route 响应头与 XML body 测试
- `src/features/settings/panels/OpmlTransferSection.tsx`
  - RSS 设置面板中的 OPML 导入导出区块，负责按钮、文件选择、最近一次结果摘要
- `src/features/settings/panels/OpmlTransferSection.test.tsx`
  - 组件级交互测试，验证中文可访问名称、文件选择与摘要呈现

### Modify

- `src/lib/apiClient.ts`
  - 增加 `importOpml()` 与 `exportOpml()` helper
- `src/lib/apiClient.test.ts`
  - 增加 client helper 测试
- `src/features/settings/panels/RssSettingsPanel.tsx`
  - 组合新的 `OpmlTransferSection`
- `src/features/settings/SettingsCenterDrawer.tsx`
  - 持有导入结果和进行中的状态；成功导入后触发 `loadSnapshot({ view: selectedView })`
- `src/features/settings/SettingsCenterModal.test.tsx`
  - 设置中心集成回归：RSS 标签页导入成功后展示摘要并刷新 snapshot

### Reuse Without Modification

- `src/server/services/feedCategoryLifecycleService.ts`
- `src/server/repositories/feedsRepo.ts`
- `src/server/repositories/categoriesRepo.ts`
- `src/server/http/apiResponse.ts`
- `src/server/http/errors.ts`

## Chunk 1: Server OPML Core

### Task 1: Pure OPML 文档解析与导出

**Files:**

- Create: `src/server/opml/opmlDocument.ts`
- Test: `src/server/opml/opmlDocument.test.ts`

- [ ] **Step 1: 先写纯文档层失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { buildOpmlDocument, parseOpmlDocument } from './opmlDocument';

describe('parseOpmlDocument', () => {
  it('uses the nearest outline ancestor as category and falls back title to xmlUrl', () => {
    const parsed = parseOpmlDocument(`
      <?xml version="1.0"?>
      <opml version="2.0">
        <body>
          <outline text="Top">
            <outline text="Leaf">
              <outline xmlUrl="https://example.com/feed.xml" />
            </outline>
          </outline>
        </body>
      </opml>
    `);

    expect(parsed.entries).toEqual([
      {
        title: 'https://example.com/feed.xml',
        xmlUrl: 'https://example.com/feed.xml',
        category: 'Leaf',
      },
    ]);
  });

  it('keeps invalid or duplicate candidates in structured buckets instead of throwing', () => {
    const parsed = parseOpmlDocument(`
      <?xml version="1.0"?>
      <opml version="2.0">
        <body>
          <outline xmlUrl="notaurl" text="Bad" />
          <outline xmlUrl="https://example.com/feed.xml" text="One" />
          <outline xmlUrl="https://example.com/feed.xml" text="Two" />
        </body>
      </opml>
    `);

    expect(parsed.entries).toHaveLength(1);
    expect(parsed.invalidItems[0]?.reason).toBe('invalid_url');
    expect(parsed.duplicateItems[0]?.xmlUrl).toBe('https://example.com/feed.xml');
  });
});

describe('buildOpmlDocument', () => {
  it('serializes categorized feeds before uncategorized feeds in deterministic order', () => {
    const xml = buildOpmlDocument({
      title: 'FeedFuse Subscriptions',
      categories: [{ id: 'cat-tech', name: 'Tech', position: 0 }],
      feeds: [
        { id: 'feed-1', title: 'Alpha', url: 'https://example.com/a.xml', siteUrl: null, categoryId: 'cat-tech' },
        { id: 'feed-2', title: 'Beta', url: 'https://example.com/b.xml', siteUrl: 'https://example.com', categoryId: null },
      ],
    });

    expect(xml).toContain('<opml version="2.0">');
    expect(xml).toContain('xmlUrl="https://example.com/a.xml"');
    expect(xml).toContain('htmlUrl="https://example.com/"');
    expect(xml.indexOf('text="Tech"')).toBeLessThan(xml.indexOf('text="Beta"'));
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test:unit src/server/opml/opmlDocument.test.ts`
Expected: FAIL，提示 `./opmlDocument` 不存在或导出缺失

- [ ] **Step 3: 用最小实现补齐纯函数模块**

```ts
import { JSDOM } from 'jsdom';

export interface ParsedOpmlEntry {
  title: string;
  xmlUrl: string;
  category: string | null;
}

export interface ParsedOpmlDocument {
  entries: ParsedOpmlEntry[];
  invalidItems: Array<{ title: string | null; xmlUrl: string | null; reason: 'missing_xml_url' | 'invalid_url' }>;
  duplicateItems: Array<{ title: string; xmlUrl: string; reason: 'duplicate_in_file' }>;
}

export function parseOpmlDocument(xml: string): ParsedOpmlDocument {
  const dom = new JSDOM(xml, { contentType: 'text/xml' });
  // walk <outline> recursively
  // collect feed entries, nearest ancestor category, invalid items, in-file duplicates
}

export function buildOpmlDocument(input: {
  title: string;
  categories: Array<{ id: string; name: string; position: number }>;
  feeds: Array<{ id: string; title: string; url: string; siteUrl: string | null; categoryId: string | null }>;
}): string {
  // deterministic category order, categorized feeds first, uncategorized last
}
```

Implementation notes:

- 使用 `JSDOM(..., { contentType: 'text/xml' })` 解析 XML，避免为了 OPML 再引入新依赖。
- 明确区分“文档级错误抛异常”和“条目级错误进入结果桶”。
- `buildOpmlDocument()` 内自行做 XML escaping，至少覆盖 `& < > " '`。
- 不要在本层做数据库去重；这里只负责文档与条目标准化。

- [ ] **Step 4: 再跑同一组测试确认通过**

Run: `pnpm test:unit src/server/opml/opmlDocument.test.ts`
Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add src/server/opml/opmlDocument.ts src/server/opml/opmlDocument.test.ts
git commit -m "feat(opml): 添加 OPML 文档解析与导出" -m "- 添加纯函数 OPML 解析与序列化模块\n- 约束多层分类与空标题的标准化规则\n- 补齐 OPML 文档层单元测试"
```

### Task 2: OPML 导入导出服务编排

**Files:**

- Create: `src/server/services/opmlService.ts`
- Test: `src/server/services/opmlService.test.ts`
- Read: `src/server/services/feedCategoryLifecycleService.ts`
- Read: `src/server/repositories/feedsRepo.ts`
- Read: `src/server/repositories/categoriesRepo.ts`

- [ ] **Step 1: 先写 service 层失败测试**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportOpml, importOpml } from './opmlService';

describe('importOpml', () => {
  it('returns a structured success result when the document is valid but empty', async () => {
    const result = await importOpml(pool, { content: '<?xml version="1.0"?><opml version="2.0"><body /></opml>' });
    expect(result).toMatchObject({
      importedCount: 0,
      duplicateCount: 0,
      invalidCount: 0,
      createdCategoryCount: 0,
    });
  });

  it('skips existing feed urls and only creates new feeds through createFeedWithCategoryResolution', async () => {
    listFeedsMock.mockResolvedValue([{ id: 'feed-1', title: 'Existing', url: 'https://example.com/a.xml', siteUrl: null, iconUrl: null, enabled: true, fullTextOnOpenEnabled: false, aiSummaryOnOpenEnabled: false, aiSummaryOnFetchEnabled: false, bodyTranslateOnFetchEnabled: false, bodyTranslateOnOpenEnabled: false, titleTranslateEnabled: false, bodyTranslateEnabled: false, articleListDisplayMode: 'card', categoryId: null, fetchIntervalMinutes: 30, lastFetchStatus: null, lastFetchError: null }]);

    const result = await importOpml(pool, { content: VALID_OPML });

    expect(createFeedWithCategoryResolutionMock).toHaveBeenCalledTimes(1);
    expect(result.duplicateCount).toBe(1);
    expect(result.importedCount).toBe(1);
  });
});

describe('exportOpml', () => {
  it('builds XML from current feeds and categories and returns a stable filename', async () => {
    const result = await exportOpml(pool);
    expect(result.fileName).toBe('feedfuse-subscriptions.opml');
    expect(result.xml).toContain('<opml version="2.0">');
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test:unit src/server/services/opmlService.test.ts`
Expected: FAIL，提示 `./opmlService` 不存在或 mocked dependency 未被调用

- [ ] **Step 3: 实现 service 编排**

```ts
import type { Pool } from 'pg';
import { listCategories } from '../repositories/categoriesRepo';
import { listFeeds } from '../repositories/feedsRepo';
import { buildOpmlDocument, parseOpmlDocument } from '../opml/opmlDocument';
import { createFeedWithCategoryResolution } from './feedCategoryLifecycleService';

export interface OpmlImportResult {
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
  createdCategoryCount: number;
  duplicates: Array<{ title: string; xmlUrl: string; reason: 'duplicate_in_file' | 'duplicate_in_db' }>;
  invalidItems: Array<{ title: string | null; xmlUrl: string | null; reason: 'missing_xml_url' | 'invalid_url' }>;
}

export async function importOpml(pool: Pool, input: { content: string }): Promise<OpmlImportResult> {
  // 1. parse document
  // 2. build existing URL set from listFeeds()
  // 3. build existing category name set from listCategories()
  // 4. create new feeds via createFeedWithCategoryResolution()
  // 5. track created categories only when category name was absent before the create
  // 6. return structured result without refreshing feeds
}

export async function exportOpml(pool: Pool): Promise<{ xml: string; fileName: string }> {
  const [categories, feeds] = await Promise.all([listCategories(pool), listFeeds(pool)]);
  return {
    xml: buildOpmlDocument({ title: 'FeedFuse Subscriptions', categories, feeds }),
    fileName: 'feedfuse-subscriptions.opml',
  };
}
```

Implementation notes:

- 空 OPML 和“全部条目被跳过”返回成功结果，不能抛 `ValidationError`。
- `createdCategoryCount` 只统计这次导入中新建的分类；不要用最终分类总数减旧值的粗糙算法。
- `importOpml()` 内直接调用 `createFeedWithCategoryResolution()`，不要先手写分类查找/创建 SQL。
- 同文件重复与数据库重复都要进入 `duplicates`，但 `reason` 要区分，方便 UI 后续扩展。

- [ ] **Step 4: 运行 service 测试确认通过**

Run: `pnpm test:unit src/server/services/opmlService.test.ts`
Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add src/server/services/opmlService.ts src/server/services/opmlService.test.ts
git commit -m "feat(opml): 添加 OPML 导入导出服务" -m "- 编排文档解析、URL 去重与分类落库流程\n- 复用现有分类生命周期服务创建订阅与分类\n- 返回可供 UI 展示的结构化导入结果"
```

## Chunk 2: HTTP Surface And Client Transport

### Task 3: `POST /api/opml/import` route

**Files:**

- Create: `src/app/api/opml/import/route.ts`
- Test: `src/app/api/opml/import/route.test.ts`

- [ ] **Step 1: 先写 import route 的失败测试**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('/api/opml/import', () => {
  it('returns validation_error when content is empty', async () => {
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/opml/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    }));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      ok: false,
      error: { code: 'validation_error' },
    });
  });

  it('returns the service result in the standard ok envelope', async () => {
    importOpmlMock.mockResolvedValue({ importedCount: 2, duplicateCount: 1, invalidCount: 0, createdCategoryCount: 1, duplicates: [], invalidItems: [] });
    const mod = await import('./route');
    const res = await mod.POST(new Request('http://localhost/api/opml/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: VALID_OPML, fileName: 'feeds.opml' }),
    }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, data: { importedCount: 2 } });
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test:unit src/app/api/opml/import/route.test.ts`
Expected: FAIL，提示 route 模块不存在

- [ ] **Step 3: 实现 route**

```ts
import { z } from 'zod';
import { getPool } from '../../../../server/db/pool';
import { ok, fail } from '../../../../server/http/apiResponse';
import { ValidationError } from '../../../../server/http/errors';
import { importOpml } from '../../../../server/services/opmlService';

const bodySchema = z.object({
  content: z.string().trim().min(1),
  fileName: z.string().trim().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return fail(new ValidationError('Invalid request body', { content: 'required' }));
    }

    const result = await importOpml(getPool(), parsed.data);
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
```

Implementation notes:

- 不要在 route 重复写 OPML 业务规则；只做 body 校验和错误 envelope 映射。
- 若 service 抛出 `ValidationError`，应保持 `fail(err)` 路径，不自行拼 JSON。

- [ ] **Step 4: 运行 route 测试确认通过**

Run: `pnpm test:unit src/app/api/opml/import/route.test.ts`
Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add src/app/api/opml/import/route.ts src/app/api/opml/import/route.test.ts
git commit -m "feat(opml): 添加 OPML 导入接口" -m "- 新增 POST /api/opml/import route handler\n- 复用统一 API envelope 与验证错误映射\n- 补齐导入接口 contract 测试"
```

### Task 4: `GET /api/opml/export` route

**Files:**

- Create: `src/app/api/opml/export/route.ts`
- Test: `src/app/api/opml/export/route.test.ts`

- [ ] **Step 1: 先写 export route 的失败测试**

```ts
describe('/api/opml/export', () => {
  it('returns xml with content-disposition attachment headers', async () => {
    exportOpmlMock.mockResolvedValue({
      xml: '<?xml version="1.0"?><opml version="2.0"></opml>',
      fileName: 'feedfuse-subscriptions.opml',
    });

    const mod = await import('./route');
    const res = await mod.GET();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/xml');
    expect(res.headers.get('content-disposition')).toContain('attachment; filename=\"feedfuse-subscriptions.opml\"');
    expect(await res.text()).toContain('<opml version=\"2.0\">');
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test:unit src/app/api/opml/export/route.test.ts`
Expected: FAIL，提示 route 模块不存在

- [ ] **Step 3: 实现 export route**

```ts
import { getPool } from '../../../../server/db/pool';
import { fail } from '../../../../server/http/apiResponse';
import { exportOpml } from '../../../../server/services/opmlService';

export async function GET() {
  try {
    const result = await exportOpml(getPool());
    return new Response(result.xml, {
      status: 200,
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'content-disposition': `attachment; filename="${result.fileName}"`,
      },
    });
  } catch (err) {
    return fail(err);
  }
}
```

Implementation notes:

- 这里返回的不是 JSON envelope，而是原始 XML `Response`；不要强行套 `ok(...)`。
- 保持文件名稳定，避免把当前日期塞进文件名，免得测试脆弱。

- [ ] **Step 4: 运行 route 测试确认通过**

Run: `pnpm test:unit src/app/api/opml/export/route.test.ts`
Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add src/app/api/opml/export/route.ts src/app/api/opml/export/route.test.ts
git commit -m "feat(opml): 添加 OPML 导出接口" -m "- 新增 GET /api/opml/export XML 下载接口\n- 设置稳定的 content-type 与 attachment 响应头\n- 补齐导出 route 响应头测试"
```

### Task 5: 客户端 API helper

**Files:**

- Modify: `src/lib/apiClient.ts`
- Modify: `src/lib/apiClient.test.ts`

- [ ] **Step 1: 先写 client helper 的失败测试**

```ts
it('importOpml posts JSON content to /api/opml/import', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    ok: true,
    data: { importedCount: 1, duplicateCount: 0, invalidCount: 0, createdCategoryCount: 0, duplicates: [], invalidItems: [] },
  }), { status: 200, headers: { 'content-type': 'application/json' } })));

  const { importOpml } = await import('./apiClient');
  await importOpml({ content: '<opml />', fileName: 'feeds.opml' });

  const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(getFetchCallUrl(call[0])).toContain('/api/opml/import');
  expect(getFetchCallMethod(call)).toBe('POST');
});

it('exportOpml reads XML text and filename without using requestApi JSON envelope', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<?xml version="1.0"?><opml version="2.0"></opml>', {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'content-disposition': 'attachment; filename=\"feedfuse-subscriptions.opml\"',
    },
  })));

  const { exportOpml } = await import('./apiClient');
  const result = await exportOpml();

  expect(result.fileName).toBe('feedfuse-subscriptions.opml');
  expect(result.xml).toContain('<opml version="2.0">');
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test:unit src/lib/apiClient.test.ts`
Expected: FAIL，提示 `importOpml` / `exportOpml` 未定义

- [ ] **Step 3: 在 `apiClient` 中增加专用 helper**

```ts
export interface OpmlImportResult {
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
  createdCategoryCount: number;
  duplicates: Array<{ title: string; xmlUrl: string; reason: 'duplicate_in_file' | 'duplicate_in_db' }>;
  invalidItems: Array<{ title: string | null; xmlUrl: string | null; reason: 'missing_xml_url' | 'invalid_url' }>;
}

export async function importOpml(input: { content: string; fileName?: string | null }): Promise<OpmlImportResult> {
  return requestApi('/api/opml/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function exportOpml(): Promise<{ xml: string; fileName: string }> {
  const response = await api(toAbsoluteUrl('/api/opml/export'), {
    method: 'GET',
    headers: { accept: 'application/xml, text/xml;q=0.9, */*;q=0.8' },
    timeout: 15_000,
  });
  // manual status handling + response.text() + parse content-disposition
}
```

Implementation notes:

- 不要把 `requestApi<T>()` 改造成“既处理 JSON 又处理 XML”的大一统工具；为 OPML 导出保留专用分支即可。
- `exportOpml()` 的错误通知要与现有 `ApiError` 行为一致，避免 UI 出现沉默失败。

- [ ] **Step 4: 运行 client 测试确认通过**

Run: `pnpm test:unit src/lib/apiClient.test.ts`
Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add src/lib/apiClient.ts src/lib/apiClient.test.ts
git commit -m "feat(opml): 添加 OPML 客户端请求" -m "- 为导入接口添加 JSON helper\n- 为导出下载添加 XML 文本与文件名解析 helper\n- 保持与现有 ApiError 通知行为一致"
```

## Chunk 3: Settings UI Wiring And Regression

### Task 6: OPML 传输区块组件

**Files:**

- Create: `src/features/settings/panels/OpmlTransferSection.tsx`
- Test: `src/features/settings/panels/OpmlTransferSection.test.tsx`
- Modify: `src/features/settings/panels/RssSettingsPanel.tsx`

- [ ] **Step 1: 先写组件级失败测试**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OpmlTransferSection from './OpmlTransferSection';

it('uses Chinese accessible names for import/export actions', () => {
  render(
    <OpmlTransferSection
      importing={false}
      exporting={false}
      lastImportResult={null}
      onImport={vi.fn()}
      onExport={vi.fn()}
    />,
  );

  expect(screen.getByRole('button', { name: '导入 OPML' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '导出 OPML' })).toBeInTheDocument();
});

it('passes the selected file to onImport and renders summary counts', async () => {
  const onImport = vi.fn();
  render(
    <OpmlTransferSection
      importing={false}
      exporting={false}
      lastImportResult={{ importedCount: 2, duplicateCount: 1, invalidCount: 1, createdCategoryCount: 1 }}
      onImport={onImport}
      onExport={vi.fn()}
    />,
  );

  const input = screen.getByTestId('opml-file-input');
  const file = new File(['<opml />'], 'feeds.opml', { type: 'text/xml' });
  fireEvent.change(input, { target: { files: [file] } });

  expect(onImport).toHaveBeenCalledWith(file);
  expect(screen.getByText('已导入 2 个订阅')).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test:unit src/features/settings/panels/OpmlTransferSection.test.tsx`
Expected: FAIL，提示组件不存在

- [ ] **Step 3: 实现区块组件并接入 RSS 面板**

```tsx
export interface OpmlTransferResultSummary {
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
  createdCategoryCount: number;
}

export default function OpmlTransferSection(props: {
  importing: boolean;
  exporting: boolean;
  lastImportResult: OpmlTransferResultSummary | null;
  onImport: (file: File) => void | Promise<void>;
  onExport: () => void | Promise<void>;
}) {
  return (
    <section>
      <Button aria-label="导入 OPML">导入 OPML</Button>
      <input data-testid="opml-file-input" type="file" accept=".opml,.xml,text/xml,application/xml" />
      <Button aria-label="导出 OPML">导出 OPML</Button>
      {/* render summary lines only when result exists */}
    </section>
  );
}
```

Implementation notes:

- 让 `OpmlTransferSection` 负责文件选择和按钮 UI；不要让 `RssSettingsPanel.tsx` 因为一组新交互膨胀成更大的“万能面板”。
- 摘要文案使用中文句子，例如“已导入 2 个订阅”“已跳过 1 个重复订阅”，不要在 UI 暴露字段名。
- 即使只显示汇总，也保留空态说明，如“导入 OPML 以批量恢复订阅与分类”。

- [ ] **Step 4: 运行组件测试确认通过**

Run: `pnpm test:unit src/features/settings/panels/OpmlTransferSection.test.tsx`
Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add src/features/settings/panels/OpmlTransferSection.tsx src/features/settings/panels/OpmlTransferSection.test.tsx src/features/settings/panels/RssSettingsPanel.tsx
git commit -m "feat(settings): 添加 OPML 传输区块" -m "- 在 RSS 设置面板组合导入导出区块\n- 为新按钮和文件选择交互提供中文可访问名称\n- 展示最近一次导入结果摘要"
```

### Task 7: 设置中心接线与导入回归

**Files:**

- Modify: `src/features/settings/SettingsCenterDrawer.tsx`
- Modify: `src/features/settings/SettingsCenterModal.test.tsx`

- [ ] **Step 1: 先写设置中心集成失败测试**

```tsx
it('imports opml from the RSS tab, shows summary, and reloads snapshot once', async () => {
  resetSettingsStore();
  renderWithNotifications();

  fireEvent.click(screen.getByLabelText('打开设置'));
  fireEvent.click(await screen.findByTestId('settings-section-tab-rss'));

  const input = await screen.findByTestId('opml-file-input');
  const file = new File(['<opml version="2.0"><body /></opml>'], 'feeds.opml', { type: 'text/xml' });
  fireEvent.change(input, { target: { files: [file] } });

  await waitFor(() => {
    expect(screen.getByText('已导入 0 个订阅')).toBeInTheDocument();
  });

  await waitFor(() => {
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.filter(([input]) => getFetchCallUrl(input).includes('/api/reader/snapshot')).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test:unit src/features/settings/SettingsCenterModal.test.tsx`
Expected: FAIL，提示 RSS 标签页中找不到 OPML 控件或导入后没有刷新 snapshot

- [ ] **Step 3: 在 `SettingsCenterDrawer` 中完成接线**

```tsx
const [opmlImporting, setOpmlImporting] = useState(false);
const [opmlExporting, setOpmlExporting] = useState(false);
const [lastOpmlImportResult, setLastOpmlImportResult] = useState<OpmlTransferResultSummary | null>(null);

const handleOpmlImport = async (file: File) => {
  setOpmlImporting(true);
  try {
    const content = await file.text();
    const result = await importOpml({ content, fileName: file.name });
    setLastOpmlImportResult(result);
    toast.success('OPML 导入完成');
    await useAppStore.getState().loadSnapshot({ view: selectedView });
  } finally {
    setOpmlImporting(false);
  }
};

const handleOpmlExport = async () => {
  setOpmlExporting(true);
  try {
    const result = await exportOpml();
    // build Blob -> URL.createObjectURL -> temporary anchor click -> revokeObjectURL
    toast.success('OPML 已开始下载');
  } finally {
    setOpmlExporting(false);
  }
};
```

Implementation notes:

- 导入结果 state 放在 `SettingsCenterDrawer`，不要塞进 `settingsStore` 或 `draft.persisted.rss`；它不是持久化设置。
- `loadSnapshot({ view: selectedView })` 只在导入成功后调用一次，不要按导入条目循环调用。
- 下载逻辑放在 drawer callback 内即可；不要为了一个 anchor click 再创建全局下载 service。
- `SettingsCenterModal.test.tsx` 的 fetch stub 要补 `/api/opml/import` 与 `/api/opml/export` 分支，并继续保持中文 `aria-label` 断言。

- [ ] **Step 4: 运行设置中心回归测试确认通过**

Run: `pnpm test:unit src/features/settings/SettingsCenterModal.test.tsx`
Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add src/features/settings/SettingsCenterDrawer.tsx src/features/settings/SettingsCenterModal.test.tsx
git commit -m "feat(settings): 接入 OPML 导入导出交互" -m "- 在设置中心接入 OPML 导入与导出回调\n- 导入成功后统一刷新一次 reader snapshot\n- 补齐 RSS 标签页集成回归测试"
```

## Verification Checklist

- 运行纯文档与服务层测试：
  - `pnpm test:unit src/server/opml/opmlDocument.test.ts src/server/services/opmlService.test.ts`
- 运行 route contract 测试：
  - `pnpm test:unit src/app/api/opml/import/route.test.ts src/app/api/opml/export/route.test.ts`
- 运行客户端与设置中心测试：
  - `pnpm test:unit src/lib/apiClient.test.ts src/features/settings/panels/OpmlTransferSection.test.tsx src/features/settings/SettingsCenterModal.test.tsx`
- 运行合并后的 focused suite：
  - `pnpm test:unit src/server/opml/opmlDocument.test.ts src/server/services/opmlService.test.ts src/app/api/opml/import/route.test.ts src/app/api/opml/export/route.test.ts src/lib/apiClient.test.ts src/features/settings/panels/OpmlTransferSection.test.tsx src/features/settings/SettingsCenterModal.test.tsx`
- 在 focused suite 通过后，再运行一次整仓 lint：
  - `pnpm lint`

## Done Criteria

- 设置中心 RSS 标签页可导入 `.opml` / `.xml` 文件，并展示最近一次结果摘要
- 导入结果能区分新增、重复、无效、创建分类数量
- 空 OPML 与“全部条目被跳过”显示为成功摘要，不显示失败 toast
- 导出返回标准 OPML XML 下载，包含分类分组与未分类根级 feed
- 新增 UI 文案与测试断言全部使用中文可访问名称
- focused suite 与 `pnpm lint` 通过

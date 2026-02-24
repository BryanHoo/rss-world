# FeedFuse Backend Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 为现有 FeedFuse 前端提供真实后端（Next.js Route Handlers + Postgres）与后台 worker（RSS 定时抓取 + AI 摘要队列），覆盖当前 UI 已实现的读/星标/分类/新增源等能力。

**Architecture:** Next.js App Router 内置 API（`src/app/api/**/route.ts`）负责读写与参数校验；Postgres 存储 feeds/categories/articles/app_settings；worker 作为独立进程通过 `pg-boss` 消费任务，执行 RSS 抓取解析、净化入库、（可选）AI 摘要写回。

**Tech Stack:** Next.js 16 (Node.js runtime), TypeScript, Postgres, `pg`, `pg-boss`, `zod`, `rss-parser`, `sanitize-html`, `ipaddr.js`, Vitest。

---

## Inputs（先读这些再动手）

- 设计文档：`docs/plans/2026-02-24-feedfuse-backend-design.md`
- 前端入口链路：
  - `src/app/(reader)/page.tsx` → `src/app/(reader)/ReaderApp.tsx` → `src/features/reader/ReaderLayout.tsx`
  - 状态：`src/store/appStore.ts` 当前依赖 `createMockProvider()`（同步接口），真实后端接入需要异步数据流改造（见“Phase 4：前端接入”）
- 当前测试/验证命令：
  - 单测：`pnpm run test:unit`
  - Lint：`pnpm run lint`
  - 构建：`pnpm run build`

## Key Risks / Pitfalls（实现时别踩）

1) **Next.js Route Handlers 缓存**：对 DB 动态数据的 `GET` 需要显式禁用缓存（例如 `export const dynamic = 'force-dynamic'` 或 `revalidate = 0`）。  
2) **XSS**：前端用 `dangerouslySetInnerHTML` 渲染文章（`src/features/articles/ArticleView.tsx`），后端必须对 `content_html` 做 sanitize。  
3) **SSRF**：RSS URL 校验与抓取要阻止内网地址/本机网段与非 http/https 协议。  
4) **幂等与去重**：抓取任务重复执行时必须安全（`unique(feed_id, dedupe_key)` + insert conflict ignore）。  
5) **DB 连接池**：确保 server-only 模块不被 client 引入；保持单例 Pool；注意热更新下重复创建（开发期）。  

## Phase 0：基础依赖与目录骨架（只做“能跑、可测试”）

### Task 1: 增加后端依赖（DB/校验/抓取/净化/队列）

**Files:**

- Modify: `package.json`

**Step 1: 添加依赖**

Run:

```bash
pnpm add pg pg-boss zod rss-parser sanitize-html ipaddr.js
pnpm add -D @types/pg @types/sanitize-html
pnpm add -D tsx
```

Expected: `package.json` dependencies 更新；`pnpm-lock.yaml` 变化。

**Step 2: 运行现有单测确保不被破坏**

Run: `pnpm run test:unit`  
Expected: PASS

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(backend): add server dependencies"
```

---

### Task 2: 增加 server-only 的 env 校验模块

**Files:**

- Create: `src/server/env.ts`
- Test: `src/server/env.test.ts`

**Step 1: 写失败单测（缺少必需 env 时应报错）**

```ts
// src/server/env.test.ts
import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('env', () => {
  it('throws when DATABASE_URL is missing', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });
});
```

**Step 2: 运行单测确认失败**

Run: `pnpm run test:unit`  
Expected: FAIL（`parseEnv` 未实现）

**Step 3: 最小实现**

```ts
// src/server/env.ts
import 'server-only';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AI_API_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof envSchema>;

export function parseEnv(input: Record<string, unknown>): ServerEnv {
  return envSchema.parse(input);
}

export function getServerEnv(): ServerEnv {
  return parseEnv(process.env as Record<string, unknown>);
}
```

**Step 4: 运行单测确认通过**

Run: `pnpm run test:unit`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/env.ts src/server/env.test.ts
git commit -m "feat(backend): add server env parser"
```

---

### Task 3: 增加 Postgres Pool 单例（server-only）

**Files:**

- Create: `src/server/db/pool.ts`
- Test: `src/server/db/pool.test.ts`

**Step 1: 写失败单测（Pool 应为单例）**

```ts
// src/server/db/pool.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('../env', () => ({
  getServerEnv: () => ({ DATABASE_URL: 'postgres://example', AI_API_KEY: undefined }),
}));

describe('db pool', () => {
  it('returns a singleton pool', async () => {
    const mod = await import('./pool');
    expect(mod.getPool()).toBe(mod.getPool());
  });
});
```

**Step 2: 运行单测确认失败**

Run: `pnpm run test:unit`  
Expected: FAIL（`getPool` 未实现）

**Step 3: 最小实现**

```ts
// src/server/db/pool.ts
import 'server-only';
import { Pool } from 'pg';
import { getServerEnv } from '../env';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;
  const { DATABASE_URL } = getServerEnv();
  pool = new Pool({ connectionString: DATABASE_URL });
  return pool;
}
```

**Step 4: 运行单测确认通过**

Run: `pnpm run test:unit`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/db/pool.ts src/server/db/pool.test.ts
git commit -m "feat(backend): add postgres pool singleton"
```

---

## Phase 1：Schema 与迁移（让 DB “真实存在”）

### Task 4: 增加 SQL migrations + 简单 migrator 脚本

**Files:**

- Create: `src/server/db/migrations/0001_init.sql`
- Create: `scripts/db/migrate.mjs`
- Create: `docker-compose.yml`
- Create: `.env.example`

**Step 1: 先写 docker-compose（只含 db）与 .env.example**

`docker-compose.yml`（最小可启动）：

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: feedfuse
      POSTGRES_USER: feedfuse
      POSTGRES_PASSWORD: feedfuse
    ports:
      - "5432:5432"
    volumes:
      - feedfuse_pg:/var/lib/postgresql/data
volumes:
  feedfuse_pg:
```

`.env.example`：

```bash
DATABASE_URL=postgresql://feedfuse:feedfuse@127.0.0.1:5432/feedfuse
AI_API_KEY=
```

**Step 2: 启动本地 db 并确认连通**

Run:

```bash
docker compose up -d db
docker compose ps
```

Expected: `db` 为 `running`

**Step 3: 写 0001_init.sql（按设计文档）**

`src/server/db/migrations/0001_init.sql`（示例，按需扩展索引）：

```sql
create extension if not exists pgcrypto;

create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists categories_name_unique on categories (lower(name));

create table if not exists feeds (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  site_url text null,
  icon_url text null,
  enabled boolean not null default true,
  category_id uuid null references categories(id) on delete set null,
  fetch_interval_minutes int not null default 30,
  etag text null,
  last_modified text null,
  last_fetched_at timestamptz null,
  last_fetch_status int null,
  last_fetch_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists feeds_url_unique on feeds (url);
create index if not exists feeds_enabled_idx on feeds (enabled);
create index if not exists feeds_category_id_idx on feeds (category_id);

create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references feeds(id) on delete cascade,
  dedupe_key text not null,
  title text not null,
  link text null,
  author text null,
  published_at timestamptz null,
  content_html text null,
  summary text null,
  fetched_at timestamptz not null default now(),
  is_read boolean not null default false,
  read_at timestamptz null,
  is_starred boolean not null default false,
  starred_at timestamptz null,
  ai_summary text null,
  ai_summary_model text null,
  ai_summarized_at timestamptz null
);
create unique index if not exists articles_dedupe_unique on articles (feed_id, dedupe_key);
create index if not exists articles_feed_published_idx on articles (feed_id, published_at desc, id desc);
create index if not exists articles_is_read_published_idx on articles (is_read, published_at desc, id desc);
create index if not exists articles_is_starred_published_idx on articles (is_starred, published_at desc, id desc);

create table if not exists app_settings (
  id int primary key default 1 check (id = 1),
  ai_summary_enabled boolean not null default false,
  ai_translate_enabled boolean not null default false,
  ai_auto_summarize boolean not null default false,
  ai_model text not null default '',
  ai_api_base_url text not null default '',
  rss_user_agent text not null default 'FeedFuse/1.0',
  rss_timeout_ms int not null default 10000,
  updated_at timestamptz not null default now()
);

insert into app_settings (id) values (1)
on conflict (id) do nothing;
```

**Step 4: 写 migrator 脚本（按文件名顺序执行，记录 schema_migrations）**

`scripts/db/migrate.mjs`（最小可用，需保证事务与幂等）：

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const migrationsDir = path.join(repoRoot, 'src/server/db/migrations');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const client = new Client({ connectionString: databaseUrl });

async function main() {
  await client.connect();
  await client.query(`
    create table if not exists schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    );
  `);
  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = file;
    const { rows } = await client.query(
      'select version from schema_migrations where version = $1',
      [version],
    );
    if (rows.length > 0) continue;

    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query(
        'insert into schema_migrations(version) values ($1)',
        [version],
      );
      await client.query('commit');
      console.log(`Applied migration ${version}`);
    } catch (err) {
      await client.query('rollback');
      throw err;
    }
  }
}

main()
  .then(() => client.end())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

**Step 5: 运行 migrator 并验证表已创建**

Run:

```bash
node scripts/db/migrate.mjs
```

Expected: 输出 `Applied migration 0001_init.sql`；重复执行应无报错且无重复应用。

（可选）验证：

```bash
docker exec -it $(docker compose ps -q db) psql -U feedfuse -d feedfuse -c "\\dt"
```

Expected: 能看到 `feeds`/`articles`/`categories`/`app_settings` 等表。

**Step 6: Commit**

```bash
git add docker-compose.yml .env.example scripts/db/migrate.mjs src/server/db/migrations/0001_init.sql
git commit -m "feat(backend): add postgres schema and migrator"
```

---

## Phase 2：Repository + Service（先写纯逻辑，Route Handlers 只做薄封装）

### Task 5: 实现 repositories（feeds/categories/articles/settings）

**Files:**

- Create: `src/server/repositories/categoriesRepo.ts`
- Create: `src/server/repositories/feedsRepo.ts`
- Create: `src/server/repositories/articlesRepo.ts`
- Create: `src/server/repositories/settingsRepo.ts`
- Test: `src/server/repositories/repositories.integration.test.ts`（需要本地 db）

**Step 1: 写失败集成测试（需要 DB，使用 DATABASE_URL；无则 skip）**

```ts
// src/server/repositories/repositories.integration.test.ts
import { describe, expect, it } from 'vitest';
import { getPool } from '../db/pool';
import { createCategory, listCategories } from './categoriesRepo';

const databaseUrl = process.env.DATABASE_URL;
describe.skipIf(!databaseUrl)('repositories (integration)', () => {
  it('creates and lists categories', async () => {
    const pool = getPool();
    const created = await createCategory(pool, { name: 'Tech' });
    const categories = await listCategories(pool);
    expect(categories.some((c) => c.id === created.id)).toBe(true);
  });
});
```

**Step 2: 运行测试确认失败**

Run: `pnpm run test:unit`  
Expected: FAIL（repo 未实现）

**Step 3: 最小实现 categoriesRepo（其余 repo 先空实现/抛错也可，按测试推进）**

```ts
// src/server/repositories/categoriesRepo.ts
import 'server-only';
import type { Pool } from 'pg';

export interface CategoryRow {
  id: string;
  name: string;
}

export async function listCategories(pool: Pool): Promise<CategoryRow[]> {
  const { rows } = await pool.query('select id, name from categories order by position asc, name asc');
  return rows;
}

export async function createCategory(pool: Pool, input: { name: string }): Promise<CategoryRow> {
  const { rows } = await pool.query(
    'insert into categories(name) values ($1) returning id, name',
    [input.name],
  );
  return rows[0];
}
```

**Step 4: 运行测试确认通过**

Run: `DATABASE_URL=... pnpm run test:unit`  
Expected: PASS（当本地 db 已启动且 migrations 已跑）

**Step 5: 扩展实现其他 repo + 追加集成测试用例**

最低覆盖（每个都加 1-2 个 happy path 测试）：

- `feedsRepo`: create/list/update/delete + unique(url) 冲突
- `articlesRepo`: upsert/insert ignore duplicates, list by view, mark read/star, mark all read
- `settingsRepo`: get/update settings（单行）

**Step 6: Commit**

```bash
git add src/server/repositories src/server/repositories/repositories.integration.test.ts
git commit -m "feat(backend): add postgres repositories"
```

---

### Task 6: 实现 readerSnapshot service（组装 categories/feeds/unreadCount/articles）

**Files:**

- Create: `src/server/services/readerSnapshotService.ts`
- Test: `src/server/services/readerSnapshotService.test.ts`（可用 repo stub，不必依赖 DB）

**Step 1: 写失败单测（按 view 过滤文章）**

```ts
// src/server/services/readerSnapshotService.test.ts
import { describe, expect, it } from 'vitest';
import { buildArticleFilter } from './readerSnapshotService';

describe('readerSnapshotService', () => {
  it('filters unread view', () => {
    const filter = buildArticleFilter({ view: 'unread' });
    expect(filter.whereSql).toMatch(/is_read = false/);
  });
});
```

**Step 2: 运行单测确认失败**

Run: `pnpm run test:unit`  
Expected: FAIL（未实现）

**Step 3: 最小实现（先把分页/cursor 逻辑抽成纯函数方便测）**

`readerSnapshotService.ts` 建议导出：

- `encodeCursor({ publishedAt, id }) -> string`
- `decodeCursor(cursor) -> { publishedAt, id } | null`
- `buildArticleFilter({ view, cursor, limit }) -> { whereSql, params, limit }`
- `getReaderSnapshot(pool, input) -> { categories, feeds, articles }`

（分页建议）排序与 cursor：

- order by：`published_at desc nulls last, id desc`
- cursor where：`(published_at, id) < ($publishedAt, $id)`（需要处理 nulls；可退化为使用 `fetched_at` 做主排序以简化）

**Step 4: 单测通过后，再加 2-3 个边界测试**

- `view=all` 不加 where
- `view=starred` 使用 `is_starred = true`
- `view=<feedId>` 使用 `feed_id = $1`

**Step 5: Commit**

```bash
git add src/server/services/readerSnapshotService.ts src/server/services/readerSnapshotService.test.ts
git commit -m "feat(backend): add reader snapshot service"
```

---

## Phase 3：Route Handlers（API 层薄封装 + zod 校验 + 统一错误返回）

### Task 7: 增加统一错误与 response helper

**Files:**

- Create: `src/server/http/apiResponse.ts`
- Create: `src/server/http/errors.ts`
- Test: `src/server/http/errors.test.ts`

**Step 1: 写失败单测（ValidationError 输出 fields）**

```ts
import { describe, expect, it } from 'vitest';
import { ValidationError } from './errors';

describe('errors', () => {
  it('serializes validation fields', () => {
    const err = new ValidationError('bad', { url: 'invalid' });
    expect(err.fields.url).toBe('invalid');
  });
});
```

**Step 2: 运行失败**

Run: `pnpm run test:unit`  
Expected: FAIL

**Step 3: 最小实现**

```ts
// src/server/http/errors.ts
import 'server-only';

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public fields: Record<string, string>) {
    super(message, 'validation_error', 400);
  }
}
```

`apiResponse.ts`：

```ts
import 'server-only';
import { NextResponse } from 'next/server';
import { AppError } from './errors';

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(err: unknown) {
  if (err instanceof ValidationError) {
    return NextResponse.json(
      { ok: false, error: { code: err.code, message: err.message, fields: err.fields } },
      { status: err.status },
    );
  }
  if (err instanceof AppError) {
    return NextResponse.json(
      { ok: false, error: { code: err.code, message: err.message } },
      { status: err.status },
    );
  }
  return NextResponse.json(
    { ok: false, error: { code: 'internal_error', message: 'Internal error' } },
    { status: 500 },
  );
}
```

（实现时注意：不要在 `fail` 里泄漏 stack；并正确输出 `fields`）

**Step 4: 单测通过**

Run: `pnpm run test:unit`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/http
git commit -m "feat(backend): add api error/response helpers"
```

---

### Task 8: 增加 /api/health

**Files:**

- Create: `src/app/api/health/route.ts`
- Test: `src/app/api/health/route.test.ts`

**Step 1: 写失败单测（GET 返回 ok:true）**

```ts
import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('/api/health', () => {
  it('returns ok', async () => {
    const res = await GET();
    const json = await res.json();
    expect(json.ok).toBe(true);
  });
});
```

**Step 2: 实现 route**

```ts
// src/app/api/health/route.ts
import { ok } from '../../../server/http/apiResponse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return ok({ status: 'ok' });
}
```

**Step 3: 运行单测**

Run: `pnpm run test:unit`  
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/api/health/route.ts src/app/api/health/route.test.ts
git commit -m "feat(backend): add health route"
```

---

### Task 9: 增加 /api/categories（GET/POST）与 /api/categories/[id]（PATCH/DELETE）

**Files:**

- Create: `src/app/api/categories/route.ts`
- Create: `src/app/api/categories/[id]/route.ts`
- Test: `src/app/api/categories/routes.test.ts`

**Steps（TDD 同上）**

- 先写测试：create → list → update → delete
- 再实现：Route Handler 内用 `zod` 校验 body；调用 `categoriesRepo`
- 验证：`pnpm run test:unit`
- Commit：`git commit -m "feat(backend): add categories routes"`

（实现提示）

- `POST` body：`{ name: string }`，空/重复名返回 `validation_error`/`conflict`
- `DELETE` 依赖 `feeds.category_id on delete set null`

---

### Task 10: 增加 /api/feeds（GET/POST）与 /api/feeds/[id]（PATCH/DELETE）

**Files:**

- Create: `src/app/api/feeds/route.ts`
- Create: `src/app/api/feeds/[id]/route.ts`
- Create: `src/app/api/feeds/[id]/refresh/route.ts`
- Test: `src/app/api/feeds/routes.test.ts`

**Steps（TDD 同上）**

- 测试覆盖：
  - `POST` 新建 feed（url 必须 http/https + SSRF guard；url unique）
  - `GET` 返回 feeds（含 `unreadCount` 聚合）
  - `PATCH` 支持 enabled/categoryId/title
  - `DELETE` 删除 feed（cascade 删除 articles）
  - `POST /refresh` enqueue `feed.fetch`
- 实现时把 enqueue 抽到 `src/server/queue/queue.ts`
- Commit：`git commit -m "feat(backend): add feeds routes"`

---

### Task 11: 增加 /api/articles/[id]（GET/PATCH）与 /api/articles/mark-all-read（POST）

**Files:**

- Create: `src/app/api/articles/[id]/route.ts`
- Create: `src/app/api/articles/mark-all-read/route.ts`
- Test: `src/app/api/articles/routes.test.ts`

**Steps（TDD 同上）**

- 测试覆盖：
  - `PATCH` 幂等：重复标记已读/收藏不会报错
  - `mark-all-read` 支持 `feedId?`
- 实现调用 `articlesRepo`
- Commit：`git commit -m "feat(backend): add articles routes"`

---

### Task 12: 增加 /api/reader/snapshot（GET）

**Files:**

- Create: `src/app/api/reader/snapshot/route.ts`
- Test: `src/app/api/reader/snapshot/route.test.ts`

**Steps（TDD 同上）**

- 测试：返回结构 `{ categories, feeds, articles: { items, nextCursor } }`
- 实现：调用 `readerSnapshotService.getReaderSnapshot(getPool(), input)`
- Commit：`git commit -m "feat(backend): add reader snapshot route"`

---

### Task 13: 增加 /api/rss/validate（GET）

**Files:**

- Create: `src/app/api/rss/validate/route.ts`
- Create: `src/server/rss/ssrfGuard.ts`
- Test: `src/server/rss/ssrfGuard.test.ts`

**Step 1: 写失败单测（阻止内网）**

```ts
import { describe, expect, it } from 'vitest';
import { isSafeExternalUrl } from './ssrfGuard';

describe('ssrfGuard', () => {
  it('rejects localhost', () => {
    expect(isSafeExternalUrl('http://127.0.0.1/feed')).toBe(false);
  });
});
```

**Step 2: 实现 isSafeExternalUrl（包含 DNS lookup + ip range）**

实现建议：

- 协议仅 `http:`/`https:`
- host 为 IP：用 `ipaddr.js` 判断 private/loopback/linkLocal
- host 为域名：`dns/promises.lookup(host, { all: true })` 获取 IP 列表逐个判定

**Step 3: 实现 route**

- query：`?url=...`
- 返回 `RssValidationResult` 结构（沿用前端 `RssValidationErrorCode` 语义）
- 只做“快速验证”（HEAD/GET + content-type/是否能解析为 RSS/Atom），不要入库

**Step 4: Commit**

```bash
git add src/app/api/rss/validate/route.ts src/server/rss/ssrfGuard.ts src/server/rss/ssrfGuard.test.ts
git commit -m "feat(backend): add rss validate route"
```

---

## Phase 4：worker（pg-boss + RSS 抓取入库 + 可选 AI 摘要）

### Task 14: 增加 queue 封装（web/worker 共用）

**Files:**

- Create: `src/server/queue/boss.ts`
- Create: `src/server/queue/jobs.ts`
- Test: `src/server/queue/jobs.test.ts`（可只测 job name/constants）

**Implementation sketch**

```ts
// src/server/queue/jobs.ts
export const JOB_FEED_FETCH = 'feed.fetch';
export const JOB_REFRESH_ALL = 'feed.refresh_all';
export const JOB_AI_SUMMARIZE = 'ai.summarize_article';
```

`boss.ts`：

- 读 `DATABASE_URL`
- 初始化 `PgBoss`
- 提供 `getBoss()` 单例（server-only）

**Commit:** `git commit -m "feat(worker): add pg-boss wrapper"`

---

### Task 15: 增加 RSS fetch/parse/sanitize 逻辑（供 worker 使用）

**Files:**

- Create: `src/server/rss/fetchFeedXml.ts`
- Create: `src/server/rss/parseFeed.ts`
- Create: `src/server/rss/sanitizeContent.ts`
- Test: `src/server/rss/parseFeed.test.ts`

**Step 1: 用 fixture 写失败测试（解析 RSS/Atom 最小样例）**

- Fixtures：`src/server/rss/__fixtures__/rss.xml`、`src/server/rss/__fixtures__/atom.xml`

测试要断言：

- 能读出 feed title、item title、link、publishedAt（缺失则用 fetchedAt）
- `sanitizeContent` 会移除 `<script>` 与 `onerror=...`，保留 `<img src="https://...">`

**Step 2: 最小实现**

- `fetchFeedXml`：用 `fetch` + timeout + conditional headers（etag/last-modified）
- `parseFeed`：用 `rss-parser` 解析，并返回统一结构
- `sanitizeContent`：用 `sanitize-html`，白名单 tag/attr，限制 URL scheme

**Commit:** `git commit -m "feat(worker): add rss fetch/parse/sanitize"`

---

### Task 16: 实现 worker runner（消费 jobs）

**Files:**

- Create: `src/worker/index.ts`
- Modify: `package.json`（新增 scripts）

**Step 1: 添加 scripts**

```json
{
  "scripts": {
    "worker:dev": "tsx src/worker/index.ts",
    "worker:start": "tsx src/worker/index.ts"
  }
}
```

**Step 2: 实现 worker**

worker 需要：

- `getBoss()` → `boss.start()`
- `boss.work(JOB_REFRESH_ALL, ...)`：列出 enabled feeds 并 enqueue `JOB_FEED_FETCH`
- `boss.work(JOB_FEED_FETCH, ...)`：抓取并入库文章（用 repos + rss 模块）
-（可选）`boss.work(JOB_AI_SUMMARIZE, ...)`：生成摘要写回
- `boss.schedule(JOB_REFRESH_ALL, '*/5 * * * *')`（示例：每 5 分钟）

**Step 3: 本地验证**

Run:

```bash
docker compose up -d db
node scripts/db/migrate.mjs
pnpm run worker:dev
```

Expected: worker 启动成功，能定时 enqueue；手动通过 API 创建 feed 后会触发抓取并入库文章。

**Step 4: Commit**

```bash
git add src/worker/index.ts package.json pnpm-lock.yaml
git commit -m "feat(worker): add worker process"
```

---

## Phase 5：Docker 自托管整合（web + worker + db）

### Task 17: 扩展 docker-compose：加入 web + worker

**Files:**

- Modify: `docker-compose.yml`
- Modify: `Dockerfile`（如需分离 worker 命令/生产依赖裁剪，可选）

**Step 1: docker-compose 增加 web/worker（复用同一镜像）**

示例：

```yaml
services:
  db: ...
  web:
    build: .
    environment:
      DATABASE_URL: postgresql://feedfuse:feedfuse@db:5432/feedfuse
      AI_API_KEY: ${AI_API_KEY}
    ports:
      - "3000:3000"
    depends_on:
      - db
  worker:
    build: .
    command: ["pnpm", "run", "worker:start"]
    environment:
      DATABASE_URL: postgresql://feedfuse:feedfuse@db:5432/feedfuse
      AI_API_KEY: ${AI_API_KEY}
    depends_on:
      - db
```

**Step 2: 启动全栈验证**

Run:

```bash
docker compose up -d --build
curl -s http://127.0.0.1:3000/api/health | jq
```

Expected: `{ ok: true, data: { status: "ok" } }`

**Step 3: Commit**

```bash
git add docker-compose.yml Dockerfile
git commit -m "chore(docker): run web + worker + db"
```

---

## Phase 6（可选但推荐）：前端从 mock provider 迁移到真实 API

> 现状：`src/store/appStore.ts` 的 provider 是同步接口，无法直接接入 async fetch。建议重构为“Zustand async actions + 初次加载 snapshot”，UI 层保持基本不改。

### Task 18: 增加 API client 与加载 snapshot

**Files:**

- Create: `src/lib/apiClient.ts`
- Modify: `src/store/appStore.ts`
- Test: `src/store/appStore.integration.test.ts`（用 msw 或 mock fetch）

**Steps（高层）**

- `loadSnapshot(view?)`：GET `/api/reader/snapshot`，写入 `feeds/categories/articles`
- 将 `markAsRead`/`toggleStar`/`markAllAsRead` 改为 async：先 optimistic 更新本地，再调用 API；失败回滚或 toast（MVP 可先不回滚）
- `addFeed`：改为调用 `POST /api/feeds`，成功后刷新 snapshot

### Task 19: 替换 AddFeedDialog 的 URL 校验为后端

**Files:**

- Modify: `src/features/feeds/services/rssValidationService.ts`
- Modify: `src/features/feeds/AddFeedDialog.tsx`

把 `validateRssUrl` 从 mock 改为调用 `GET /api/rss/validate?url=...`，保持返回结构不变。

---

## Definition of Done（最小完成标准）

- `docker compose up -d --build` 后：
  - `/api/health` 返回 `{ ok: true }`
  - 能 `POST /api/feeds` 创建 feed，worker 自动抓取并插入 articles
  - `/api/reader/snapshot` 能返回 feeds/categories/articles
  - `PATCH /api/articles/:id` / `POST /api/articles/mark-all-read` 生效
- 文章 `content_html` 已 sanitize（脚本/事件属性被移除）
- SSRF guard 生效（localhost/内网地址被拒绝）
- `pnpm run test:unit`、`pnpm run lint` 通过

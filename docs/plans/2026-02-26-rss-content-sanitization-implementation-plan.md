# RSS 正文 HTML 规范化（sanitizeContent） Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 在入库前规范化文章正文 HTML：修复相对/协议相对 URL，保留图片关键属性，并统一外链打开方式（新标签页 + 安全 `rel`）。

**Architecture:** 继续使用 `sanitize-html` 做 HTML 清洗，并通过 allowlist + `transformTags` 对 `a`/`img` 做同步重写。抓取 worker 为每个 item 计算 `baseUrl` 并传入 `sanitizeContent`，以便将相对/协议相对 URL 归一化为绝对 URL。

**Tech Stack:** TypeScript, Node.js, `sanitize-html`, `rss-parser`, `pg-boss`, Vitest, pnpm.

---

## Inputs（先读这些再动手）

- 设计文档：`docs/plans/2026-02-26-rss-content-sanitization-design.md`
- 现有实现与调用链：
  - `src/server/rss/sanitizeContent.ts`
  - `src/worker/index.ts`
  - `src/server/rss/parseFeed.test.ts`
- 验证命令：
  - 单测：`pnpm run test:unit`
  - Lint：`pnpm run lint`
  - 构建：`pnpm run build`

## Key Risks / Pitfalls（实现时别踩）

1) **当前 `sanitizeContent` 覆盖了 `img` 的 `allowedAttributes`**，会把默认的 `srcset/width/height/loading` 等属性剥掉；实现时必须修正 allowlist。
2) **`allowProtocolRelative: false` 会导致 `//example.com/...` 直接被丢弃**：需要在 `transformTags` 中把协议相对 URL 改写为 `https://...`。
3) **`srcset` 解析容易出错**：至少覆盖 `url 2x` 与 `url 480w` 两种 descriptor；保证非法项会被过滤而不是保留“脏字符串”。
4) **`baseUrl` 可能为空/非法**：URL 归一化必须 try/catch；无法归一化的相对 URL 应移除（避免错误地相对到阅读器自身域名）。
5) **不要放开 `style/class`**：会破坏阅读器侧 `prose` 的统一排版与深色模式一致性。

---

## Phase 0：准备工作（隔离变更 + 建立基线）

### Task 1: 在独立 worktree/分支上执行（推荐）

**Files:** 无

**Step 1: 创建 worktree**

Run:

```bash
git fetch
git worktree add -b codex/rss-content-sanitization ../feedfuse-rss-content-sanitization
```

Expected: 生成新目录 `../feedfuse-rss-content-sanitization`，后续步骤在该目录执行。

**Step 2: 基线验证（改动前先全绿）**

Run:

```bash
pnpm run lint
pnpm run test:unit
pnpm run build
```

Expected: 全部 PASS。

---

## Phase 1：用单测锁定行为（TDD）

### Task 2: 扩展 `sanitizeContent` 的单测用例（先红）

**Files:**

- Modify: `src/server/rss/parseFeed.test.ts`

**Step 1: 新增用例覆盖链接/图片/表格规范化**

在 `describe('rss parsing', ...)` 中新增测试（放在现有 “sanitizes scripts...” 用例后面即可）：

```ts
it('normalizes links and images with baseUrl', () => {
  const cleaned = sanitizeContent(
    [
      '<p>',
      '<a href="/post/1">relative</a>',
      '<a href="//news.ycombinator.com/">proto</a>',
      '<a href="#section">anchor</a>',
      '<a href="mailto:test@example.com">mail</a>',
      '<a href="javascript:alert(1)">bad</a>',
      '<img data-src="/img/a.jpg" data-srcset="/img/a.jpg 1x, /img/a@2x.jpg 2x" width="600" height="400" />',
      '<img src="javascript:alert(1)" />',
      '<table><tr><td colspan="2" rowspan="3">cell</td></tr></table>',
      '<p style="color:red" class="x">style</p>',
      '</p>',
    ].join(''),
    { baseUrl: 'https://example.com/a/b' },
  );

  expect(cleaned).toContain('href="https://example.com/post/1"');
  expect(cleaned).toContain('href="https://news.ycombinator.com/"');
  expect(cleaned).toContain('target="_blank"');
  expect(cleaned).toContain('rel="');
  expect(cleaned).toContain('noopener');
  expect(cleaned).toContain('noreferrer');
  expect(cleaned).toContain('ugc');

  expect(cleaned).toContain('href="#section"');
  expect(cleaned).toContain('href="mailto:test@example.com"');
  expect(cleaned).not.toContain('href="javascript:');

  expect(cleaned).toContain('src="https://example.com/img/a.jpg"');
  expect(cleaned).toContain('srcset="');
  expect(cleaned).toContain('https://example.com/img/a@2x.jpg');
  expect(cleaned).toContain('loading="lazy"');
  expect(cleaned).toContain('decoding="async"');
  expect(cleaned).toContain('width="600"');
  expect(cleaned).toContain('height="400"');
  expect(cleaned).not.toContain('javascript:alert');

  expect(cleaned).toContain('colspan="2"');
  expect(cleaned).toContain('rowspan="3"');

  expect(cleaned).not.toContain('style=');
  expect(cleaned).not.toContain('class=');
});
```

**Step 2: 运行单测确认失败**

Run:

```bash
pnpm run test:unit -- src/server/rss/parseFeed.test.ts
```

Expected: FAIL（`sanitizeContent` 目前不支持 `baseUrl` 与相对 URL/`srcset` 规范化，也未补齐 `rel/target` 与 `decoding`）。

---

## Phase 2：实现 `sanitizeContent` 规范化（让测试转绿）

### Task 3: 改造 `sanitizeContent`（allowlist + transformTags + exclusiveFilter）

**Files:**

- Modify: `src/server/rss/sanitizeContent.ts`
- Modify: `src/server/rss/parseFeed.test.ts`

**Step 1: 更新 `sanitizeContent` 签名**

将导出函数改为：

```ts
export function sanitizeContent(
  html: string | null | undefined,
  options: { baseUrl: string } | undefined = undefined,
): string | null
```

**Step 2: 实现 URL 归一化与属性补全（完整实现示例）**

用下面的实现替换当前文件内容（保留 `import sanitizeHtml ...`）：

```ts
import sanitizeHtml from 'sanitize-html';

const allowedTags = [...sanitizeHtml.defaults.allowedTags, 'img'];

const allowedAttributes: sanitizeHtml.IOptions['allowedAttributes'] = {
  ...sanitizeHtml.defaults.allowedAttributes,
  a: ['href', 'name', 'target', 'rel'],
  img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
};

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeUrl(value: string, base: URL | null): URL | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;

  try {
    return base ? new URL(normalized, base) : new URL(normalized);
  } catch {
    return null;
  }
}

function isAllowedScheme(url: URL, allowed: readonly string[]): boolean {
  return allowed.includes(url.protocol);
}

function mergeRel(existing: string | undefined, required: string[]): string {
  const tokens = new Set<string>();
  (existing ?? '')
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .forEach((token) => tokens.add(token));

  required.forEach((token) => tokens.add(token));
  return Array.from(tokens).join(' ');
}

function normalizeSrcset(value: string, base: URL | null): string | null {
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const normalized = parts
    .map((part) => {
      const [rawUrl, ...descriptorParts] = part.split(/\s+/);
      if (!rawUrl) return null;
      const url = normalizeUrl(rawUrl, base);
      if (!url) return null;
      if (!isAllowedScheme(url, ['http:', 'https:'])) return null;

      const descriptor = descriptorParts.join(' ').trim();
      return descriptor ? `${url.toString()} ${descriptor}` : url.toString();
    })
    .filter((item): item is string => Boolean(item));

  return normalized.length ? normalized.join(', ') : null;
}

function normalizeNumeric(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? trimmed : undefined;
}

export function sanitizeContent(
  html: string | null | undefined,
  options: { baseUrl: string } | undefined = undefined,
): string | null {
  if (!html) return null;

  const base = options?.baseUrl ? parseUrl(options.baseUrl) : null;

  const cleaned = sanitizeHtml(html, {
    allowedTags,
    allowedAttributes,
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https'],
    },
    allowProtocolRelative: false,
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href?.trim();
        if (!href) {
          return { tagName, attribs };
        }

        if (href.startsWith('#')) {
          const { target: _target, rel: _rel, ...rest } = attribs;
          return { tagName, attribs: { ...rest, href } };
        }

        const url = normalizeUrl(href, base);
        if (!url) {
          const { href: _href, ...rest } = attribs;
          return { tagName, attribs: rest };
        }

        if (!isAllowedScheme(url, ['http:', 'https:', 'mailto:'])) {
          const { href: _href, ...rest } = attribs;
          return { tagName, attribs: rest };
        }

        if (url.protocol === 'mailto:') {
          const { target: _target, rel: _rel, ...rest } = attribs;
          return { tagName, attribs: { ...rest, href: url.toString() } };
        }

        return {
          tagName,
          attribs: {
            ...attribs,
            href: url.toString(),
            target: '_blank',
            rel: mergeRel(attribs.rel, ['noopener', 'noreferrer', 'ugc']),
          },
        };
      },
      img: (tagName, attribs) => {
        const rawSrc = (attribs.src ?? attribs['data-src'] ?? '').trim();
        const srcUrl = rawSrc ? normalizeUrl(rawSrc, base) : null;
        const src = srcUrl && isAllowedScheme(srcUrl, ['http:', 'https:']) ? srcUrl.toString() : undefined;

        const rawSrcset = (attribs.srcset ?? attribs['data-srcset'] ?? '').trim();
        const srcset = rawSrcset ? normalizeSrcset(rawSrcset, base) ?? undefined : undefined;

        const width = normalizeNumeric(attribs.width);
        const height = normalizeNumeric(attribs.height);

        return {
          tagName,
          attribs: {
            ...(src ? { src } : {}),
            ...(srcset ? { srcset } : {}),
            ...(attribs.alt ? { alt: attribs.alt } : {}),
            ...(attribs.title ? { title: attribs.title } : {}),
            ...(width ? { width } : {}),
            ...(height ? { height } : {}),
            loading: attribs.loading?.trim() ? attribs.loading : 'lazy',
            decoding: attribs.decoding?.trim() ? attribs.decoding : 'async',
          },
        };
      },
    },
  });

  const trimmed = cleaned.trim();
  return trimmed.length > 0 ? trimmed : null;
}
```

**Step 3: 调整/补充测试断言（如有必要）**

如果因为属性顺序或 `rel` 合并顺序导致断言不稳定，将断言改为 `toContain(...)`（避免做整串等值比较）。

**Step 4: 运行单测确认通过**

Run:

```bash
pnpm run test:unit -- src/server/rss/parseFeed.test.ts
```

Expected: PASS。

**Step 5: Commit**

```bash
git add src/server/rss/sanitizeContent.ts src/server/rss/parseFeed.test.ts
git commit -m "feat(rss): 规范化正文链接与图片属性"
```

---

## Phase 3：抓取入库时传入 baseUrl（让相对 URL 真正可用）

### Task 4: 在 worker 侧计算 `baseUrl` 并传入 `sanitizeContent`

**Files:**

- Modify: `src/worker/index.ts`

**Step 1: 计算 baseUrl 并传参**

在 `for (const item of parsed.items)` 循环内，调用 `insertArticleIgnoreDuplicate` 前准备 `baseUrl`：

```ts
const baseUrl = item.link ?? parsed.link ?? feed.url;
```

并将：

```ts
contentHtml: sanitizeContent(item.contentHtml),
```

改为：

```ts
contentHtml: sanitizeContent(item.contentHtml, { baseUrl }),
```

**Step 2: 运行验证**

Run:

```bash
pnpm run lint
pnpm run test:unit
```

Expected: PASS。

**Step 3: Commit**

```bash
git add src/worker/index.ts
git commit -m "refactor(worker): 传递正文清洗 baseUrl"
```

---

## Phase 4：最终验证（避免“只测单测不测构建”）

### Task 5: 全量验证

**Files:** 无

Run:

```bash
pnpm run lint
pnpm run test:unit
pnpm run build
```

Expected: 全部 PASS。

---

## Manual Checks（可选但推荐）

- 本地跑 `pnpm run worker:dev` 刷新一轮抓取，然后在阅读器里打开新抓取文章：
  - 图片是否更清晰（`srcset` 保留）且不再出现 broken 相对链接
  - 链接是否默认新标签页打开，且 `rel` 包含 `noopener noreferrer ugc`


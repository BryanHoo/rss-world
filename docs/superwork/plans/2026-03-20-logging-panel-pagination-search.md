# 日志记录分页搜索优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superwork-subagent-driven-development (recommended) or superwork-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为设置中心日志模块增加记录阈值配置，并把日志查看改为“关键词搜索 + 固定高度分页 + 单行摘要 + 行内展开详情”。

**Architecture:** 继续复用现有 `PersistedSettings.logging`、`systemLogger`、`/api/logs` 和设置中心抽屉，不扩展日志系统边界。实现重点是三条链路同时收口：配置层新增 `minLevel` 并在 logger 内统一执行阈值判断；读取链路把 cursor 查询切到 `keyword + page + pageSize`；前端日志面板拆成小组件，使用固定高度布局、搜索 debounce、简洁分页器和行内展开详情。

**Tech Stack:** Next.js 16 + React 19 + TypeScript + Zustand + pg + Zod + Vitest + Testing Library + ky + Tailwind CSS + shadcn/ui primitives

---

## Context Snapshot

- Approved spec:
  - `docs/superwork/specs/2026-03-20-logging-panel-pagination-search-design.md`
- Related earlier design:
  - `docs/superpowers/specs/2026-03-19-settings-logging-design.md`
- Existing logging implementation entry points:
  - `src/types/index.ts`
  - `src/features/settings/settingsSchema.ts`
  - `src/server/logging/systemLogger.ts`
  - `src/server/repositories/systemLogsRepo.ts`
  - `src/server/services/systemLogsService.ts`
  - `src/app/api/logs/route.ts`
  - `src/lib/apiClient.ts`
  - `src/features/settings/panels/LogsSettingsPanel.tsx`
  - `src/features/settings/SettingsCenterDrawer.tsx`
- Existing focused tests worth extending:
  - `src/features/settings/settingsSchema.test.ts`
  - `src/store/settingsStore.test.ts`
  - `src/app/api/settings/routes.test.ts`
  - `src/server/logging/systemLogger.test.ts`
  - `src/server/repositories/systemLogsRepo.test.ts`
  - `src/server/services/systemLogsService.test.ts`
  - `src/app/api/logs/route.test.ts`
  - `src/lib/apiClient.test.ts`
  - `src/features/settings/panels/LogsSettingsPanel.test.tsx`
  - `src/features/settings/SettingsCenterModal.test.tsx`
- Relevant summaries:
  - `docs/summaries/` 中没有命中的相关 summary；按现有代码与 spec 直接规划。
- Project constraints:
  - 不自动做浏览器测试。
  - 最终验证必须运行 `pnpm build`。
  - Node 相关命令优先使用 `pnpm`。
  - Python 命令必须使用 `python3`。
- Execution preference:
  - 建议先在独立 worktree 中执行本计划，再开始实现。

## Scope Check

该 spec 只覆盖一个连续子系统：设置中心中的日志配置与日志查看链路。它跨越配置、查询和 UI，但都服务于同一个用户目标，不需要再拆成多份计划。为了降低回归风险，按 3 个可独立提交的任务推进：

1. 先收口配置模型和 logger 阈值行为。
2. 再切换 `/api/logs` 的查询契约。
3. 最后重构日志面板 UI，并用定向测试锁定交互。

## File Structure Plan

Planned creates:
- `src/features/settings/panels/logs/LogSearchBar.tsx`
  - 顶部搜索输入和结果概览，保持 `LogsSettingsPanel` 不直接堆 UI 细节。
- `src/features/settings/panels/logs/LogList.tsx`
  - 管理日志列表容器、空态、错误态和页内容渲染。
- `src/features/settings/panels/logs/LogListItem.tsx`
  - 单条日志的单行摘要、语义色、展开/收起详情。
- `src/features/settings/panels/logs/LogsPagination.tsx`
  - 简洁分页器，只负责“上一页 / 当前页 / 下一页”。

Planned modifies:
- `src/types/index.ts`
  - 为 `LoggingSettings` 增加 `minLevel`，并新增共享的 `SystemLogsPage` 返回类型。
- `src/features/settings/settingsSchema.ts`
  - 增加 `logging.minLevel` 默认值与归一化。
- `src/features/settings/settingsSchema.test.ts`
  - 锁定 `minLevel` 默认值和非法值回退。
- `src/store/settingsStore.test.ts`
  - 锁定 `saveDraft()` 发送包含 `minLevel` 的设置体。
- `src/app/api/settings/routes.test.ts`
  - 锁定 GET/PUT 返回的 `logging` 形状升级。
- `src/server/logging/systemLogger.ts`
  - 在统一写入口中实现 `minLevel` 阈值判断。
- `src/server/logging/systemLogger.test.ts`
  - 锁定阈值判断与 `forceWrite` 特例。
- `src/server/repositories/systemLogsRepo.ts`
  - 将列表查询改为 `keyword + page + pageSize`，返回 `total`。
- `src/server/repositories/systemLogsRepo.test.ts`
  - 锁定 `count(*)`、`ILIKE`、`offset/limit` 和稳定排序。
- `src/server/services/systemLogsService.ts`
  - 去掉 cursor helper，归一化页码查询并返回 `hasPreviousPage / hasNextPage`。
- `src/server/services/systemLogsService.test.ts`
  - 锁定页码参数归一化和返回 DTO。
- `src/app/api/logs/route.ts`
  - 改为接受 `keyword / page / pageSize` 的校验模型。
- `src/app/api/logs/route.test.ts`
  - 锁定查询参数验证和响应结构。
- `src/lib/apiClient.ts`
  - 改造 `getSystemLogs()` 的请求参数和返回结构。
- `src/lib/apiClient.test.ts`
  - 锁定 `/api/logs` 查询串拼装。
- `src/features/settings/panels/LogsSettingsPanel.tsx`
  - 改为高度感知布局，编排搜索、分页、展开态和设置项。
- `src/features/settings/panels/LogsSettingsPanel.test.tsx`
  - 锁定 debounce 搜索、分页、行内展开、空态和语义色。
- `src/features/settings/SettingsCenterDrawer.tsx`
  - 给 `logging` 页签补 `h-full min-h-0` 布局约束。
- `src/features/settings/SettingsCenterModal.test.tsx`
  - 更新 `/api/logs` mock 返回形状，避免老的 cursor 数据结构污染测试。

Skills reference for implementers:
- `@vitest`
- `@nodejs-best-practices`
- `@vercel-react-best-practices`
- `@superwork-verification-before-completion`

## Task 1: 配置层与统一 logger 阈值

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/features/settings/settingsSchema.ts`
- Modify: `src/features/settings/settingsSchema.test.ts`
- Modify: `src/store/settingsStore.test.ts`
- Modify: `src/app/api/settings/routes.test.ts`
- Modify: `src/server/logging/systemLogger.ts`
- Modify: `src/server/logging/systemLogger.test.ts`

- [ ] **Step 1: 先写失败测试，锁定 `minLevel` 默认值、保存链路和 logger 阈值**

```ts
it('adds logging minLevel defaults and falls back unsupported values', () => {
  expect(normalizePersistedSettings({}).logging).toEqual({
    enabled: false,
    retentionDays: 7,
    minLevel: 'info',
  });

  expect(
    normalizePersistedSettings({
      logging: { enabled: true, retentionDays: 14, minLevel: 'debug' },
    }).logging,
  ).toEqual({
    enabled: true,
    retentionDays: 14,
    minLevel: 'info',
  });
});

it('persists logging minLevel through settingsStore saveDraft', async () => {
  useSettingsStore.getState().loadDraft();
  useSettingsStore.getState().updateDraft((draft) => {
    draft.persisted.logging.enabled = true;
    draft.persisted.logging.retentionDays = 14;
    draft.persisted.logging.minLevel = 'warning';
  });

  await useSettingsStore.getState().saveDraft();
  expect(lastSettingsPutBodyText).toContain(
    '"logging":{"enabled":true,"retentionDays":14,"minLevel":"warning"}',
  );
});

it('skips info logs when minLevel is warning', async () => {
  getUiSettingsMock.mockResolvedValue({
    logging: { enabled: true, retentionDays: 7, minLevel: 'warning' },
  });

  const result = await writeSystemLog(
    {} as never,
    { level: 'info', category: 'settings', source: 'route', message: 'x' },
  );

  expect(result).toEqual({ written: false });
  expect(insertSystemLogMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行定向测试，确认当前实现缺少 `minLevel` 并因此失败**

Run: `pnpm test:unit src/features/settings/settingsSchema.test.ts src/store/settingsStore.test.ts src/app/api/settings/routes.test.ts src/server/logging/systemLogger.test.ts`

Expected: FAIL，报错会集中在 `logging.minLevel` 不存在，或 `systemLogger` 仍会写入低于阈值的日志。

- [ ] **Step 3: 用最小实现补齐共享类型、schema 默认值和 logger 阈值判断**

```ts
export interface LoggingSettings {
  enabled: boolean;
  retentionDays: LoggingRetentionDays;
  minLevel: SystemLogLevel;
}
```

```ts
const defaultLoggingSettings: LoggingSettings = {
  enabled: false,
  retentionDays: 7,
  minLevel: 'info',
};

function normalizeLoggingSettings(input: Record<string, unknown>): LoggingSettings {
  const loggingInput = isRecord(input.logging) ? input.logging : {};
  return {
    enabled: readBoolean(loggingInput.enabled, defaultLoggingSettings.enabled),
    retentionDays: readNumberEnum(
      loggingInput.retentionDays,
      [1, 3, 7, 14, 30, 90] as const,
      defaultLoggingSettings.retentionDays,
    ),
    minLevel: readEnum(
      loggingInput.minLevel,
      ['info', 'warning', 'error'] as const,
      defaultLoggingSettings.minLevel,
    ),
  };
}
```

```ts
const logLevelWeight: Record<SystemLogLevel, number> = {
  info: 1,
  warning: 2,
  error: 3,
};

function meetsMinimumLevel(minLevel: SystemLogLevel, level: SystemLogLevel) {
  return logLevelWeight[level] >= logLevelWeight[minLevel];
}

if (!logging.enabled && !options?.forceWrite) {
  return { written: false };
}

if (!options?.forceWrite && !meetsMinimumLevel(logging.minLevel, input.level)) {
  return { written: false };
}
```

- [ ] **Step 4: 重新运行同一组测试，确认阈值与设置保存链路通过**

Run: `pnpm test:unit src/features/settings/settingsSchema.test.ts src/store/settingsStore.test.ts src/app/api/settings/routes.test.ts src/server/logging/systemLogger.test.ts`

Expected: PASS，且 `forceWrite` 仍能绕过开关/阈值写入边界日志。

- [ ] **Step 5: 提交这一块**

```bash
git add src/types/index.ts src/features/settings/settingsSchema.ts src/features/settings/settingsSchema.test.ts src/store/settingsStore.test.ts src/app/api/settings/routes.test.ts src/server/logging/systemLogger.ts src/server/logging/systemLogger.test.ts
git commit -m "feat(logging): 添加日志记录阈值配置" \
  -m $'- 添加 logging.minLevel 默认值与归一化\n- 更新设置保存测试与日志配置返回结构\n- 优化 systemLogger 阈值判断与 forceWrite 旁路'
```

## Task 2: 将 `/api/logs` 改为关键词页码查询契约

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/server/repositories/systemLogsRepo.ts`
- Modify: `src/server/repositories/systemLogsRepo.test.ts`
- Modify: `src/server/services/systemLogsService.ts`
- Modify: `src/server/services/systemLogsService.test.ts`
- Modify: `src/app/api/logs/route.ts`
- Modify: `src/app/api/logs/route.test.ts`
- Modify: `src/lib/apiClient.ts`
- Modify: `src/lib/apiClient.test.ts`

- [ ] **Step 1: 先写失败测试，锁定 SQL 搜索/分页、service DTO、route 校验和 apiClient 查询串**

```ts
it('lists logs by keyword and offset pagination', async () => {
  const result = await listSystemLogs(pool, {
    keyword: 'summary',
    page: 2,
    pageSize: 20,
  });

  expect(query).toHaveBeenNthCalledWith(
    1,
    expect.stringContaining('count(*)'),
    ['%summary%', '%summary%', '%summary%'],
  );
  expect(query).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining('offset $4 limit $5'),
    ['%summary%', '%summary%', '%summary%', 20, 20],
  );
  expect(result.total).toBe(42);
});

it('maps page response without cursor fields', async () => {
  listSystemLogsRepoMock.mockResolvedValue({
    items: [],
    total: 42,
  });

  const result = await getSystemLogs({} as never, {
    keyword: 'summary',
    page: 2,
    pageSize: 20,
  });

  expect(result).toEqual({
    items: [],
    page: 2,
    pageSize: 20,
    total: 42,
    hasPreviousPage: true,
    hasNextPage: true,
  });
});

it('rejects unsupported query params and validates page/pageSize', async () => {
  const res = await GET(new Request('http://localhost/api/logs?level=error&page=0'));
  expect(res.status).toBe(400);
});

it('builds /api/logs query with keyword, page and pageSize', async () => {
  await getSystemLogs({ keyword: 'summary', page: 2, pageSize: 20 });
  expect(getFetchCallUrl(fetchMock.mock.calls[0][0])).toContain(
    '/api/logs?keyword=summary&page=2&pageSize=20',
  );
});
```

- [ ] **Step 2: 运行定向测试，确认 cursor 相关实现与新契约不兼容**

Run: `pnpm test:unit src/server/repositories/systemLogsRepo.test.ts src/server/services/systemLogsService.test.ts src/app/api/logs/route.test.ts src/lib/apiClient.test.ts`

Expected: FAIL，报错会集中在 `level/before/limit`、`nextCursor/hasMore`、cursor helper 和旧 query string 断言上。

- [ ] **Step 3: 用最小实现切换 repository、service、route 与客户端契约**

```ts
export interface SystemLogsPage {
  items: SystemLogItem[];
  page: number;
  pageSize: number;
  total: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}
```

```ts
// src/server/repositories/systemLogsRepo.ts
export async function listSystemLogs(
  pool: Queryable,
  input: { keyword?: string; page: number; pageSize: number },
): Promise<{ items: SystemLogItem[]; total: number }> {
  const keyword = input.keyword?.trim();
  const params = keyword
    ? [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`]
    : [];

  const whereSql = keyword
    ? `where (message ilike $1 or source ilike $2 or category ilike $3)`
    : '';

  const offset = (input.page - 1) * input.pageSize;
  // 先 count(*) 再 select ... order by created_at desc, id desc offset ... limit ...
}
```

```ts
// src/server/services/systemLogsService.ts
export async function getSystemLogs(
  pool: Pool,
  input: { keyword?: string; page?: number; pageSize?: number } = {},
) {
  const page = normalizePage(input.page);
  const pageSize = normalizePageSize(input.pageSize);
  const result = await listSystemLogs(pool, { keyword: normalizeKeyword(input.keyword), page, pageSize });
  return {
    items: result.items,
    page,
    pageSize,
    total: result.total,
    hasPreviousPage: page > 1,
    hasNextPage: page * pageSize < result.total,
  };
}
```

```ts
// src/app/api/logs/route.ts
const querySchema = z.object({
  keyword: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});
```

```ts
// src/lib/apiClient.ts
export async function getSystemLogs(input: {
  keyword?: string;
  page?: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams();
  if (input.keyword?.trim()) params.set('keyword', input.keyword.trim());
  if (typeof input.page === 'number') params.set('page', String(input.page));
  if (typeof input.pageSize === 'number') params.set('pageSize', String(input.pageSize));
  return requestApi(query ? `/api/logs?${query}` : '/api/logs');
}
```

- [ ] **Step 4: 重新运行定向测试，确认新的查询契约稳定**

Run: `pnpm test:unit src/server/repositories/systemLogsRepo.test.ts src/server/services/systemLogsService.test.ts src/app/api/logs/route.test.ts src/lib/apiClient.test.ts`

Expected: PASS，且断言中不再出现 `nextCursor`、`hasMore`、`before` 或 `level`。

- [ ] **Step 5: 提交这一块**

```bash
git add src/server/repositories/systemLogsRepo.ts src/server/repositories/systemLogsRepo.test.ts src/server/services/systemLogsService.ts src/server/services/systemLogsService.test.ts src/app/api/logs/route.ts src/app/api/logs/route.test.ts src/lib/apiClient.ts src/lib/apiClient.test.ts
git commit -m "refactor(logging): 切换日志分页搜索接口" \
  -m $'- 更新 systemLogsRepo 为关键词页码查询\n- 重构 systemLogsService 与 /api/logs 返回分页元数据\n- 调整 apiClient 日志请求参数与响应结构'
```

## Task 3: 重构日志面板为固定高度分页搜索界面

**Files:**
- Create: `src/features/settings/panels/logs/LogSearchBar.tsx`
- Create: `src/features/settings/panels/logs/LogList.tsx`
- Create: `src/features/settings/panels/logs/LogListItem.tsx`
- Create: `src/features/settings/panels/logs/LogsPagination.tsx`
- Modify: `src/features/settings/panels/LogsSettingsPanel.tsx`
- Modify: `src/features/settings/panels/LogsSettingsPanel.test.tsx`
- Modify: `src/features/settings/SettingsCenterDrawer.tsx`
- Modify: `src/features/settings/SettingsCenterModal.test.tsx`

- [ ] **Step 1: 先写失败测试，锁定新交互**

```ts
it('debounces keyword search and resets to page 1', async () => {
  vi.useFakeTimers();
  getSystemLogsMock.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  });

  render(<LogsSettingsPanel draft={createDraft()} onChange={() => undefined} />);
  const input = await screen.findByRole('textbox', { name: '搜索日志' });

  fireEvent.change(input, { target: { value: 'summary' } });
  vi.advanceTimersByTime(299);
  expect(getSystemLogsMock).toHaveBeenCalledTimes(1);

  vi.advanceTimersByTime(1);
  await waitFor(() => {
    expect(getSystemLogsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: 'summary', page: 1, pageSize: 20 }),
    );
  });
});

it('expands details inline when clicking a log row', async () => {
  render(
    <LogsSettingsPanel
      draft={createDraft()}
      onChange={() => undefined}
      initialLogsPage={{
        items: [
          {
            id: '1',
            level: 'error',
            category: 'external_api',
            message: 'AI summary request failed',
            details: '{"error":{"message":"429"}}',
            source: 'aiSummaryStreamWorker',
            context: { status: 429 },
            createdAt: '2026-03-19T10:12:30.000Z',
          },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      }}
    />,
  );

  expect(screen.queryByText('{"error":{"message":"429"}}')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /AI summary request failed/i }));
  expect(screen.getByText('{"error":{"message":"429"}}')).toBeInTheDocument();
});

it('shows previous/next pagination instead of load more', async () => {
  expect(screen.queryByRole('button', { name: '加载更多' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '下一页' })).toBeEnabled();
});
```

- [ ] **Step 2: 运行 UI 定向测试，确认现有列表模型与新交互不匹配**

Run: `pnpm test:unit src/features/settings/panels/LogsSettingsPanel.test.tsx src/features/settings/SettingsCenterModal.test.tsx`

Expected: FAIL，报错会集中在：
- 组件还在使用 `initialNextCursor / initialHasMore`
- 仍显示等级筛选按钮和“加载更多”
- 没有搜索输入框、分页按钮和行内展开行为

- [ ] **Step 3: 先拆展示子组件，再让 `LogsSettingsPanel` 编排状态和请求**

```tsx
// src/features/settings/panels/logs/LogSearchBar.tsx
export interface LogSearchBarProps {
  keyword: string;
  total: number;
  page: number;
  totalPages: number;
  onKeywordChange: (value: string) => void;
}

export function LogSearchBar(props: LogSearchBarProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Input
        aria-label="搜索日志"
        value={props.keyword}
        onChange={(event) => props.onKeywordChange(event.target.value)}
        placeholder="搜索 message、source、category"
      />
      <p className="shrink-0 text-xs text-muted-foreground">
        共 {props.total} 条 · 第 {props.page} / {Math.max(props.totalPages, 1)} 页
      </p>
    </div>
  );
}
```

```tsx
// src/features/settings/panels/logs/LogsPagination.tsx
export function LogsPagination({ page, totalPages, onPrevious, onNext }: Props) {
  if (totalPages <= 0) return null;
  return (
    <div className="flex items-center justify-between gap-3">
      <Button type="button" variant="outline" size="compact" disabled={page <= 1} onClick={onPrevious}>
        上一页
      </Button>
      <p className="text-xs text-muted-foreground">第 {page} 页，共 {totalPages} 页</p>
      <Button type="button" variant="outline" size="compact" disabled={page >= totalPages} onClick={onNext}>
        下一页
      </Button>
    </div>
  );
}
```

```tsx
// src/features/settings/panels/LogsSettingsPanel.tsx
const [keywordInput, setKeywordInput] = useState('');
const [keyword, setKeyword] = useState('');
const [page, setPage] = useState(1);
const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

useEffect(() => {
  const timer = window.setTimeout(() => {
    setKeyword(keywordInput.trim());
    setPage(1);
    setExpandedLogId(null);
  }, 300);
  return () => window.clearTimeout(timer);
}, [keywordInput]);

useEffect(() => {
  void loadLogs({ keyword, page, pageSize: 20 });
}, [keyword, page]);
```

- [ ] **Step 4: 把颜色、摘要和空态细节锁紧，不要把交互散回主文件**

Implementation checklist:
- 在 `LogListItem` 内根据 `level` 映射轻量语义色，例如 `info` 使用主色轻背景，`warning` 使用 `warning` 语义色，`error` 使用 `error` 语义色。
- 默认只渲染一行 `message`，使用 `truncate` 或等效 class 收口。
- `details` 与 `context` 仅在展开态出现，继续使用纯文本 `<pre>`。
- 日志为空时：
  - 无关键字显示 `暂无日志`
  - 有关键字显示 `没有匹配的日志`
- 空结果不显示分页器。
- `SettingsCenterDrawer.tsx` 中给 `logging` 页签和内容区补 `h-full min-h-0 flex flex-col`，避免列表依赖外层滚动。
- `SettingsCenterModal.test.tsx` 的 `/api/logs` mock 返回值同步改为：

```ts
{
  items: [],
  page: 1,
  pageSize: 20,
  total: 0,
  hasPreviousPage: false,
  hasNextPage: false,
}
```

- [ ] **Step 5: 重新运行 UI 定向测试，确认搜索、分页、展开和布局都稳定**

Run: `pnpm test:unit src/features/settings/panels/LogsSettingsPanel.test.tsx src/features/settings/SettingsCenterModal.test.tsx`

Expected: PASS，且断言中不再出现等级筛选按钮或“加载更多”。

- [ ] **Step 6: 提交这一块**

```bash
git add src/features/settings/panels/logs/LogSearchBar.tsx src/features/settings/panels/logs/LogList.tsx src/features/settings/panels/logs/LogListItem.tsx src/features/settings/panels/logs/LogsPagination.tsx src/features/settings/panels/LogsSettingsPanel.tsx src/features/settings/panels/LogsSettingsPanel.test.tsx src/features/settings/SettingsCenterDrawer.tsx src/features/settings/SettingsCenterModal.test.tsx
git commit -m "feat(logging): 重构日志面板分页搜索交互" \
  -m $'- 拆分日志搜索、列表项与分页器组件\n- 改为固定高度分页浏览、关键词搜索与行内展开\n- 移除等级查看筛选与加载更多交互'
```

## Final Verification

- [ ] **Step 1: 跑所有受影响的定向测试，确认三块改动能一起工作**

Run: `pnpm test:unit src/features/settings/settingsSchema.test.ts src/store/settingsStore.test.ts src/app/api/settings/routes.test.ts src/server/logging/systemLogger.test.ts src/server/repositories/systemLogsRepo.test.ts src/server/services/systemLogsService.test.ts src/app/api/logs/route.test.ts src/lib/apiClient.test.ts src/features/settings/panels/LogsSettingsPanel.test.tsx src/features/settings/SettingsCenterModal.test.tsx`

Expected: PASS

- [ ] **Step 2: 跑完整构建验证**

Run: `pnpm build`

Expected: BUILD SUCCESS，没有 TypeScript、Next.js 或 route 导出错误。

- [ ] **Step 3: 检查最终工作区状态**

Run: `git status --short`

Expected: 仅剩本计划执行过程中预期的已提交或待提交文件；没有意外改动。

## Review Notes

- 本计划按 `superwork-writing-plans` 应执行 reviewer subagent 审阅，但当前会话没有显式的子代理授权。
- 这里改为本地人工审阅，重点确认了三点：
  - `minLevel` 不要求新增数据库字段，只影响设置与写入阈值。
  - `/api/logs` 的契约切换只影响单一调用方，适合一次性替换。
  - UI 层拆分 4 个小组件是为了让固定高度、分页和行内展开更易测试，不是无意义重构。

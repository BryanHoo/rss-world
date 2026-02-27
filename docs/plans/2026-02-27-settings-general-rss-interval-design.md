# 设置中心：`appearance` → `general` 迁移 + RSS 全局抓取间隔（写回 feeds）+ 通用行为设置 设计

日期：2026-02-27  
状态：已确认（Approved）

## TL;DR

- 将 `PersistedSettings.appearance` 更名为 `PersistedSettings.general`，设置中心左侧分组“外观”改为“通用”（但不仅改 UI：**底层 key 一起迁移**）。
- 设置中心新增 `rss` 分组：提供
  - `rss.fetchIntervalMinutes`（固定档位：`5/15/30/60/120` 分钟）
  - `rss.fullTextOnOpenEnabled`（从通用面板挪到 RSS 面板）
- `PUT /api/settings` 在 `rss.fetchIntervalMinutes` 变化时：事务内写入 `app_settings.ui_settings`，并**批量更新所有** `feeds.fetch_interval_minutes`（写回型，应用到所有源）。
- worker 抓取调度遵守 `feeds.fetch_interval_minutes`：
  - `JOB_REFRESH_ALL` 每分钟触发（`* * * * *`）
  - refresh_all 仅 enqueue “到期”的 feeds
  - `feed.fetch` 再兜底做一次到期检查（非 `force` 时可跳过）
  - 手动刷新（`POST /api/feeds/:id/refresh`）使用 `force: true` 保证立即抓取
- 一并新增 3 个通用偏好设置（放在 `general`）：
  - 自动标记已读（开关 + 延迟档位）
  - 文章列表（all 视图）默认“仅未读”
  - 记住侧边栏折叠状态

## 背景

当前设置中心的“外观”面板已包含非外观项（例如 `rss.fullTextOnOpenEnabled`），且 RSS 抓取频率相关字段在数据库已存在（`feeds.fetch_interval_minutes`），但 worker 仍采用固定 5 分钟扫描并对所有源 enqueue，无法让“抓取间隔”成为用户可控且可解释的配置项。

同时，现有 `PersistedSettings.appearance` 的语义更接近“通用偏好设置”，因此需要将其更名为 `general` 并在前后端做兼容迁移。

## 目标

- 设置结构更贴合语义：`appearance` → `general`，并新增 `rss` 分组承载抓取/全文等 RSS 相关配置。
- 提供“全局 RSS 抓取间隔”并确保对所有订阅源生效（写回 DB）。
- worker 抓取频率严格遵守 `feeds.fetch_interval_minutes`（误差 < 1 分钟）。
- 增加用户可控的通用行为偏好：
  - 自动标记已读行为可配置
  - 文章列表默认仅未读可配置
  - 侧边栏折叠状态可记忆

## 非目标

- 不提供每个 feed 单独设置抓取间隔（本期为全局写回所有源）。
- 不提供抓取间隔的自由输入（本期固定档位）。
- 不引入新的实时推送机制（SSE/WebSocket）；仍以现有刷新策略为主。

## 设置结构与字段（最终形态）

### `PersistedSettings`

```ts
interface PersistedSettings {
  general: {
    theme: 'light' | 'dark' | 'auto';
    fontSize: 'small' | 'medium' | 'large';
    fontFamily: 'sans' | 'serif';
    lineHeight: 'compact' | 'normal' | 'relaxed';
    autoMarkReadEnabled: boolean;
    autoMarkReadDelayMs: 0 | 2000 | 5000;
    defaultUnreadOnlyInAll: boolean;
    rememberSidebarCollapsed: boolean;
  };
  rss: {
    sources: RssSourceSetting[];
    fullTextOnOpenEnabled: boolean;
    fetchIntervalMinutes: 5 | 15 | 30 | 60 | 120;
  };
  ai: { /* 保持现有 */ };
  categories: Category[];
}
```

说明：
- `autoMarkReadDelayMs` 用固定档位，保证交互可预测；`0` 表示“立即标记”。
- `defaultUnreadOnlyInAll` 仅影响 `selectedView === 'all'` 时 `ArticleList` 的默认筛选状态（不改变 `unread/starred` 智能视图语义）。
- `rememberSidebarCollapsed` 仅控制是否将折叠状态写入设置；关闭时继续使用当前 session 状态（刷新后回到默认展开）。

### 默认值建议

- `general.autoMarkReadEnabled = true`
- `general.autoMarkReadDelayMs = 2000`
- `general.defaultUnreadOnlyInAll = false`
- `general.rememberSidebarCollapsed = true`
- `rss.fetchIntervalMinutes = 30`
- 其它字段沿用现有默认值

## 兼容迁移策略（读旧写新）

### 后端（DB：`app_settings.ui_settings`）

- `GET /api/settings`：读取 raw `ui_settings` 后做 `normalizePersistedSettings`，输出永远为 `{ general, rss, ai, categories }`。
- `PUT /api/settings`：接收任意输入（可能包含旧 `appearance`），normalize 后写入 DB（写入新结构）。

### 前端（`localStorage`：`feedfuse-settings`）

- bump `useSettingsStore` persist `version`，在 `migrate/merge` 中把旧的 `persistedSettings.appearance` 迁移为 `persistedSettings.general`。
- 保留 `settings: UserSettings` 作为兼容层，但其来源从 `persistedSettings.appearance` 改为 `persistedSettings.general`。

## 设置中心 UI / 信息架构

### Tabs

- `general`：label `通用`，hint `主题与行为`
- `rss`：label `RSS`，hint `抓取与全文`
- `ai`：保持
- `categories`：保持

### `RSS` 面板（新增）

新增 `RssSettingsPanel`，包含两项：

1) `RSS 抓取间隔`（Select 固定档位：5/15/30/60/120 分钟）
2) `打开文章时抓取全文`（`rss.fullTextOnOpenEnabled`）

## 全局抓取间隔：后端写回策略

### 行为

当 `PUT /api/settings` 收到的 `rss.fetchIntervalMinutes` 与 DB 中当前值不同：

- 在同一事务中：
  1) 更新 `app_settings.ui_settings`
  2) `update feeds set fetch_interval_minutes = $1, updated_at = now()`（更新所有 feed）

并且仅在该字段变化时触发批量更新，避免设置中心自动保存时产生无谓的全表写入。

## worker 调度与到期判定

### refresh_all 触发频率

将 `JOB_REFRESH_ALL` 的 schedule 调整为每分钟执行（`* * * * *`），确保 `5` 分钟档位也能接近真实间隔（误差 < 1 分钟），避免现有 `*/5` 在非对齐情况下造成接近 10 分钟的等待。

### 到期判定

两层保险：

1) refresh_all：仅 enqueue “到期”的 feeds（基于 `last_fetched_at + fetch_interval_minutes`）
2) feed.fetch：worker 真正抓取前再做一次到期检查（非 `force` 时可跳过网络请求）

### 手动刷新

`POST /api/feeds/:id/refresh` enqueue `feed.fetch` 时带上 `force: true`，确保用户手动触发不会被到期判断拦截。

## 通用行为设置（本期新增）

### 自动标记已读

当前行为：打开文章后 2s 自动标记已读（硬编码）。

新增：
- `general.autoMarkReadEnabled`
- `general.autoMarkReadDelayMs`（0/2000/5000）

行为：
- 若关闭：不自动标记
- 若开启：在 `autoMarkReadDelayMs` 后标记（保持幂等）

### 文章列表默认仅未读

新增 `general.defaultUnreadOnlyInAll`：
- 当 `selectedView === 'all'` 且该值为 true：`ArticleList` 初始 `showUnreadOnly = true`
- 仅影响初始值；用户可在 UI 内随时切换

### 记住侧边栏折叠

新增 `general.rememberSidebarCollapsed`：
- 当为 true：每次 `toggleSidebar()` 后把折叠状态写入设置（并通过 `/api/settings` 持久化）
- 当为 false：不写入设置（刷新回默认展开）

> 注：由于 `sidebarCollapsed` 在 `useAppStore`，而设置在 `useSettingsStore`，实现时需要一处“桥接”逻辑：订阅 `toggleSidebar` 并在必要时同步到 settings。

## 测试与验收

### 单元测试建议

- `settingsSchema.test.ts`：
  - 输入旧 `appearance` 仍能 normalize 为 `general`
  - `rss.fetchIntervalMinutes` 非法值回退 `30`
- `settingsStore.test.ts` / `useTheme.test.tsx`：
  - `appearance` → `general` 的断言更新
- `/api/settings` route tests：
  - `fetchIntervalMinutes` 变化时调用“批量更新 feeds”的 repo 函数
  - 未变化时不调用
- worker（可选）：
  - feed.fetch 的到期判定分支（非 force 时跳过）

### 验收标准

- 设置中心可见 `通用/RSS/AI/分类` 四个分组。
- 修改 `RSS 抓取间隔` 后，全部 feeds 的 `fetch_interval_minutes` 被更新。
- worker 抓取频率遵守更新后的间隔（误差 < 1 分钟）。
- 自动标记已读、默认仅未读、记住侧边栏折叠三个通用设置生效。


# 中栏顶部刷新订阅源（单源/全局）设计

日期：2026-03-01  
状态：已确认（Approved）

## TL;DR

- 在中栏（文章列表 `ArticleList`）顶部新增一个刷新 icon：
  - 选中具体 RSS 源（`selectedView` 为某个 `feed.id`）：点击后强制刷新该源（`POST /api/feeds/:id/refresh`）。
  - 选中 `all / unread / starred`：点击后强制刷新全部“已启用”的 RSS 源（`POST /api/feeds/refresh`）。
- 点击后立即触发 refresh，并在前端对当前视图做短时间轮询 `loadSnapshot({ view })`，让新文章尽快出现在中栏列表（按钮转圈+禁用，切换视图自动取消轮询）。
- 后端新增 `POST /api/feeds/refresh`，复用 worker 现有 `feed.refresh_all` job，并让其支持 `force: true` 以忽略 `fetchIntervalMinutes`。

## 背景

当前 RSS 抓取主要依赖 worker 的定时 `feed.refresh_all`（按 `fetchIntervalMinutes` 判断是否 due），缺少用户在 UI 中“立即刷新某个 RSS 源/刷新全部启用源”的入口。

## 目标

1. 在中栏顶部提供一个明显且低干扰的“刷新”入口。
2. 支持两类刷新：
   - 选中某个 RSS 源时：刷新该源（强制）。
   - 在 `all / unread / starred` 视图：刷新全部启用源（强制）。
3. 刷新触发后尽快让文章列表更新（短轮询 snapshot）。
4. 失败时给出明确提示，不造成 UI 卡死或无限轮询。

## 非目标

1. 不实现“刷新完成进度 / 成功率 / 失败明细”（目前队列无完成回传机制）。
2. 不新增复杂的后台 job 状态查询接口。
3. 不改变现有文章分页/游标逻辑与 `ReaderSnapshot` 的数据结构。

## 方案总览（选定）

复用现有队列作业 `feed.refresh_all`，在 worker 侧扩展其支持 `force`：

- `force=false`：保持现状，仅刷新 due 的 feeds（定时任务使用）。
- `force=true`：刷新所有 enabled feeds，并对每个 feed enqueue `feed.fetch` 且带 `force:true`（UI 手动刷新使用）。

前端根据视图调用：

- `POST /api/feeds/:id/refresh`（单源强制刷新）
- `POST /api/feeds/refresh`（全局强制刷新）

并在触发后轮询 `loadSnapshot({ view })`（`view` 为当前 `selectedView`），让列表尽快出现新文章。

## 详细设计

### 1) UI：文章列表顶部刷新按钮

- 文件：`src/features/articles/ArticleList.tsx`
- 位置：中栏顶部 header 右侧 actions 区域
- 交互：
  - 点击后按钮进入 loading（`RefreshCw` rotate + disabled）。
  - 若 `selectedView` 为 feedId 且对应 feed 为 `enabled=false`：按钮禁用，提示“订阅源已停用”。
  - 若为全局视图且没有任何 `enabled=true` 的 feed：按钮禁用。
  - 切换 `selectedView` 时：取消当前轮询并退出 loading（避免刷错视图）。

### 2) 前端：刷新后的轮询策略（B）

- 触发 refresh API 成功返回后：
  - 立即调用一次 `loadSnapshot({ view: selectedView })`。
  - 之后每隔 1s 轮询一次，最多 20~30 次（约 20~30s），或在以下条件提前停止：
    - 用户切换了视图（`selectedView` 改变）
    - refresh 流程被新的 refresh 请求覆盖（重复点击时用 requestId 取消前一次）
  - 出错时 toast 并停止 loading（不再轮询）。

说明：该轮询不保证“刷新完成”，仅尽力在后台抓取完成后尽快让 UI 呈现新内容。

### 3) API：新增刷新全部接口

- 新增：`POST /api/feeds/refresh`
  - 文件：`src/app/api/feeds/refresh/route.ts`
  - 行为：enqueue `feed.refresh_all`，payload `{ force: true }`
  - 返回：`{ enqueued: true, jobId }`

### 4) Worker：`feed.refresh_all` 支持 `force`

- 修改：`src/worker/index.ts`
  - `enqueueRefreshAll` 读取 `force`
  - `force=true` 时对所有 enabled feeds enqueue `feed.fetch` 并传 `force:true`
  - `force=false` 保持现有 due 逻辑（定时刷新）

## 错误处理

1. refresh API 返回错误：toast `mapApiErrorToUserMessage(err, 'refresh-feed' / 'refresh-all')`，停止 loading。
2. 轮询期间 `loadSnapshot` 抛错：toast 并停止 loading。
3. UI 防抖：刷新中禁用按钮，避免重复请求；重复点击时可用 requestId 取消旧轮询。

## 测试计划

1. `src/app/api/feeds/routes.test.ts`
   - 新增用例：`POST /api/feeds/refresh` 会 enqueue `feed.refresh_all` 且 data 为 `{ force: true }`。
2. `src/features/articles/ArticleList.test.tsx`
   - `all/unread/starred` 视图下渲染刷新按钮，点击会调用“刷新全部”API。
   - feed 视图下点击会调用 `POST /api/feeds/:id/refresh`。
   - feed `enabled=false` 时按钮禁用。
   - 刷新中切换 `selectedView` 会取消 loading（不持续轮询）。

## 验收标准

1. 中栏顶部出现刷新 icon。
2. 选中具体 RSS 源时点击刷新会立刻触发该源刷新，并在抓取完成后尽快出现在文章列表。
3. 在 `all/unread/starred` 视图点击刷新会触发全部已启用源的强制刷新。
4. 刷新过程有明确的 loading 状态且不会卡死；失败时有提示。
5. 相关单测通过。

## 影响范围

- 前端：
  - `src/features/articles/ArticleList.tsx`
  - `src/lib/apiClient.ts`（新增 `refreshAllFeeds`）
  - `src/features/articles/ArticleList.test.tsx`
- API：
  - `src/app/api/feeds/refresh/route.ts`（新增）
  - `src/app/api/feeds/routes.test.ts`（新增用例）
- Worker：
  - `src/worker/index.ts`（支持 `force`）


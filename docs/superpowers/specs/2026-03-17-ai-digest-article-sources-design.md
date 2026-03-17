# AI 解读文章来源模块设计

## 1. 背景与目标

当前右栏 AI 解读文章会展示正文与 AI 摘要，但用户无法看到“本次 AI 实际用了哪些来源文章”。
这会降低结果可追溯性，也不利于快速回看原始上下文。

本次目标是在不改变 AI 解读生成主流程的前提下，新增“来源模块”：

- 仅在 `ai_digest` 文章右栏底部显示来源列表。
- 明确展示每条来源的标题、订阅源名称、发布时间。
- 点击来源条目后在应用内跳转到对应文章，并联动左栏/中栏选中状态。

## 2. 已确认需求（会话结论）

- 来源模块只在当前文章所属 `feed.kind === 'ai_digest'` 时显示。
- 模块固定渲染在右栏文章正文最底部。
- 列表项展示：`标题 + 订阅源名称 + 发布时间`。
- 排序规则：按 AI 选入顺序展示，不按时间重排。
- 点击行为：应用内跳转，左栏与中栏都要同步选中目标来源文章。
- 若当前 AI 解读文章无来源记录：显示“暂无来源记录”。
- 若当前文章不是 `ai_digest`：不显示来源模块。

## 3. 方案对比与决策

### 方案 A：持久化 run 与来源文章映射（采用）

做法：

- 新增来源映射表，保存每次 AI 解读运行使用的来源文章 ID 与顺序。
- AI 解读文章详情 API 返回来源数组给前端渲染。

优点：

- 数据稳定、可追溯，满足“真实输入来源”要求。
- 顺序可控，可严格按 AI 选入顺序展示。
- 后续可扩展（来源权重、证据片段、引用位置）。

代价：

- 需要增加 migration、repo 查询与 DTO 映射。

### 方案 B：把来源信息嵌入解读 HTML 再前端解析（不采用）

优点：表面改动少。  
缺点：对 HTML 结构高度耦合，易被 sanitize/渲染改动破坏，维护成本高。

### 方案 C：展示时按时间窗口反推来源（不采用）

优点：无需新增表。  
缺点：无法保证与当次实际输入一致，结果可漂移，不满足需求本质。

结论：采用方案 A。

## 4. 详细设计

### 4.1 数据模型

新增表：`ai_digest_run_sources`

- `run_id uuid not null`，外键引用 `ai_digest_runs(id)`，`on delete cascade`
- `source_article_id uuid not null`，外键引用 `articles(id)`
- `position int not null`，从 0 开始，表示 AI 选入顺序
- `created_at timestamptz not null default now()`

约束与索引：

- `primary key (run_id, source_article_id)`，避免同一 run 重复来源
- `unique (run_id, position)`，保证顺序槽位唯一
- 索引 `ai_digest_run_sources_source_article_idx (source_article_id)`，支持排查与扩展查询

### 4.2 生成链路写入

位置：`runAiDigestGenerate` 在得到 `selected`（最终输入 AI 的来源集合）并成功落地解读文章后写入来源映射。

建议流程：

1. 生成 `selected`（已有逻辑）。
2. 成功持久化解读文章并获得 `articleId`（已有逻辑）。
3. 替换写入来源映射：
   - `delete from ai_digest_run_sources where run_id = $1`
   - 按 `selected` 顺序批量插入 `source_article_id + position`
4. 更新 `ai_digest_runs.status = 'succeeded'`（已有逻辑）。

说明：

- `skipped_no_updates` 不写来源映射。
- 使用“先删后插”保证重试幂等，不会累计脏记录。

### 4.3 读取链路与 API 契约

扩展 `GET /api/articles/:id` 返回，新增字段（命名可按现有风格微调）：

`aiDigestSources: Array<{`

- `articleId: string`
- `feedId: string`
- `feedTitle: string`
- `title: string`
- `link: string | null`
- `publishedAt: string | null`
- `position: number`

`}>`

查询逻辑：

1. 通过 `ai_digest_runs.article_id = 当前 article.id` 找到 run。
2. 联表 `ai_digest_run_sources -> articles -> feeds` 查询来源元数据。
3. 按 `position asc` 返回。

兼容行为：

- 普通 RSS 文章：`aiDigestSources` 为空（或不返回）。
- 旧 AI 解读文章（历史无映射）：`aiDigestSources` 为空。

### 4.4 前端类型与数据映射

扩展：

- `src/types/index.ts` 中 `Article` 增加 `aiDigestSources?: ...`
- `src/lib/apiClient.ts` 中 `ArticleDto` 与 `mapArticleDto` 增加来源字段映射
- 对 snapshot 列表不要求返回来源，仅详情 `getArticle` 需要携带即可

状态更新：

- `setSelectedArticle` / `refreshArticle` 走详情接口时自然拿到来源字段并写入 store。
- 不改动中栏列表卡片结构。

### 4.5 右栏来源模块 UI 与交互

渲染条件：

- `feed.kind === 'ai_digest'` 时显示模块容器。
- 其余文章不显示模块。

渲染位置：

- `ArticleView` 正文 `article-html-content` 之后，页面最底部。

展示内容：

- 模块标题：`来源`
- 模块说明：`以下文章用于本次 AI 解读输入`（可选）
- 列表按后端顺序渲染，每项显示：
  - 标题（主文本）
  - 订阅源名称
  - 发布时间（复用现有相对时间格式函数）

空态：

- `ai_digest` 文章且来源为空时展示：`暂无来源记录`

点击行为（应用内跳转）：

1. `setSelectedView(source.feedId)`，联动左栏高亮目标 feed。
2. `loadSnapshot({ view: source.feedId })`，确保中栏列表切到目标 feed 并加载。
3. `setSelectedArticle(source.articleId)`，联动中栏高亮 + 右栏显示目标文章。
4. 若目标文章仍不可用，显示非阻塞提示（例如 toast：`来源文章暂不可用`）。

可访问性：

- 来源条目使用可聚焦可点击元素（`button` 或等价角色）。
- 支持 `Enter/Space` 触发，与鼠标行为一致。

### 4.6 错误处理

- 来源写入失败：沿用 run 失败处理，避免成功状态但来源缺失。
- 来源读取失败：接口返回错误时走现有错误处理通道，不新增特殊协议。
- 跳转失败（目标文章不存在/已被清理）：保留当前上下文并提示用户。

## 5. 测试计划

后端：

- `aiDigestGenerate`：
  - 成功生成时按顺序写入来源映射。
  - 重试时来源映射不重复且顺序正确。
  - `skipped_no_updates` 不写来源映射。
- `GET /api/articles/:id`：
  - `ai_digest` 文章返回来源列表且按 `position` 排序。
  - 普通 RSS 文章返回空来源。
  - 旧 `ai_digest` 文章返回空来源。

前端：

- `ArticleView`：
  - 当前为 `ai_digest` 且有来源时显示来源模块与条目。
  - 当前为 `ai_digest` 且无来源时显示“暂无来源记录”。
  - 当前不是 `ai_digest` 时不渲染来源模块。
  - 点击来源项触发 `setSelectedView -> loadSnapshot -> setSelectedArticle`。

## 6. 验收标准

- 仅 `ai_digest` 文章显示来源模块。
- 来源模块固定在正文最底部。
- 每条来源展示标题、订阅源名称、发布时间。
- 来源顺序与 AI 选入顺序一致。
- 点击来源后左栏/中栏/右栏联动到目标文章。
- 无来源记录时显示“暂无来源记录”。
- 普通文章不显示来源模块。

## 7. 风险与缓解

- 风险：run 写入与来源写入不一致导致数据残缺。  
  缓解：来源写入与 run 状态更新放入同一事务边界（或保证失败回滚）。

- 风险：来源文章后续被删除或不可见，点击跳转体验不稳定。  
  缓解：保留 graceful fallback（提示并保持当前视图不崩溃）。

- 风险：旧 AI 解读文章无来源，用户误解为功能异常。  
  缓解：明确空态文案“暂无来源记录”，不误导为加载中。

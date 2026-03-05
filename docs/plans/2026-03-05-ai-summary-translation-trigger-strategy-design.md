# 设计文档：订阅源级 AI 摘要/翻译触发策略与手动重跑交互重构

## 1. 背景与问题

当前行为存在三类不一致，导致配置语义与实际体验不匹配：

1. 配置项语义不足
- 订阅源侧已有 `aiSummaryOnOpenEnabled`、`titleTranslateEnabled`、`bodyTranslateEnabled`，但缺少“获取文章后自动触发”的显式配置。
- “正文翻译”当前配置与“手动按钮是否可触发”耦合，不利于表达“自动策略”和“手动强制执行”这两类不同诉求。

2. 手动按钮语义与用户预期不一致
- `翻译` 按钮当前兼具“触发翻译”与“切回原文”双重语义（`翻译/原文` 切换）。
- `AI摘要` 与 `翻译` 按钮会受到已有结果或状态机条件影响，不符合“始终可点击、点击即执行”的目标。

3. 自动触发时机覆盖不足
- 目前只有“打开文章时自动摘要”较明确，缺少“获取文章后自动摘要/自动翻译正文”的对等能力。

## 2. 目标与非目标

### 2.1 目标

- 在订阅源级别完整支持以下触发策略：
  - 获取文章后自动获取摘要
  - 打开文章自动获取摘要
  - 获取文章后自动翻译正文
  - 打开文章自动翻译正文
  - 列表标题获取后自动翻译
- `AI摘要` / `翻译` 按钮始终可点击，点击即“强制重新生成”（`force`）。
- `翻译` 按钮不再承担“切回原文”功能；再次点击始终再次触发翻译。
- 打开文章自动翻译触发后，自动切换到翻译视图。
- 保持 `fulltext_pending` 约束：全文未完成时不执行摘要/翻译生成，返回等待反馈。

### 2.2 非目标

- 不改动沉浸式翻译渲染的核心实现（保持“原 HTML 增强渲染”路径）。
- 不引入全局级触发策略（本次仅订阅源级）。
- 不在本次扩展新的翻译模式（如整页翻译、多语言目标切换）。

## 3. 已有约束与已知坑

### 3.1 已有约束

- 任务状态与错误反馈已基于 `article_tasks` + `GET /api/articles/:id/tasks` 稳定运行，应延续该模型。  
关联：`docs/summaries/2026-03-04-async-tasks-refactor.md`
- 沉浸式翻译已切换到“原 HTML 增强渲染”，不能回退到会丢失非段落节点的渲染路径。  
关联：`docs/summaries/2026-03-05-translation-preserve-html-structure.md`
- 翻译任务 reason 语义兼容性（如 `missing_api_key`、`fulltext_pending`、`already_translated`）已有测试覆盖，应保持向后兼容。  
关联：`docs/summaries/2026-03-04-immersive-translation.md`

### 3.2 本次规避策略

- 只改“触发条件、配置字段、按钮语义”，不改翻译渲染内核。
- `reason` 枚举保留；通过新增 `force` 请求语义绕过 `already_*`。
- 自动触发继续走“仅在无结果时触发”，避免 AI 成本失控；手动触发使用 `force` 满足强制重跑。

## 4. 方案对比

### 方案 A（采用）：显式拆分触发时机开关 + 手动 `force`

- 每个触发时机独立开关，配置语义与用户认知一一对应。
- API 增加 `force` 参数，统一承接“手动重跑”。
- 自动触发默认非 `force`，保持成本可控。

### 方案 B：摘要/翻译触发策略枚举（`never/on_fetch/on_open/both`）

- 字段更少，但迁移与测试矩阵更复杂，且对用户可理解性较弱。

### 方案 C：最小改动复用旧字段

- 变更最小，但无法无歧义表达五个触发语义，长期维护风险高。

结论：采用方案 A。

## 5. 详细设计

### 5.1 数据模型（订阅源级）

以 `feeds` 为配置归属，新增字段：

- `ai_summary_on_fetch_enabled boolean not null default false`
- `body_translate_on_fetch_enabled boolean not null default false`
- `body_translate_on_open_enabled boolean not null default false`

保留字段：

- `ai_summary_on_open_enabled`
- `title_translate_enabled`

兼容迁移策略：

- 读取兼容：若历史数据仅有 `body_translate_enabled`，迁移时将其值复制到 `body_translate_on_open_enabled`。
- 写入收敛：前后端后续统一读写 `bodyTranslateOnOpenEnabled`；`bodyTranslateEnabled` 仅用于一次性迁移与短期兼容。

### 5.2 API 契约

#### 5.2.1 摘要入队

`POST /api/articles/:id/ai-summary`

请求体新增：
- `force?: boolean`（默认 `false`）

行为：
- `force=false`：保持现有语义（已有摘要时返回 `already_summarized`）。
- `force=true`：跳过“已有摘要”早退，允许重新入队。
- 无论是否 `force`，都保留 `missing_api_key`、`fulltext_pending`、`already_enqueued`。

#### 5.2.2 翻译入队

`POST /api/articles/:id/ai-translate`

请求体新增：
- `force?: boolean`（默认 `false`）

行为：
- `force=false`：保持现有“已有翻译返回 `already_translated`”。
- `force=true`：跳过“已有翻译”早退，允许重新创建/覆盖当前翻译会话并入队。
- 保留 `missing_api_key`、`fulltext_pending`、`already_enqueued`。

备注：
- `body_translate_disabled` 从“手动按钮权限控制”语义中退出，转为“自动触发策略配置”的语义边界。

### 5.3 自动触发数据流

#### 5.3.1 获取文章后（worker ingest）

新文章入库后：

1. 标题翻译：若 `titleTranslateEnabled=true`，按现有逻辑入队 `JOB_AI_TRANSLATE_TITLE`。
2. 自动摘要：若 `aiSummaryOnFetchEnabled=true` 且文章尚无摘要，则入队摘要（`force=false`）。
3. 自动正文翻译：若 `bodyTranslateOnFetchEnabled=true` 且文章尚无翻译产物/会话，则入队翻译（`force=false`）。

#### 5.3.2 打开文章后（ArticleView）

打开文章时：

1. 自动摘要：若 `aiSummaryOnOpenEnabled=true` 且无摘要，触发摘要请求（`force=false`）。
2. 自动正文翻译：若 `bodyTranslateOnOpenEnabled=true` 且无翻译结果，触发翻译请求（`force=false`）。
3. 自动正文翻译成功进入执行流程后，立即切换到翻译视图。

### 5.4 手动按钮交互

#### 5.4.1 `AI摘要` 按钮

- 始终可点击。
- 点击调用摘要入队接口并携带 `force=true`。
- 即使已有摘要，也会触发重跑。

#### 5.4.2 `翻译` 按钮

- 始终可点击。
- 按钮文案固定为 `翻译`，不再出现 `原文` 切换文案。
- 点击调用翻译入队接口并携带 `force=true`。
- 点击后保持/进入翻译视图；不提供“同按钮切回原文”行为。
- 再次点击继续触发翻译重跑。

### 5.5 配置 UI 文案优化（FeedDialog）

- `获取文章后自动获取摘要`
  - 说明：`新文章入库后自动排队生成摘要（仅在未生成时触发）`
- `打开文章自动获取摘要`
  - 说明：`阅读文章时自动补齐摘要（仅在未生成时触发）`
- `获取文章后自动翻译正文`
  - 说明：`新文章入库后自动翻译正文（仅在未翻译时触发）`
- `打开文章自动翻译正文`
  - 说明：`打开文章时自动触发正文翻译，并自动切换到翻译视图`
- `列表标题获取后自动翻译`
  - 说明：`新文章入库后自动翻译标题，列表优先显示译文`

### 5.6 列表标题展示策略

为保证“列表标题自动翻译”对用户可见：

- 列表展示标题优先使用 `titleZh`（存在时）。
- 保留原文可访问信息（例如 `title` 属性或辅助信息），避免可读性/可追溯性下降。

### 5.7 错误处理与反馈

- `fulltext_pending`：保留为硬约束。按钮可点击，但点击后给出“等待全文抓取完成”的反馈。
- `missing_api_key`：保持现有提示。
- `already_enqueued`：保持现有轮询与状态提示。
- `failed`：继续沿用 `article_tasks` 的持久化错误展示与重试路径。

## 6. 测试设计

### 6.1 后端

- Migration 测试：
  - 新列存在、默认值正确。
  - 旧 `body_translate_enabled` 到 `body_translate_on_open_enabled` 迁移正确。
- `feedsRepo` / `feeds` API 测试：
  - create/list/update 读写新增字段。
- `ai-summary` / `ai-translate` route 测试：
  - `force=true` 可绕过 `already_summarized` / `already_translated`。
  - `fulltext_pending` 仍返回等待语义。

### 6.2 worker

- ingest 后自动触发摘要/正文翻译：
  - 开关开启且无结果时入队。
  - 已有结果时不重复入队。

### 6.3 前端

- `FeedDialog`：
  - 新开关渲染、提交 payload 正确。
  - 描述文案符合新语义。
- `ArticleView`：
  - `翻译` 按钮不再切回原文，连续点击持续触发翻译请求。
  - `AI摘要` 按钮连续点击触发重跑请求。
  - `on_open` 自动翻译触发后自动进入翻译视图。
  - `fulltext_pending` 时点击按钮展示等待反馈而非静默失败。
- `ArticleList`：
  - 有 `titleZh` 时优先显示译文标题。

## 7. 风险与权衡

- 成本风险：新增 `on_fetch` 自动翻译/摘要会提升 AI 请求量。  
缓解：自动路径仅在“无结果”触发，默认全关闭。
- 行为变更风险：移除“翻译按钮切回原文”后，部分用户需适应。  
缓解：按钮语义文案明确为“翻译”，并在设计评审中确认该行为为显式需求。
- 兼容风险：旧字段过渡期可能出现前后端映射不一致。  
缓解：迁移 + DTO 双向兼容 + 回归测试覆盖。

## 8. 验收标准

1. 订阅源可独立配置 5 个触发项，且配置文案无歧义。
2. `AI摘要` / `翻译` 按钮始终可点击，点击均执行 `force` 重跑。
3. `翻译` 按钮不再切换到原文；再次点击继续触发翻译。
4. 自动翻译（打开文章触发）会自动进入翻译视图。
5. `fulltext_pending` 约束仍有效，任务状态反馈可见且可理解。
6. 相关单测通过，且不回归已知历史问题（任务状态持久化、翻译渲染结构保留）。

## 9. 关联文档

- `docs/summaries/2026-03-04-async-tasks-refactor.md`
- `docs/summaries/2026-03-04-immersive-translation.md`
- `docs/summaries/2026-03-05-translation-preserve-html-structure.md`

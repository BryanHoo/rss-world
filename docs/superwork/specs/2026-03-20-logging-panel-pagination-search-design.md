# 日志记录分页搜索优化设计

- 日期：2026-03-20
- 状态：已确认
- 关联设计：
  - `docs/superpowers/specs/2026-03-19-settings-logging-design.md`
- 需求：优化设置中心中的日志模块，新增记录阈值选择；日志列表默认只显示一行关键信息；按 `info / warning / error` 提供不同视觉层级；点击单条日志可查看详情；日志查看改为固定高度分页，不再使用滚动加载。

## 背景

`2026-03-19` 的日志设计已经完成第一版主链路：

- 日志配置位于 `PersistedSettings.logging`
- 服务端通过统一 logger 写入 `system_logs`
- 设置中心通过 `/api/logs` 拉取日志
- 日志页支持按等级筛选与 cursor 式“加载更多”

当前实现已能满足“可开启、可持久化、可查看”的基础目标，但交互上存在几个明显问题：

- 记录策略只有开关，没有“记录到什么程度”的阈值控制
- 查看侧依赖等级筛选，但用户更需要关键字定位
- 列表展示会直接渲染完整 `details` 与 `context`，扫描效率低
- 日志查看依赖“加载更多”，更像流式追加，不适合设置页中的定高浏览
- 列表与详情没有足够明确的语义色层级

因此，本次设计是对既有日志模块的增量优化，不重新设计日志系统边界，只重构“记录阈值 + 查询模型 + 设置页日志浏览体验”。

## 目标

- 在日志配置中新增“记录类型”阈值选择
- 按阈值决定哪些日志写入数据库，而不是仅在查看侧过滤
- 将日志查看从等级筛选改为关键词模糊搜索
- 搜索仅匹配摘要字段：`message / source / category`
- 日志列表默认只显示一行关键摘要
- `info / warning / error` 在列表中具备明确视觉区分
- 点击单条日志后，在当前条目下方行内展开 `details` 与 `context`
- 日志区域占满设置页剩余高度，底部使用分页器进行页切换
- 移除“加载更多”与 cursor 分页心智

## 非目标

- 不改动日志采集范围本身，仍沿用既有系统日志边界
- 不引入全文检索、导出日志、批量清空、单条删除
- 不新增按等级查看筛选
- 不新增独立日志页面、全局运维面板或通知中心
- 不新增浏览器自动化测试
- 不在第一版引入复杂页码跳转组件

## 已确认输入

- 记录类型采用“阈值”语义，而不是精确匹配
  - `info`：记录 `info + warning + error`
  - `warning`：记录 `warning + error`
  - `error`：只记录 `error`
- 日志详情展示方式：`A`
  - 点击单条日志后在当前条目下方行内展开
- 分页器形式：`B`
  - 仅保留“上一页 / 下一页”与当前页信息
- 查看侧取消等级筛选，改为关键词模糊搜索
- 搜索范围：`A`
  - 仅匹配 `message / source / category`
- 搜索触发方式：`A`
  - 输入即搜，自动回到第 1 页

## 备选方案

### 方案 A：保留 cursor 分页，只在前端伪装成页码

做法：

- `/api/logs` 继续返回 `before + nextCursor`
- 前端维护“当前第几页”的假象
- 上一页依赖前端缓存已加载内容

优点：

- 服务端改动最少

缺点：

- 与“固定页内容 + 上一页 / 下一页”的交互模型不匹配
- 搜索条件变化后页码语义不稳定
- 状态管理会比真正的页码分页更绕

### 方案 B：将 `/api/logs` 改为真正的页码分页（推荐）

做法：

- 查询参数改为 `keyword / page / pageSize`
- 服务端返回 `items / total / hasPreviousPage / hasNextPage`
- 前端以固定高度、固定页内容进行浏览

优点：

- 与当前交互目标完全一致
- 搜索、翻页、空态、总数展示都更自然
- 组件状态更简单，也更容易测试

缺点：

- 需要同步修改 API、service、repository 和既有测试

### 方案 C：保留 cursor 内核，在服务端再包一层页码映射

做法：

- 对外表现像页码
- 内部继续使用 cursor 做跨页定位

优点：

- 可以保留一部分现有实现

缺点：

- 同时维护两套分页心智
- 实现复杂度最高，但并未带来实际交互收益

## 推荐方案

采用方案 B：把日志查询正式改为页码分页，并同步将查看体验改为“关键词搜索 + 固定页列表 + 行内展开详情”。

理由：

- 设置页日志查看属于轻量运维场景，优先保证交互一致性，而不是保留 cursor 技术细节
- 当前需求已经从“向下翻日志流”变为“在固定视口内检索与翻页浏览”
- 查询方和消费方都集中在现有日志面板，接口断面可控，迁移成本可接受

## 已确认设计

### 1. 配置模型

在现有 `logging` 设置中新增：

- `logging.minLevel: SystemLogLevel`

完整配置变为：

- `logging.enabled: boolean`
- `logging.retentionDays: 1 | 3 | 7 | 14 | 30 | 90`
- `logging.minLevel: 'info' | 'warning' | 'error'`

默认值：

- `logging.enabled = false`
- `logging.retentionDays = 7`
- `logging.minLevel = 'info'`

默认值理由：

- 关闭日志仍是更稳妥的默认状态
- 一旦开启日志，`info` 阈值能保持“记录全部已支持等级”的现有直觉，不会让用户因为默认值而意外漏日志

用户界面文案建议不要直接只写等级名，而要明确阈值语义：

- `记录全部（info 及以上）`
- `仅警告和错误（warning 及以上）`
- `仅错误（error）`

这样可以避免用户把 `warning` 误解成“只记录 warning”。

### 2. 日志写入阈值

统一 logger 在落库前读取 `logging.minLevel`，按阈值短路：

- 当前阈值为 `info` 时，不拦截任何现有等级
- 当前阈值为 `warning` 时，跳过 `info`
- 当前阈值为 `error` 时，仅允许 `error`

判断必须放在服务端统一 logger 层，而不是散落在调用侧，原因是：

- 保证所有日志源都共享同一条规则
- 避免不同业务链路对等级判断各写各的
- 便于后续补测试和修改阈值语义

### 3. `/api/logs` 查询契约

移除现有 cursor 查询参数：

- `level`
- `before`
- `limit`

新增页码查询参数：

- `keyword?: string`
- `page?: number`
- `pageSize?: number`

请求示例：

```text
GET /api/logs?keyword=summary&page=1&pageSize=20
```

响应结构：

```ts
{
  items: SystemLogItem[];
  page: number;
  pageSize: number;
  total: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}
```

约束：

- `page` 最小为 `1`
- `pageSize` 默认 `20`
- `pageSize` 上限建议 `100`
- 空关键字或仅空白字符视为不过滤
- 排序固定为 `created_at desc, id desc`

这里不再返回 `nextCursor` 和 `hasMore`。

### 4. 搜索范围与匹配方式

关键词搜索只匹配这三个字段：

- `message`
- `source`
- `category`

明确不匹配：

- `details`
- `context`

匹配方式使用大小写不敏感模糊匹配，即 `ILIKE '%keyword%'`。

这样做的原因：

- 搜索结果更聚焦“单行摘要”
- 避免大段第三方错误正文让结果变得嘈杂
- 不需要为 `details / context` 设计更复杂的高亮、分词或安全策略

### 5. Repository 与 Service 设计

Repository 层查询改为两步：

1. `count(*)` 计算当前关键字下的总条数
2. `select ... order by ... offset ... limit ...` 拉取当前页内容

Service 层职责：

- 归一化 `keyword / page / pageSize`
- 计算 `offset`
- 返回 `hasPreviousPage / hasNextPage`
- 向上层隐藏 SQL 细节

既有 cursor 相关 helper：

- `encodeSystemLogCursor`
- `decodeSystemLogCursor`

从日志查询主链路中移除。

### 6. 设置页布局

日志分区继续保留在设置中心中，但布局从“流式内容块”调整为“定高结构”：

- 顶部：日志开关、保留天数、记录类型
- 中部：日志查看卡片
- 卡片头部：关键词搜索框与结果概览
- 卡片主体：固定页内容的日志列表
- 卡片底部：分页器

日志查看卡片需要占满设置页剩余高度：

- 外层使用 `flex` 与 `min-h-0`
- 日志卡片使用 `flex-1`
- 不再依赖“加载更多”把列表越撑越长

这意味着日志页签应从普通文档流切到高度感知布局，而不是沿用现有整块 `overflow-y-auto` 的滚动阅读方式。

具体约束：

- `logging` 页签激活时，设置内容区应允许该页签占满可用高度
- 日志页签内容本身使用 `h-full min-h-0 flex flex-col`
- 日志查看卡片内部使用 `flex-1 min-h-0`
- 不再依赖整个设置内容区继续向下滚动来容纳日志列表

### 7. 日志列表展示

每条日志默认只显示两层信息：

- 第一行：`message`
  - 单行展示
  - 超出宽度时省略
- 第二行：`level · category · source`
  - 小号辅助信息
- 右侧：时间

`details` 与 `context` 不在默认态展示，避免每条日志都占用过高的视觉高度。

列表项采用轻量语义色，不做整块高饱和警报样式：

- `info`
  - 使用轻主色底与主色左侧标识条
- `warning`
  - 使用现有 `warning` 语义色
- `error`
  - 使用现有 `error` 语义色

视觉重点顺序：

1. `message`
2. 级别色条与语义色
3. 时间与元信息

### 8. 行内展开详情

点击单条日志后，在当前日志项下方行内展开详情区域，包含：

- `details`
- `context`

交互规则：

- 同时只允许一条日志处于展开状态
- 点击已展开项时收起
- 点击另一条日志时切换展开目标
- 搜索关键字变化后自动收起展开项
- 翻页后自动收起展开项

详情渲染规则：

- `details` 继续以纯文本 `<pre>` 渲染
- `context` 继续以 `JSON.stringify(..., null, 2)` 的纯文本方式渲染
- 不把任何日志字段当作 HTML 注入

为避免个别超长错误正文把布局整体撑坏，详情代码块可以设置合理的最大高度并允许其内部滚动；这不改变“日志列表采用分页而不是滚动加载”的主交互原则。

### 9. 搜索与分页交互

搜索触发方式为输入即搜，但需要前端 debounce。

建议：

- debounce：`300ms`

搜索规则：

- 输入变化后自动请求
- 自动回到第 `1` 页
- 自动清空展开项

分页器形式为简洁版：

- 左侧：`上一页`
- 中间：`第 N 页，共 M 页`
- 右侧：`下一页`

按钮状态：

- 第 `1` 页时禁用 `上一页`
- 最后一页时禁用 `下一页`

空结果时：

- 仅显示空态文案
- 不显示分页器
- `expandedLogId` 保持为空

这里不建议为了当前需求引入完整的 `shadcn/ui` 数字页码组件：

- 用户已确认只需要相邻翻页
- 当前仓库内也没有既有分页组件可直接复用
- 使用现有 `Button` 组合出轻量 `LogsPagination` 更符合当前需求

如果后续项目内出现统一分页模式，再将 `LogsPagination` 抽象为共享组件即可。

### 10. 组件边界

建议拆分为以下边界：

- `LogsSettingsPanel`
  - 负责设置表单、查询状态编排、请求联动
- `LogSearchBar`
  - 负责关键词输入与结果概览
- `LogList`
  - 负责加载态、错误态、空态与列表容器
- `LogListItem`
  - 负责单条日志摘要、语义色与行内展开
- `LogsPagination`
  - 负责上一页 / 下一页交互

这样做的目的不是为拆而拆，而是为了让“摘要展示”、“展开详情”、“分页行为”分别可测试、可演进。

### 11. 状态与边界条件

前端建议最小状态集合：

- `keyword`
- `page`
- `pageSize`
- `total`
- `expandedLogId`
- `items`
- `loading`
- `loadError`

状态规则：

- 搜索变化：重置到第 `1` 页，清空展开项
- 翻页：保留当前搜索词，清空展开项
- 请求失败：显示错误态，不把旧页数据伪装成新结果
- 空列表：
  - 无关键字时：`暂无日志`
  - 有关键字时：`没有匹配的日志`

### 12. 测试策略

前端测试至少覆盖：

- 输入关键词后 debounce 请求，并回到第 `1` 页
- 点击 `上一页 / 下一页` 时携带当前关键词请求目标页
- 搜索或翻页后收起已展开日志
- 日志默认不渲染详情，仅显示单行摘要
- 点击日志后展示 `details` 与 `context`
- 三种等级应用不同语义样式
- 加载失败、空结果、分页边界按钮禁用状态

接口与服务测试至少覆盖：

- `/api/logs` 只接受 `keyword / page / pageSize`
- 非法 `page / pageSize` 返回校验错误
- 搜索仅匹配 `message / source / category`
- 返回 `page / pageSize / total / hasPreviousPage / hasNextPage`
- 排序稳定为 `created_at desc, id desc`

日志写入测试至少覆盖：

- `logging.minLevel = 'warning'` 时跳过 `info`
- `logging.minLevel = 'error'` 时仅保留 `error`
- `logging.minLevel = 'info'` 时允许全部既有等级

## 影响范围

预期会影响的主要文件或模块：

- `src/types/index.ts`
- `src/features/settings/settingsSchema.ts`
- `src/store/settingsStore.ts`
- `src/lib/apiClient.ts`
- `src/app/api/logs/route.ts`
- `src/server/services/systemLogsService.ts`
- `src/server/repositories/systemLogsRepo.ts`
- `src/features/settings/panels/LogsSettingsPanel.tsx`
- 对应测试文件

## 风险与取舍

- 从 cursor 分页改为页码分页会带来一次接口断面变化，但当前调用方集中，迁移成本可控
- 搜索只覆盖摘要字段意味着用户不能靠错误正文搜日志，这是有意识的收口，不是遗漏
- 行内展开会增加单页局部高度，但对固定页分页浏览来说，这个代价可接受

## 结论

本次优化不扩展日志系统的业务边界，只把现有日志能力从“可记录、可加载”提升到“可按阈值记录、可按关键字检索、可在固定视口内高效浏览”。

下一步实施计划应围绕以下主线展开：

1. 扩展日志设置模型与统一 logger 阈值判断
2. 将 `/api/logs` 从 cursor 查询改为页码查询
3. 重构 `LogsSettingsPanel` 为固定高度、搜索、分页、行内展开的浏览界面

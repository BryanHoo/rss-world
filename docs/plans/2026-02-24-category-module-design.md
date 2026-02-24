# 分类模块替换 RSS 设置设计

- 日期：2026-02-24
- 状态：已评审通过
- 范围：`/Users/bryanhu/Develop/feedfuse/src/features/settings`、`/Users/bryanhu/Develop/feedfuse/src/features/feeds`、`/Users/bryanhu/Develop/feedfuse/src/store`、`/Users/bryanhu/Develop/feedfuse/src/types`
- 实施边界：仅前端逻辑与 UI；后端接口不实现，继续使用 mock 数据流

## 1. 背景与目标

当前设置中心包含 `RSS 源` 增删改查模块。新目标是将其替换为独立的“分类管理”模块，并让分类在全局统一复用：

1. 设置中心不再提供 RSS 源增删改查能力。
2. 新增“分类管理”模块，支持分类增删改查。
3. `AddFeedDialog`、左侧 `FeedList` 与设置中心共享同一份分类主数据。
4. 分类字段从字符串模型升级为引用模型（`categoryId`）。

## 2. 已确认约束

1. 作用范围是全局统一：设置中心、`AddFeedDialog`、`FeedList` 全部复用分类主数据。
2. 删除分类时，已关联 RSS 源自动归入“未分类”。
3. 重命名分类时，全局展示应立即体现新名称。
4. 数据模型改为 `categoryId` 引用，不继续以分类名称字符串做关联。
5. 设置中心移除 RSS 源管理入口，改为分类管理入口。
6. 分类名称唯一性规则：去首尾空格后，大小写不敏感唯一。
7. 本期只做前端与 mock，不对接后端。

## 3. 方案比较

### 方案 A：`settingsStore` 持久化分类主数据，`appStore` 维护运行态（采纳）

- `settingsStore`：管理分类主数据与设置持久化。
- `appStore`：管理阅读态数据与分类展开态，不再作为分类事实来源。
- `Feed` 使用 `categoryId` 关联分类表。

优点：

1. 职责清晰，数据来源单一。
2. 与当前设置中心持久化机制一致，迁移路径平滑。
3. 未来接后端时易替换数据源。

缺点：

1. 需一次性迁移 `Feed.category -> Feed.categoryId`。
2. 需要同步调整多处测试。

### 方案 B：`appStore` 作为分类唯一来源，设置只做镜像

优点：实现集中在阅读态。

缺点：设置域与运行域耦合，长期维护风险高。

### 方案 C：新增独立 `categoryStore`

优点：抽象最纯粹。

缺点：当前项目阶段过重，增加额外复杂度。

结论：采纳方案 A。

## 4. 架构与数据模型设计

## 4.1 类型定义

在 `/Users/bryanhu/Develop/feedfuse/src/types/index.ts` 调整：

1. 新增 `Category`：
- `id: string`
- `name: string`

2. `Feed` 字段迁移：
- 从 `category?: string | null`
- 到 `categoryId?: string | null`

3. `PersistedSettings` 新增分类主数据容器（建议命名 `categories`）。

## 4.2 Store 职责

1. `/Users/bryanhu/Develop/feedfuse/src/store/settingsStore.ts`
- 持久化 `categories`。
- 提供分类 CRUD action：`addCategory`、`renameCategory`、`deleteCategory`、`listCategories`（命名可按现有风格微调）。

2. `/Users/bryanhu/Develop/feedfuse/src/store/appStore.ts`
- 保留阅读态与 feed 列表状态。
- 分类折叠态改为 `expandedByCategoryId`（对未分类使用固定 key，如 `__uncategorized__`）。

3. `/Users/bryanhu/Develop/feedfuse/src/data/mock/mockProvider.ts`
- feed 数据使用 `categoryId`。
- 删除分类后的归并逻辑由上层 action 触发，provider 保持前端 mock 行为。

## 4.3 一致性规则

1. 删除分类：所有引用该 `categoryId` 的 feed 自动置 `categoryId = null`。
2. 重命名分类：只更新 `Category.name`；feed 不改动。
3. 读取时若 `categoryId` 无法匹配分类表，视为未分类。
4. “未分类”是系统虚拟分组，不作为可编辑分类实体保存。

## 5. 组件与数据流

## 5.1 设置中心

在 `/Users/bryanhu/Develop/feedfuse/src/features/settings/SettingsCenterDrawer.tsx`：

1. 移除 `RSS 源` 分段与 `RssSourcesSettingsPanel`。
2. 新增 `分类` 分段与 `CategoriesSettingsPanel`。

`CategoriesSettingsPanel`（新文件）职责：

1. 分类列表展示。
2. 分类新增。
3. 分类重命名。
4. 分类删除（含确认）。

## 5.2 AddFeedDialog

在 `/Users/bryanhu/Develop/feedfuse/src/features/feeds/AddFeedDialog.tsx`：

1. 分类下拉改为读取分类主数据列表（`value=category.id`，`label=category.name`）。
2. 提交 payload 从 `category` 改为 `categoryId`。
3. 保留当前链接验证门禁逻辑（mock 验证服务不变）。

## 5.3 FeedList

在 `/Users/bryanhu/Develop/feedfuse/src/features/feeds/FeedList.tsx`：

1. 按 `feed.categoryId` 分组。
2. 通过分类表映射分组展示名称。
3. `null` 或失效 `categoryId` 聚合到“未分类”。
4. 折叠开关使用 `categoryId`（未分类固定 key）。

## 5.4 数据流（简化）

1. 设置中心 CRUD 分类 -> 写入 `settingsStore.categories`。
2. `AddFeedDialog` 读取 `settingsStore.categories` -> 选择 `categoryId` -> 写入 feed。
3. `FeedList` 读取 feed + 分类表 -> 运行时 join -> 渲染分组。
4. 删除分类 action 同步清理 feed 的 `categoryId` 引用。

## 6. 迁移与兼容策略

在 `/Users/bryanhu/Develop/feedfuse/src/features/settings/settingsSchema.ts` 的 normalize/migrate 路径处理：

1. 历史 `Feed.category`（字符串）迁移为：
- 先按名称构建/复用分类记录
- 再写入 feed 的 `categoryId`

2. 历史设置结构中的 `rss.sources`：
- 不再作为设置中心可编辑模块来源
- 迁移阶段仅做容错读取，不继续写回该管理语义

3. 持久化版本升级：
- 提升 `persist` 版本号
- 在 `migrate` 中集中执行一次数据迁移

4. 迁移失败兜底：
- 分类表缺失时退回空分类集
- feed 的非法 `categoryId` 置空

## 7. 校验与错误处理

1. 分类名校验：
- 必填
- `trim()` 后非空
- 大小写不敏感唯一

2. 删除分类：
- 弹出确认框说明“该分类下源将归入未分类”。
- 失败时保留原状态并提示。

3. 重命名分类：
- 若命中重名规则，阻断保存并给出字段级错误提示。

4. 设置草稿校验调整：
- 移除 `rss.sources.*` 相关校验路径
- 增加 `categories.*` 校验路径

## 8. 测试策略

1. `/Users/bryanhu/Develop/feedfuse/src/features/settings/settingsSchema.test.ts`
- 旧 `category` 字符串迁移到 `categoryId`。
- 分类表生成与去重行为正确。

2. `/Users/bryanhu/Develop/feedfuse/src/store/settingsStore.test.ts`
- 分类 CRUD。
- 删除分类后 feed 自动归未分类。
- 重命名后展示依赖分类表即时生效。

3. 新增 `CategoriesSettingsPanel` 组件测试
- 新增/重命名/删除链路。
- 重名校验阻断。

4. `/Users/bryanhu/Develop/feedfuse/src/features/feeds/AddFeedDialog.test.tsx`
- 下拉值切换为 `categoryId` 后提交正常。
- 链接验证门禁不回归。

5. `/Users/bryanhu/Develop/feedfuse/src/features/feeds/FeedList` 相关测试
- 按 `categoryId` 分组渲染正确。
- 未分类分组与失效 `categoryId` 回退正确。

6. `/Users/bryanhu/Develop/feedfuse/src/features/settings/SettingsCenterModal.test.tsx`
- 清理 RSS 面板测试用例。
- 新增分类面板入口与交互断言。

## 9. 非目标

1. 本期不实现后端分类 API。
2. 本期不实现设置中心 RSS 源编辑入口替代页。
3. 本期不处理服务端数据同步或多端冲突合并。

## 10. 验收标准

1. 设置中心中不存在 RSS 源增删改查 UI。
2. 设置中心新增“分类管理”模块，并支持分类增删改查。
3. `AddFeedDialog` 与 `FeedList` 复用同一分类主数据。
4. 删除分类后，关联 feed 自动归未分类。
5. 重命名分类后，全局展示即时更新。
6. 全流程仅依赖前端与 mock，可离线运行。

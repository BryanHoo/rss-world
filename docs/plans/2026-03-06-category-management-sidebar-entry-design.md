# 分类管理侧边栏入口迁移设计

- 日期：2026-03-06
- 状态：已确认（Approved）
- 范围：
  - `src/features/feeds/FeedList.tsx`
  - `src/features/settings/SettingsCenterDrawer.tsx`
  - `src/features/settings/SettingsCenterModal.test.tsx`
  - `src/features/settings/panels/CategoriesSettingsPanel.tsx`（迁移/重命名）
  - `src/features/settings/panels/CategoriesSettingsPanel.test.tsx`（迁移/重命名）
  - `src/features/feeds/FeedDialog.tsx`
  - 新增 `src/features/categories/` 下分类管理容器组件

## 1. 背景与目标

当前分类管理能力已经完整支持新增、重命名、删除与拖拽排序，但入口放在设置中心中，带来两个问题：

1. 信息架构不自然。分类本质上是阅读内容的组织数据，不是用户偏好设置。
2. 配置路径不顺手。分类的主要消费场景在左侧 `FeedList` 与 `Add/Edit Feed`，但用户需要先进入设置才能管理。

本次改造目标：

1. 将分类管理主入口从设置中心迁移到左侧 `FeedList`。
2. 使用独立弹窗承接现有分类管理能力，而不是在左栏直接内联编辑。
3. 完整保留现有功能：新增、重命名、删除、拖拽排序、顺序持久化。
4. 不改变现有分类消费链路：`FeedList` 分组顺序、`Add/Edit Feed` 分类选项顺序、删除分类后的归并逻辑继续有效。

## 2. 已确认约束

1. 左侧 `FeedList` 是分类管理的唯一主入口。
2. 交互采用“左侧入口 + 独立弹窗”，不在左栏内联完成分类 CRUD。
3. 设置中心完全移除 `分类` tab，不保留次级入口或提示跳转。
4. 本次不重构分类 API，也不改变 `未分类` 的系统语义。
5. 本次不顺手重构 `PersistedSettings.categories` 存储模型，避免把入口迁移与 settings 数据清理绑在同一次改动中。

## 3. 相关经验与已知约束来源

- 参考总结：[`docs/summaries/2026-03-05-rss-feed-dialog-policy-split.md`](../summaries/2026-03-05-rss-feed-dialog-policy-split.md)
  - 启发 1：设置中心应坚持职责收敛，避免继续堆叠业务配置。
  - 启发 2：高频业务操作更适合放回其主流程附近，而不是隐藏在通用设置中。
- 参考总结：[`docs/summaries/2026-03-05-categories-settings-table-reorder.md`](../summaries/2026-03-05-categories-settings-table-reorder.md)
  - 启发 1：现有分类表格交互已稳定覆盖 CRUD + reorder，不应在入口迁移时重做一套。
  - 启发 2：分类顺序的一致性已联动 `FeedList` 与 `AddFeedDialog`，迁移时必须保持这个事实来源不变。

## 4. 方案比较与选型

### 方案 A（采纳）：左栏显式入口 + 独立分类管理弹窗

- 形态：在 `FeedList` 分类区域提供明确的 `管理分类` 入口，点击后打开 `CategoryManagerDialog`。
- 优点：
  - 入口位置贴近主使用场景。
  - 现有分类表格能力可以基本原样复用。
  - 左栏保持浏览结构，不引入内联编辑复杂度。
- 缺点：
  - 仍然需要一次额外点击进入弹窗。

### 方案 B：左栏菜单入口 + 独立弹窗

- 优点：界面更轻，不额外占用明显位置。
- 缺点：可发现性偏弱，不利于表达“分类是主要组织结构”。

### 方案 C：左栏直接内联编辑分类

- 优点：理论上操作路径最短。
- 缺点：会让左栏同时承担浏览与管理职责，交互复杂度明显上升，也更容易破坏当前阅读器布局节奏。

结论：采用方案 A。

## 5. 架构与组件设计

## 5.1 信息架构调整

1. `SettingsCenterDrawer` 移除 `categories` section 与对应面板渲染。
2. `FeedList` 成为分类管理的唯一入口承载者。
3. 分类管理通过独立弹窗显示，不再作为设置的一部分。

## 5.2 组件拆分

建议新增独立分类功能目录：`src/features/categories/`

包含两个角色：

1. `CategoryManagerDialog`
   - 负责弹窗外壳、标题、尺寸、开关状态。
   - 在窄屏下采用更高、更接近全屏的弹层尺寸，保证表格可用性。
2. `CategoryManagerPanel`（可由现有 `CategoriesSettingsPanel` 迁移/重命名而来）
   - 承接现有表格能力：新增、重命名、删除、拖拽排序。
   - 保持当前行内编辑和即时提交模型。

`FeedList` 只负责触发打开弹窗，不承担分类 CRUD 细节。

## 5.3 数据边界

1. 分类管理继续直接使用现有分类 API：
   - `createCategory`
   - `patchCategory`
   - `deleteCategory`
   - `reorderCategories`
2. 分类管理继续直接读写 `useAppStore().categories`，保持与 `FeedList` / `FeedDialog` 的单一事实来源一致。
3. 不接入 `useSettingsStore`，不接入设置自动保存链路。
4. `FeedDialog` 继续只消费分类列表，不承担分类管理职责。

## 5.4 关于 settings schema 的边界

当前 `settingsSchema` 中仍存在 `PersistedSettings.categories` 字段，但从现有运行链路看，它并不是分类管理的实时事实来源。本次设计不在同一改动中移除该字段，原因如下：

1. 本次核心问题是入口位置不合理，不是 settings 数据模型不合理。
2. 先完成入口迁移，可以把风险收敛在 UI 结构与组件迁移。
3. 若后续确认不存在运行时依赖，再单独做 settings schema 清理会更安全。

## 6. 交互设计

1. 左栏分类区域提供一个明确可见的 `管理分类` 入口。
2. 点击入口后打开 `CategoryManagerDialog`。
3. 弹窗内部沿用现有表格交互：
   - 顶部输入框 + `添加分类`
   - 列：`排序 / 分类名称 / 订阅源数量 / 操作`
   - `blur / Enter` 保存重命名
   - `Esc` 放弃草稿
   - 删除保留二次确认
   - 拖拽完成后立即保存排序
4. `未分类` 不出现在可管理列表中，继续保持系统保底语义。
5. 当不存在普通分类时，弹窗显示空态引导，而不是空白表格。

## 7. 错误处理与忙碌态

1. 新增失败：沿用当前冲突/校验错误提示。
2. 重命名失败：保留行内错误提示 + toast。
3. 删除失败：提示错误，不提前移除本地数据。
4. 排序失败：回滚到拖拽前顺序，并提示保存失败。
5. 忙碌态边界：
   - 排序提交中禁用重复拖拽。
   - 删除或提交进行中禁用重复破坏性操作。
6. 分类管理不引入额外“保存”按钮，继续采用即时提交模型。

## 8. 测试策略

1. `FeedList` 相关测试
   - 左栏显示 `管理分类` 入口。
   - 点击后打开分类管理弹窗。
2. 分类管理组件测试
   - 新增、重命名、删除回归。
   - 拖拽排序成功。
   - 拖拽排序失败时回滚。
3. 设置中心测试
   - `分类` tab 不再出现。
4. 消费链路回归
   - `FeedList` 分组顺序仍遵循分类顺序。
   - `Add/Edit Feed` 分类下拉仍遵循分类顺序。
   - 删除分类后 feed 仍归并到 `未分类`。

## 9. 验收标准

1. 分类管理主入口位于左侧 `FeedList`，不再位于设置中心。
2. 设置中心不再出现 `分类` tab。
3. 分类 CRUD 与拖拽排序能力完整保留。
4. 分类顺序继续影响左栏分组与 `Add/Edit Feed` 分类选项顺序。
5. 删除分类后的 feed 归并语义保持不变。
6. 相关单元测试通过，`lint` 通过。

## 10. 非目标

1. 本期不新增分类搜索、批量删除、分页。
2. 本期不在左栏直接内联编辑分类。
3. 本期不改造分类后端协议与数据库结构。
4. 本期不顺手清理 `PersistedSettings.categories` 历史字段。

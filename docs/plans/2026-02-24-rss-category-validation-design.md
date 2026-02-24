# RSS 源弹窗重构与分类迁移设计

- 日期：2026-02-24
- 状态：Approved
- 范围：`/Users/bryanhu/Develop/feedfuse/src/features/feeds/AddFeedDialog.tsx`、`/Users/bryanhu/Develop/feedfuse/src/features/settings/panels/RssSourcesSettingsPanel.tsx`、`/Users/bryanhu/Develop/feedfuse/src/features/feeds/FeedList.tsx`、`/Users/bryanhu/Develop/feedfuse/src/types/index.ts` 及相关校验/测试文件

## 1. 背景与目标

当前“添加 RSS 源”弹窗与设置中心 RSS 管理存在两类问题：

1. 缺少“先验证链接再保存”的强约束。
2. 分组字段使用 `folder/folderId`，不符合新需求“改为分类并支持下拉选择+手动新增”。

本次目标：

1. 重构“添加 RSS 源”弹窗 UI 与前端逻辑。
2. 在保存前强制通过链接验证，未通过禁止保存。
3. 全量从 `folder` 迁移到 `category`。
4. 分类交互统一为“下拉可选 + 输入新增”，并允许空值（未分类）。

## 2. 已确认约束

1. 链接验证采用“可调通 + 可解析 RSS/Atom”标准（逻辑语义保持一致）。
2. 当前阶段仅做前端逻辑和 UI，后端能力全部使用 mock。
3. 401/403/timeout/解析失败等失败场景统一视为不可保存。
4. 分类是全局字段，左侧订阅分组也改为按分类展示。
5. 设置中心 RSS 面板同步改造，不保留旧 `folder` 交互。
6. 验证触发方式为“点击验证按钮”；URL 变化后需重新验证。

## 3. 方案比较与结论

### 方案 A：前端 mock 验证服务 + 统一验证协议（采纳）

- 抽象 `validateRssUrl(url)` 前端服务，`AddFeedDialog` 与 `RssSourcesSettingsPanel` 共用。
- 当前由 mock 实现返回成功/失败；后续可替换为真实后端实现。

优点：

- 满足“先验证再保存”的完整交互闭环。
- 复用性高，迁移真实接口成本低。
- 测试可控，便于覆盖多失败场景。

缺点：

- 需要增加验证状态管理与门禁逻辑。

### 方案 B：仅 URL 语法校验

优点：实现最快。

缺点：无法表达“调通+可解析”，不满足需求。

### 方案 C：仅 mock 2xx 可达校验

优点：复杂度低于方案 A。

缺点：会放过非 RSS 页面，不满足可解析要求。

结论：采纳方案 A。

## 4. 架构与组件设计

## 4.1 验证服务（前端 mock）

新增前端服务模块（示例路径）：

- `/Users/bryanhu/Develop/feedfuse/src/features/feeds/services/rssValidationService.ts`

职责：

1. 输入：`url`。
2. 输出统一结果：`ok / errorCode / message / feedMeta`（可选）。
3. 提供可测的 deterministic 规则（如 `success` 成功、`401/403/timeout/invalid` 失败）。

## 4.2 AddFeedDialog 重构

字段：

1. `name`
2. `url`
3. `category`

状态：

1. 表单状态
2. 验证状态：`idle | validating | verified | failed`
3. 验证快照：`lastVerifiedUrl`

按钮：

1. `验证链接`
2. `保存`
3. `取消`

门禁规则：

1. 未验证通过时禁止保存。
2. URL 改动后立即失效 `verified`，必须重验。

## 4.3 Settings RSS 面板改造

- 每个 source 行维护独立验证状态。
- 每行新增 `验证链接` 按钮。
- 自动保存触发时，若存在未验证/失败行，写入 `validationErrors` 并阻断保存。

## 4.4 左侧分组展示改造

- `folderId` 迁移为 `category`。
- 左侧列表按 `feeds.category` 动态聚合。
- 保留“未分类”分组（空值映射）。

## 5. 数据模型与迁移

## 5.1 类型变更

1. `Feed.folderId?: string` -> `Feed.category?: string | null`
2. `RssSourceSetting.folder: string | null` -> `RssSourceSetting.category: string | null`

## 5.2 兼容策略

- 读取历史持久化数据时：
  - 若存在旧字段 `folder`，映射到 `category`。
  - 迁移后统一读写 `category`。

## 6. 交互流程

## 6.1 AddFeedDialog

1. 输入 URL。
2. 点击“验证链接”。
3. 验证成功后“保存”可用。
4. 点击保存后创建 feed 并关闭弹窗。

失败路径：

- 验证失败显示错误，不允许保存。

## 6.2 Settings RSS 面板

1. 新增或编辑 URL。
2. 点击当前行“验证链接”。
3. 自动保存前检查验证状态。
4. 未通过则标注字段错误并维持当前面板。

## 7. 错误处理

错误码统一映射到中文提示：

1. `invalid_url`：链接格式不合法
2. `unauthorized`：目标源需要鉴权（401/403）
3. `timeout`：请求超时
4. `not_feed`：内容不是有效 RSS/Atom
5. `network_error`：网络异常

处理策略：全部禁止保存。

## 8. 测试策略

## 8.1 单测

1. `AddFeedDialog.test.tsx`
- 未验证不可保存
- 验证通过可保存
- URL 修改后需重新验证

2. `SettingsCenterModal.test.tsx`
- RSS 行未验证时自动保存失败并有错误提示
- 验证通过后自动保存成功
- 分类可选、可新增、可清空

3. `settingsSchema.test.ts`
- 旧 `folder` -> 新 `category` 迁移正确

4. `validateSettingsDraft.test.ts`
- 保留 URL 语法校验
- 增加“必须验证通过”约束校验

## 8.2 回归

1. 左侧按分类分组展示正常。
2. 未分类展示正常。
3. 现有设置中心 autosave 行为与关闭保护行为不回归。

## 9. 非目标

1. 本次不接真实后端 RSS 校验接口。
2. 本次不实现 RSS 鉴权配置、headers、自定义解析规则。
3. 本次不扩展为整站设计系统重构。

## 10. 验收标准

1. 添加 RSS 弹窗必须“验证通过后可保存”。
2. 设置中心 RSS 行为与上述规则一致。
3. `folder` 字段完成迁移，UI 与数据层统一为 `category`。
4. 分类控件均为下拉可选 + 手动新增。
5. 单测覆盖关键成功/失败链路。

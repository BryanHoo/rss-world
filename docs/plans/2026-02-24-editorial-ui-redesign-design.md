# Editorial 风格全量 UI 重设计（现网路径）

- 日期：2026-02-24
- 状态：Approved
- 风格基线：`editorial`（StyleKit）
- 范围：`src/features/*`、`src/components/common/*`、`src/app/*`

## 1. 背景与目标

当前现网 UI 以灰阶卡片 + 圆角 + 阴影 + 蓝色强调为主，不符合 `editorial` 风格要求。  
本次目标是在不改变业务能力和信息架构的前提下，完成前端现网 UI 的统一视觉重设计。

明确目标如下：

1. 全面迁移到 editorial 视觉语言（排版、色彩、边框、交互反馈）。
2. 保持现有结构：三栏阅读布局 + 右侧设置抽屉。
3. 保持现有功能与数据流，不新增业务功能、不改业务规则。
4. 测试锚点与可访问性语义保持稳定（`aria-label`/`data-testid`）。

## 2. 已确认约束

1. 仅处理现网路径：`src/features/*`、`src/components/common/*`、`src/app/*`。
2. 主题策略：只保留浅色 editorial 渲染；移除 `dark/auto` 作为目标体验。
3. 信息架构不改：保留三栏阅读结构、设置抽屉结构与入口位置。
4. 不进入实现阶段前已完成设计审批；本文件作为实现唯一设计基线。

## 3. 方案比较与决策

### 方案 A：Token-First 全局重皮肤（采纳）

做法：

1. 先在 `src/app/globals.css` 统一建立 editorial tokens 与基础样式约束。
2. 再按语义化样式组合批量替换现网组件类名。

优点：

1. 风格一致性最高，避免组件各自为政。
2. 后续维护成本最低，新增组件可直接复用 token/语义类。

缺点：

1. 首轮改动面较大，需要严格回归验证。

### 方案 B：分批按页面重做

优点：风险隔离更容易。  
缺点：中间阶段风格不统一，影响整体体验。

### 方案 C：最小侵入替换

优点：速度快。  
缺点：难以满足“全量 editorial 重设计”目标。

结论：采纳方案 A。

## 4. 视觉系统设计（Architecture）

采用“两层样式架构”：

### 4.1 全局 Token 层（`src/app/globals.css`）

统一定义以下设计基础：

1. 色彩：暖米背景 + 柔和黑文字 + 透明度灰阶层次。
2. 字体：标题衬线、正文字体无衬线。
3. 边框：细边框、无粗边框。
4. 形态：`rounded-none`、`shadow-none`。
5. 焦点与交互：下划线/字重/细线变化，不使用高饱和强调块。
6. 间距：统一 section/container/控件节奏。

同时建立全局约束，禁止在现网 UI 使用与 editorial 冲突的模式：

1. 非 `rounded-none` 圆角类。
2. 阴影类。
3. 渐变背景。
4. 蓝色主强调语义（`bg-blue*`、`text-blue*` 等）。

### 4.2 组件语义层（`src/features/*`、`src/components/common/*`）

用语义化样式组合承载视觉规则，避免散落式样式拼贴，例如：

1. `editorial-panel`
2. `editorial-kicker`
3. `editorial-link-button`
4. `editorial-input-underline`
5. `editorial-status-muted`

语义层只承载表现，不承载业务逻辑。

## 5. 组件映射设计（Components）

### 5.1 ReaderLayout（三栏骨架）

1. 保持三栏结构与现有交互路径。
2. 外层与栏位改为单色层次 + 细分割线。
3. `open-settings` 入口改为 editorial 文本化按钮表达，保留语义标识。

### 5.2 FeedList（左栏）

1. 智能视图、分类标题、订阅项改为杂志目录式排版。
2. 当前态强调采用字重/细线，不用蓝色实底高亮。
3. 图标与 favicon 保留，无圆角卡片表达。

### 5.3 ArticleList（中栏）

1. 条目以“标题主导 + 元信息弱化”的版式呈现。
2. 选中态改为浅层次背景与细线标识。
3. 未读提示保留，改用单色中性视觉。

### 5.4 ArticleView（右栏）

1. 标题升级为衬线大标题。
2. 正文保持 `prose` 能力，但统一到 editorial 单色体系。
3. 收藏/原文/翻译/AI 摘要操作改为文本按钮 + 下划线动效。

### 5.5 AppDrawer / AppDialog / SettingsCenterDrawer

1. 抽屉与弹窗统一直角、无阴影、无渐变、无玻璃拟态。
2. 设置导航改为目录式 tab（字重 + 下划线强调）。
3. 错误计数与状态提示改为单色体系中的层次表达。

### 5.6 AddFeedDialog 与 Settings Panels

1. 输入控件统一为底线输入样式。
2. 标签使用小字 uppercase tracking 样式。
3. 所有按钮统一 editorial 文本型交互语义。

## 6. 数据流与状态策略（Data Flow）

本次只改表现层，以下逻辑保持不变：

1. `useAppStore` 阅读态与三栏联动逻辑。
2. `useSettingsStore` 的 `loadDraft/updateDraft/saveDraft/discardDraft`。
3. `useSettingsAutosave` 自动保存状态机。
4. `AddFeedDialog` RSS 链接验证流程。
5. 分类管理（新增/重命名/删除/归并未分类）行为规则。

主题处理策略：

1. UI 仅保留浅色 editorial 目标渲染。
2. 主题配置项与历史数据兼容策略在实现阶段处理，但不得影响现有数据读取稳定性。

## 7. 错误处理与交互约束（Error Handling）

1. 保留字段级校验反馈与错误文案语义。
2. 保留关闭拦截与确认流程。
3. 保留关键可访问性属性与测试锚点：
   - `open-settings`
   - `add-feed`
   - `close-settings`
   - `settings-center-modal`
   - `settings-center-overlay`
   - `settings-section-tab-*`

## 8. 测试与验收（Testing）

### 8.1 必跑回归

1. `src/features/reader/ReaderLayout.test.tsx`
2. `src/features/settings/SettingsCenterModal.test.tsx`
3. `src/features/feeds/AddFeedDialog.test.tsx`
4. `src/components/common/AppDrawer.test.tsx`

### 8.2 样式契约校验（新增或扩展）

保证现网路径不出现 editorial 禁用模式：

1. 非 `rounded-none` 圆角类。
2. `shadow*` 类。
3. 渐变类（`bg-gradient*`、`from-*`/`via-*`/`to-*`）。
4. 蓝色强调类（`bg-blue*`、`text-blue*`、`border-blue*`、`ring-blue*`）。

### 8.3 手工验收重点

1. 桌面与移动尺寸下的三栏可读性与可操作性。
2. 设置抽屉打开/关闭/确认关闭完整链路。
3. 表单输入、验证、错误提示在新样式下可读。
4. 阅读区标题、正文、操作条的排版层级正确。

## 9. 非目标

1. 不新增业务功能。
2. 不调整信息架构（不改三栏/抽屉结构）。
3. 不引入后端接口或数据模型变更。
4. 不处理现网范围之外的旧目录 UI（本次不含 `src/components/{Layout,FeedList,ArticleList,ArticleView,Settings}`）。

## 10. 参考资料

1. `docs/plans/2026-02-23-settings-drawer-redesign-design.md`
2. `docs/plans/2026-02-24-category-module-design.md`
3. `docs/plans/2026-02-23-settings-center-design.md`
4. `/.agents/skills/editorial/SKILL.md`

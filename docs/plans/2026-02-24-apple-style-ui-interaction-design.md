# Apple 风格全量 UI 与交互优化设计（现网路径）

- 日期：2026-02-24
- 状态：Approved
- 风格基线：`apple-style`
- 范围：`src/features/*`、`src/components/common/*`、`src/app/*`

## 1. 背景与目标

当前现网 UI 在视觉语言上存在多种风格混用，不符合 Apple 风格要求。  
本次目标是在不改变业务逻辑与信息架构的前提下，统一现网 UI 与微交互风格。

明确目标如下：

1. 全量迁移到 Apple 风格视觉语言（颜色、排版、圆角、阴影、状态反馈）。
2. 保持现有结构：三栏阅读布局 + 右侧设置抽屉。
3. 保持现有功能与数据流，不新增业务能力、不调整业务规则。
4. 保持现有测试锚点与可访问性语义稳定。

## 2. 已确认约束

1. 只处理现网路径：`src/features/*`、`src/components/common/*`、`src/app/*`。
2. 主题策略固定为浅色 Apple 风格（light-only）。
3. 改造深度仅限视觉与微交互，不调整业务流程与信息架构。
4. 不进入实现技能阶段，先完成设计文档并获得确认。

## 3. 方案比较与决策

### 方案 A：Token-First 全局重皮肤（采纳）

做法：

1. 先在 `src/app/globals.css` 建立 Apple 风格 token 与基础样式规则。
2. 再按语义化样式组合重构现网组件样式。

优点：

1. 全局一致性最高。
2. 可维护性最好，后续扩展成本低。

缺点：

1. 首轮改动面较大，需要严格回归。

### 方案 B：按页面分批重做

优点：风险分段。  
缺点：中间阶段风格不统一。

### 方案 C：壳层优先最小改造

优点：见效快。  
缺点：容易遗留风格债务。

结论：采纳方案 A。

## 4. 视觉系统设计（Architecture）

采用两层架构：

### 4.1 Global Token Layer（`src/app/globals.css`）

统一定义：

1. 色彩：`bg-white`、`bg-[#f5f5f7]`、`text-[#1d1d1f]`、`text-[#86868b]`、`#0071e3`。
2. 字体：`-apple-system` 风格优先，标题紧凑 tracking。
3. 形态：`rounded-xl`、`rounded-2xl`、细边框、微阴影。
4. 动效：`duration-200/300`，hover/focus 保持克制反馈。
5. 主题：移除 `dark:*` 渲染依赖，统一浅色输出。

同时建立禁用规则（来自 `apple-style`）：

1. 禁用 `bg-gradient*`。
2. 禁用 `shadow-2xl`、`shadow-inner`。
3. 禁用 `border-2`、`border-4`、`border-8`。

### 4.2 Semantic Component Layer（`src/features/*`、`src/components/common/*`）

建立语义样式组合并统一复用：

1. 按钮（primary/secondary/link/outline）。
2. 卡片（default/elevated/flat）。
3. 输入（default/outlined）。
4. 导航与状态文本（active/hover/error/muted）。

语义层只承载表现，不承载业务逻辑。

## 5. 组件映射设计（Components）

### 5.1 ReaderLayout（三栏骨架）

1. 保持三栏与设置入口结构不变。
2. 背景与分栏统一为 Apple 浅色层次 + 细分割线。
3. `open-settings` 入口改为 Apple 轻按钮表达，语义标识保持不变。

### 5.2 FeedList（左栏）

1. 智能视图、分类、订阅项统一为 Apple 列表语言。
2. 选中态用浅蓝强调 + 字重层级，不使用重色块。
3. 保留 `add-feed` 交互与现有数据逻辑。

### 5.3 ArticleList（中栏）

1. 保持“标题主导、摘要次级”的信息层级。
2. hover/selected 使用轻背景与微阴影，不引入重装饰。
3. 未读提示保留，改为更克制视觉表达。

### 5.4 ArticleView（右栏）

1. 标题、元信息、正文采用统一 Apple 排版层级。
2. 收藏/原文/翻译/AI 摘要按钮统一 Button recipe。
3. 保留现有 `markAsRead` 与 `toggleStar` 行为逻辑。

### 5.5 SettingsCenterDrawer

1. 保持左侧导航 + 右侧面板工作区。
2. 分组激活态改为 Apple 风格（浅底、细边、文本强调）。
3. 自动保存状态语义不变，仅优化视觉层级。

### 5.6 AppDrawer / AppDialog（共享壳层）

1. 统一 Apple 壳层（圆角、细边、微阴影、克制背景）。
2. 保持 Esc、遮罩点击、关闭按钮链路。
3. 保持现有 `aria-label` 与 `data-testid`。

### 5.7 AddFeedDialog 与设置子面板

1. 输入控件统一 Input recipe。
2. 主次按钮统一 Button recipe。
3. 错误提示保留原逻辑，统一视觉语义。

## 6. 数据流与状态策略（Data Flow）

本次仅改表现层，以下逻辑保持不变：

1. `useAppStore` 阅读态与三栏联动逻辑。
2. `useSettingsStore` 的 `loadDraft/updateDraft/saveDraft/discardDraft`。
3. `useSettingsAutosave` 自动保存状态机。
4. `AddFeedDialog` 的 RSS 链接验证门禁逻辑。

主题策略：

1. 运行时固定浅色 Apple 渲染。
2. 不改变现有业务状态流，仅做主题渲染收敛。

## 7. 错误处理与可访问性（Error Handling）

1. 保留字段级校验触发与错误语义。
2. 保留关闭拦截与确认关闭流程。
3. 保留关键锚点与语义：
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

约束现网路径不出现以下禁用模式：

1. `bg-gradient*`
2. `shadow-2xl`、`shadow-inner`
3. `border-2`、`border-4`、`border-8`
4. 深色主题类依赖（`dark:*`）

### 8.3 集成验收

1. 桌面与移动尺寸下三栏可读性和可操作性正常。
2. 设置抽屉开启/关闭/确认关闭流程完整。
3. 表单输入、验证、错误提示在新样式下可读。
4. 阅读区标题/正文/操作条层级清晰。

## 9. 非目标

1. 不新增业务功能。
2. 不调整信息架构（不改三栏与抽屉结构）。
3. 不改动现网范围之外旧目录 UI。
4. 不引入后端接口、数据模型与状态机语义变更。

## 10. 参考资料

1. `docs/plans/2026-02-24-editorial-ui-redesign-design.md`
2. `docs/plans/2026-02-24-editorial-ui-redesign-implementation-plan.md`
3. `docs/plans/2026-02-23-settings-drawer-redesign-design.md`
4. `docs/plans/2026-02-24-category-module-design.md`
5. `/.agents/skills/apple-style/SKILL.md`

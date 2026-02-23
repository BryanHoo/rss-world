# Settings Dialog Shadcn Redesign Design

- 日期：2026-02-23
- 状态：Approved
- 适用范围：`src/features/settings/SettingsCenterModal.tsx`、`src/features/feeds/FeedList.tsx` 中的“添加 RSS 源”弹窗

## 1. 背景与目标

当前项目的弹窗由手写 Tailwind class 实现，功能可用但存在以下问题：

1. 弹窗交互逻辑分散，复用成本高（遮罩、关闭、焦点管理、标题/底部操作区结构未统一）。
2. 后续新增弹窗会重复实现基础行为，导致维护成本累积。
3. 可访问性与键盘交互虽部分可用，但缺少统一约束。

本次目标：

1. 引入 `shadcn`（基于 Radix primitives）作为弹窗与基础控件底座。
2. 建立统一弹窗基座，迁移现有两个弹窗。
3. 允许弹窗内容完全重构，但保证与现有 RSS 三栏页面整体风格和谐。
4. 不改动 RSS 三栏页面整体布局与主视觉结构。

## 2. 约束与非目标

### 2.1 必须满足的约束

1. `src/features/reader/ReaderLayout.tsx` 的三栏结构与整体设计语言不改。
2. 弹窗按钮、图标可优化，但需与当前页面视觉基调一致。
3. `settingsStore` 业务逻辑不重写：保留 `loadDraft / updateDraft / saveDraft / discardDraft` 行为。
4. 保留测试关键语义：`data-testid="settings-center-modal"` 与既有 `aria-label`。

### 2.2 非目标

1. 不进行整站设计系统全面重构。
2. 不重构 reader 主页面配色和布局。
3. 不引入与本次弹窗无关的大量第三方 UI 套件。

## 3. 方案评估与选择

### 3.1 备选方案

1. `shadcn` 标准基座 + 弹窗迁移（选中）。
2. 仅用 Radix primitives，自建全套封装。
3. 仅替换 Dialog 外壳，内部继续手写旧结构。

### 3.2 选择理由

选择方案 1。原因：

1. 与当前技术栈兼容性高（React + Tailwind）。
2. 能快速获得稳定的可访问性与交互基线（焦点陷阱、Esc、overlay、portal）。
3. 仍保留外观可控性，可做到“引入底座但风格贴合现有三栏页面”。
4. 后续新增弹窗可直接复用，减少重复开发。

## 4. 架构设计

## 4.1 分层

1. 基础层：`src/components/ui/*`
- 由 `shadcn` 生成并按项目风格调整 class。
- 本次最小集合：`dialog`、`button`、`input`、`label`、`select`、`switch`、`tabs`（按实际使用增减）。

2. 组合层：`src/components/common/AppDialog.tsx`
- 提供统一壳层：overlay、container、header、content、footer、close 行为。
- 抽象公共样式槽位：`size`、`contentClassName`、`footerClassName`。

3. 业务层：
- `src/features/settings/SettingsCenterModal.tsx`
- `src/features/feeds/AddFeedDialog.tsx`（从 `FeedList.tsx` 抽离）
- 业务层只负责字段映射、事件、状态与校验反馈。

## 4.2 数据流

### SettingsCenter

1. 打开弹窗时执行 `loadDraft()`。
2. 面板编辑通过 `updateDraft()` 写入草稿。
3. 点击“保存”调用 `saveDraft()`，成功后关闭。
4. 点击“取消”或关闭按钮调用 `discardDraft()`，恢复为未编辑状态。
5. 校验错误继续使用 `validationErrors`，映射到对应字段。

### AddFeed

1. 弹窗本地 state：`feedTitle`、`feedUrl`、`feedFolderId`。
2. 提交时维持当前 `addFeed()` 逻辑与字段规范。
3. 关闭路径（取消、X、Esc、遮罩）统一清理临时输入。

## 5. UI 与交互设计（遵守页面整体不改）

1. 不改三栏页面布局，只在弹窗内重构信息架构。
2. 设置中心保持“左导航 + 右内容 + 底部操作”骨架，可优化为更清晰的分组卡片。
3. 颜色、边框、圆角、阴影沿用现有 Tailwind 风格，不做突兀主题切换。
4. 图标可替换为更一致的 `lucide-react` 组合，但保持克制。
5. 统一动效：短时长淡入/缩放，避免与主页面冲突。

## 6. 可访问性与稳定性

1. 依赖 `Dialog` 的焦点管理，保证键盘可达。
2. 保留并补齐 `DialogTitle` 与描述语义。
3. 支持 `Esc` 关闭。
4. 表单控件提供清晰 `label` 关联与错误提示。
5. 避免在弹窗中引入破坏测试选择器的文案/语义变化。

## 7. 测试策略

1. 保持并运行现有测试：
- `src/features/settings/SettingsCenterModal.test.tsx`
- `src/features/reader/ReaderLayout.test.tsx`
- `src/app/(reader)/ReaderApp.test.tsx`

2. 补充测试（如缺失）：
- SettingsCenter 的 Esc/overlay 关闭路径。
- AddFeedDialog 的打开、取消、提交、禁用态。
- 关键 aria 与 testid 保持可查询。

3. 手工验证：
- 浅色/深色模式下与三栏页面背景和谐。
- 设置保存失败时不关闭弹窗且错误可见。

## 8. 风险与缓解

1. 风险：引入 `shadcn` 后 class 体系冲突。
- 缓解：仅引入本次所需组件，样式以现有色板为准，不改全局 token。

2. 风险：测试因结构变化脆弱。
- 缓解：保留关键 `aria-label` 与 `data-testid`，必要时仅最小改测。

3. 风险：弹窗视觉与三栏主界面风格割裂。
- 缓解：以“和谐适配”为首要验收项，避免引入与当前页面不一致的重主题效果。

## 9. 验收标准

1. 两个目标弹窗均迁移至统一基座。
2. 三栏主页面布局与主视觉不变。
3. 设置中心功能回归通过，AddFeed 行为回归通过。
4. 单测通过且无新增 console error。
5. 弹窗视觉在浅色/深色模式下与当前界面和谐一致。

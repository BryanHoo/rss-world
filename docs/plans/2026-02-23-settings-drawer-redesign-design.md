# Settings Drawer 全面重设计（Minimal OS）

- 日期：2026-02-23
- 状态：Approved
- 范围：`src/features/settings/*` 设置中心容器与全部分组 UI/UX

## 1. 背景与目标

当前设置中心虽然功能可用，但整体视觉与交互割裂，且仍以弹窗心智为主，不满足“完整设置工作区”的使用体验。

本次目标：

1. 在不新增路由前提下，将设置改造为右侧抽屉工作区（Drawer）。
2. 全量重做设置面板 UI/UX，采用 `Minimal OS` 视觉方向，不参考现有样式细节。
3. 保持现有功能范围（Appearance / AI / Shortcuts / RSS CRUD），不新增业务能力。
4. 保存机制改为自动保存（Auto Save），不再提供显式保存按钮。

## 2. 已确认约束与决策

1. 不新增 `/settings` 路由，入口仍为 `open-settings`。
2. 容器形态为右侧抽屉（桌面），小屏降级为全屏抽屉。
3. 导航结构：左侧一级分组导航 + 右侧编辑区。
4. 分组层级：一级分组直达编辑，不引入二级信息架构。
5. 保存策略：自动保存（debounce），不做显式保存。
6. 关闭策略：存在未保存异常状态时，关闭触发二次确认。
7. `apiKey` 仍为 `sessionOnly`，禁止进入持久化 payload。

## 3. 方案评估

### 方案 A：Drawer Workspace（采纳）

右侧抽屉内构建完整设置工作区（左导航 + 右编辑 + 顶部状态）。

- 优点：与当前页面集成自然，侵入性低，改造后感知明显。
- 优点：可在保留 store 模型的前提下重做 UI/UX。
- 缺点：空间小于独立路由页面，需要严格控制信息密度。

### 方案 B：Modal 强化版

继续使用 Dialog，仅重做内部布局和视觉。

- 优点：改动最小。
- 缺点：仍保留“临时弹层”心智，不符合“完全重做”目标。

### 方案 C：独立全屏路由页

- 优点：空间最大，系统感最强。
- 缺点：与约束冲突（已确认不新增路由）。

结论：采纳方案 A。

## 4. 信息架构与组件设计

## 4.1 分组结构（仅现有功能）

1. `Appearance`
2. `AI`
3. `Shortcuts`
4. `RSS Sources`

## 4.2 组件分层

1. 容器层：`SettingsCenterDrawer`
- 负责打开/关闭、导航切换、自动保存调度、关闭拦截。

2. 分组面板层（延续现有职责，可重做 UI）
- `AppearanceSettingsPanel`
- `AISettingsPanel`
- `ShortcutsSettingsPanel`
- `RssSourcesSettingsPanel`

3. 逻辑层（复用）
- `useSettingsStore`（`loadDraft/updateDraft/saveDraft/discardDraft`）
- `validateSettingsDraft`

## 4.3 页面骨架

1. 抽屉顶部：标题 + 保存状态（`Saving...` / `Saved` / `Fix errors to save`）+ `Close`。
2. 抽屉主体：
- 左栏：分组导航（固定宽度）
- 右栏：当前分组编辑内容（滚动区）
3. 不设置底部 `Save` 操作区。

## 5. 数据流与自动保存策略

1. 打开抽屉：调用 `loadDraft()`，生成当前会话编辑副本。
2. 字段编辑：统一走 `updateDraft()`。
3. 自动保存：监听 `draft` 变化并 `debounce(500ms)` 调用 `saveDraft()`。
4. 成功保存：更新保存状态为 `Saved`，清空错误提示。
5. 保存失败：保持 `draft`，显示字段错误，状态为 `Fix errors to save`；用户继续编辑后自动重试。
6. `apiKey`：可随自动保存写入 `sessionSettings`，但不进入 `persistedSettings/localStorage`。

## 6. 交互与错误处理

1. 关闭触发（X / Esc / Overlay）统一走拦截逻辑。
2. 若存在 `validationErrors` 或保存进行中，弹出二次确认：
- 确认：`discardDraft()` 并关闭
- 取消：保持抽屉打开
3. 字段错误需就近可见，并在分组层提供聚合提示（尤其是 `Shortcuts` 冲突与 `RSS` URL 错误）。
4. `RSS Sources` 对新增、编辑、删除、启停均支持自动保存反馈。

## 7. 视觉与可用性规范（Minimal OS）

1. 低饱和、弱阴影、清晰留白，不做重装饰。
2. 控件高度、圆角、焦点态统一，减少组件拼接感。
3. 优先文字层级与间距秩序，不依赖高对比大色块。
4. 桌面与移动均保持操作可达，避免横向压缩导致表单不可用。

## 8. 测试与验收

1. 抽屉行为
- 打开、Esc、Overlay、关闭确认流程可测。

2. 自动保存行为
- 编辑触发 `Saving...` -> `Saved`。
- 校验失败时显示 `Fix errors to save`，修复后自动落盘。

3. 业务回归
- `Appearance` 修改生效。
- `AI apiBaseUrl` 校验正确。
- `Shortcuts` 冲突阻止保存并可恢复。
- `RSS` CRUD 全流程可用。

4. 安全回归
- `apiKey` 不进入 `feedfuse-settings` localStorage payload。

## 9. 非目标

1. 本次不新增设置业务分组（通知/账户/隐私等）。
2. 本次不引入后端同步、导入导出、批量重置等能力。
3. 本次不改阅读页三栏主布局。

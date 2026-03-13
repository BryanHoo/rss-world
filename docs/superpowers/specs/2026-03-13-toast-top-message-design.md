# FeedFuse 顶部居中提醒重构设计

- 日期：2026-03-13
- 状态：已确认
- 需求：重构当前成功、失败等全局提醒组件，参考 `antd` `message` 的顶部中间出场方式，让提醒从页面顶部中间弹出；同时保留 FeedFuse 现有更强的语义表达，不退化为完全中性的 message。

## 背景

当前全局提醒实现已经具备完整的状态能力，但展示形态仍然更接近“右上角通知栈”，与本轮目标不一致：

- `src/features/toast/toastStore.ts`
  - 已提供 `success / info / error` 三类 tone
  - 已提供默认时长、1500ms 去重窗口、最多 3 条队列和错误优先保留逻辑
- `src/features/toast/toast.ts`
  - 已作为全局调用入口，被 reader、settings、feeds 等多个功能区直接调用
- `src/features/toast/ToastHost.tsx`
  - 当前使用 `RadixToast.Viewport`
  - 容器位置由 `src/lib/designSystem.ts` 中的 `NOTIFICATION_VIEWPORT_CLASS_NAME` 控制，当前固定在右上角
  - 卡片视觉保留较明显的边框、底色和关闭按钮，更像站内通知而不是顶部 message

最近的主题设计也已经把 toast 明确纳入品牌化浮层体系：

- `docs/superpowers/specs/2026-03-13-feedfuse-editorial-cobalt-color-design.md`
  - 已要求 toast 使用品牌浮层阴影与语义 token
  - 明确不允许回退到脱节的硬编码颜色和旧式 `shadow-md`

因此，这次任务的重点不是重新定义提醒状态模型，而是在不破坏现有调用与品牌浮层体系的前提下，把提醒的空间位置、视觉重量和动效语言重构为“顶部中间 message”，并保留错误态相对更强的存在感。

## 目标

- 让全局提醒从顶部中间弹出，用户第一视线可见
- 参考 `antd` `message` 的轻量横向条形结构，而不是角落通知栈
- 保持当前 `toast.success / info / error` API 与队列能力不变
- 保留成功、信息、错误三类语义，并让错误态比普通 message 更有存在感
- 让提醒继续落在现有品牌化浮层 token 和阴影体系中

## 非目标

- 不重写 `toastStore` 的基础状态模型，不改业务层调用方式
- 不把提醒系统改造成全新的 `notification center`、抽屉或历史面板
- 不把所有提醒退化为完全中性的单一样式
- 不顺手修改 reader、settings、feeds 等业务逻辑或文案
- 不在本轮引入加载进度条、操作撤销等新交互能力

## 已确认输入

- 参考方向：顶部中间弹出，参考 `antd` `message`
- 视觉方向：方案 `B`
  - 顶部居中，但保留较明显的语义色、阴影和关闭动作
- 交互边界：保留当前队列能力，不改业务调用 API
- 结果预期：不是简单把旧通知栈搬到中间，而是把它重做成更接近 message 的轻量提醒

## 备选方案

### 方案 A：仅改位置与样式

做法：

- 保留当前 `ToastHost` 结构与卡片密度
- 只把 viewport 从右上角移到顶部中间
- 只对圆角、阴影和间距做小幅调整

优点：

- 改动最小
- 回归风险最低

缺点：

- 视觉上仍然像“通知栈换位置”
- 难以达到本轮所需的 `message` 感

### 方案 B：保留现有能力，重做成顶部 message 形态（推荐）

做法：

- 保留 `toastStore` 的去重、限栈和错误优先保留逻辑
- 保留 `toast.ts` 对外 API
- 将 `ToastHost` 改造成顶部居中窄列，单条提醒采用更紧凑的横向 message 结构
- 保留关闭按钮和语义表达，但降低它们的视觉重量

优点：

- 兼容现有调用链与行为契约
- 能同时满足“顶部中间”和“语义更强”的双重目标
- 范围稳定在 toast 模块内，不会演变成业务重构

缺点：

- 比单纯调样式多一些测试与契约调整

### 方案 C：彻底 message 化为单条串行队列

做法：

- 同一时间只显示一条提醒
- 成功和信息态移除关闭按钮，仅错误允许手动关闭
- 队列改为串行播放

优点：

- 最接近 `antd` `message`

缺点：

- 会改变当前多个操作连续反馈的行为
- 批量操作、导入导出、刷新等场景的信息量会下降

## 推荐方案

采用方案 B：保留现有能力，重做成顶部 message 形态。

理由：

- 它精确匹配用户选择的 `B` 方向：顶部居中，但错误态和失败态仍保留足够语义存在感
- 它保留当前全局调用与状态能力，业务侧无需改动
- 它能把本轮改动边界收敛在 `ToastHost`、相关 token 和测试上，避免演变为状态模型重写

## 已确认设计

### 1. 交互模型

提醒系统继续沿用当前状态模型，但展示心智改为“页面级顶部反馈”：

- 提醒从页面顶部中间进入，而不是从页面角落出现
- 桌面端固定在顶部安全区下方，移动端保持相同位置但自动缩窄宽度
- 继续允许最多 3 条提醒进入队列
- 第一条提醒是主视觉焦点，后续条目以更轻的方式堆叠在下方
- `success` 与 `info` 继续自动消失
- `error` 保留更长展示时长，并允许手动关闭

明确取舍：

- 不把当前多条队列能力削减成完全单条串行
- 不保留右上角“站内通知”式的角落心智
- 不把错误态做成对话框或阻断式提示

### 2. 组件结构与展示层职责

结构层继续复用当前技术方案：

- `src/features/toast/toast.ts`
  - 继续作为唯一调用入口
- `src/features/toast/toastStore.ts`
  - 继续负责去重、时长、限栈和 dismiss
- `src/features/toast/ToastHost.tsx`
  - 继续使用 `RadixToast.Provider + Root + Viewport`
  - 负责将现有 store 队列渲染为顶部 message

展示层重构重点：

- 把 viewport 从右上角改为顶部居中
- 将共享类名从“notification corner stack”语义收敛为“top message viewport”语义
- 桌面端宽度控制在约 `28rem`
- 移动端宽度控制为 `calc(100vw - 1rem)` 左右，避免贴边
- 保留 `pointer-events-none` 容器 + `pointer-events-auto` 卡片的可点击边界，避免遮挡页面头部其它交互区域

### 3. 单条提醒视觉语言

单条提醒采用“接近 `antd` `message`，但保留 FeedFuse 语义表达”的折中方向：

- 使用横向紧凑条形结构，而不是角落通知卡片
- 左侧保留小尺寸圆形语义图标
- 中间只承载主文案，不额外引入标题、副标题或操作区
- 右侧保留关闭按钮，但降权处理，让它仅作为补充控制
- 阴影继续使用 `shadow-popover` 家族，保持与当前品牌浮层一致

语义表达规则：

- `success` 与 `info`
  - 以更接近 `popover / background` 的中性表面为主
  - 只在图标、边框和轻微底色上表达语义
- `error`
  - 使用更强一点的语义底色和边框
  - 仍保持 message 的轻量感，不扩大成大面积警报色

明确约束：

- 不使用硬编码的品牌外颜色
- 不回退到旧式 `shadow-md`
- 不让关闭按钮成为视觉主角

### 4. 顶部布局与堆叠规则

顶部居中后，提醒需要从“卡片栈”转换为“message 队列”：

- 容器采用顶部中间固定定位
- 第一条提醒完整显示
- 第二、第三条提醒继续存在，但以更紧凑的间距向下排列
- 所有条目保持相同宽度，避免出现角落通知式的参差布局
- 当只存在一条提醒时，应呈现标准单条 message 观感

这意味着：

- 队列能力继续保留
- 但视觉表达更接近 message，而不是传统通知列表

### 5. 动效与节奏

动效应改为符合顶部 message 心智的“下落感”：

- 打开时：顶部轻微下滑并渐显
- 关闭时：向上收起并渐隐
- 堆叠条目切换时避免夸张位移动画
- 时长保持当前 store 默认值，不在本轮额外调长或调短

无障碍与系统偏好要求：

- 继续尊重全局 `prefers-reduced-motion`
- 不单独增加重动画特例
- 动画应短促，避免频繁操作时打断阅读

### 6. 状态与可访问性边界

当前可访问性语义继续保留，不因样式重构退步：

- `error`
  - 保持 `role="alert"`
  - 保持 `aria-live="assertive"`
- `success` 与 `info`
  - 保持 `role="status"`
  - 保持 `aria-live="polite"`
- 关闭按钮继续提供明确的 `aria-label`

交互边界：

- 不新增焦点陷阱
- 不要求提醒获得初始焦点
- 仅让提醒卡片自身可交互，外围容器保持不可点击

### 7. 实施边界

本轮改动边界收敛为三层：

- Shared token / design system
  - `src/lib/designSystem.ts`
  - 必要时同步 `src/app/globals.css` 的宽度 token
- Feature layer
  - `src/features/toast/ToastHost.tsx`
- Test layer
  - `src/features/toast/ToastHost.test.tsx`
  - 若契约涉及旧类名，则同步更新 `src/app/theme-token-usage.contract.test.ts`

默认不改：

- `src/features/toast/toast.ts`
- `src/features/toast/toastStore.ts`

只有在展示层无法满足设计目标时，才允许最小化补充展示相关数据，但不改变对外 API。

### 8. 风险与防护

主要风险：

- 顶部居中后，如果仍沿用旧卡片密度，最终只会像“搬家后的通知栈”
- 队列能力保留后，如果条目间距和宽度控制不好，会让顶部中心区域显得拥挤
- 错误态如果语义色过重，会偏离 `message` 的轻量方向
- 错误态如果语义色过轻，又会丢失用户明确选择的 `B` 方案特征

防护策略：

- 通过测试锁定顶部居中 viewport 位置和新类名契约
- 继续使用语义 token，而不是散落原子色类
- 保持 store 逻辑不动，把风险集中在展示层
- 通过少量多条提醒测试确认顶部堆叠不会退化成角落通知样式

## 测试与验证

实现阶段按 TDD 执行，至少覆盖以下验证：

- `src/features/toast/ToastHost.test.tsx`
  - 先写失败测试，确认 viewport 从右上角改为顶部居中
  - 断言 toast root 使用新的 message 风格类和顶部动效类
  - 保留现有消息可见与卸载清空行为验证
- 如需调整展示契约
  - 同步更新 `src/app/theme-token-usage.contract.test.ts`
  - 必要时补充多条提醒同时渲染的堆叠断言
- 手动检查
  - 桌面端与移动端顶部宽度和安全区偏移
  - `success / info / error` 三种 tone 的视觉重量差异
  - 连续触发多条提醒时顶部中间区域是否仍然整洁

## 后续实施入口

在用户确认此设计文档后，下一步应进入 `workflow-writing-plans`，先把实现计划拆开，再开始测试与编码。

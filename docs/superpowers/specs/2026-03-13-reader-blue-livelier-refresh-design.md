# FeedFuse 阅读列表蓝色轻盈化设计

- 日期：2026-03-13
- 状态：已确认
- 需求：保持 FeedFuse 当前蓝色品牌基调不变，把阅读列表和相关表面从偏闷、偏灰蓝的状态调整为更清透、更活泼的蓝色层次；优先强化未读信号，让未读文章可以通过更亮、更大的蓝色圆点和更清晰的时间色被一眼识别。

## 背景

`src/app/globals.css`、`src/lib/designSystem.ts` 与 `src/features/articles/ArticleList.tsx` 已经组成了当前 reader 列表的主要视觉基线：

- `globals.css` 负责 `background / card / popover / primary / muted / accent / border` 等语义 token
- `designSystem.ts` 负责 reader pane 底面、hover 与 frosted surface 这类共享表面 class
- `ArticleList.tsx` 直接决定未读圆点、未读时间色、列表项 hover 与选中态的最终表达

在最近一轮品牌收紧后，蓝色基调已经统一，但当前列表区仍有三个直接影响体验的问题：

- 整体表面仍然偏闷，light 模式的背景、pane 和 hover 层次还不够通透
- 未读态主要依赖偏深的 `bg-primary` 小圆点与 `text-primary` 时间色，信号强度不够，不能一眼区分
- `selected / hover / unread / primary action` 都在复用蓝色家族，但层级拆分不够清楚，容易互相打架

项目中已有几项约束会直接影响本轮设计：

- `src/app/theme-token-usage.contract.test.ts` 已要求主要功能区继续依赖语义 token，而不是直接散落原子蓝色
- `src/app/globals-css.contract.test.ts` 已锁住主题结构与若干全局变量，颜色调整要尽量沿用现有 token 体系
- `docs/summaries/2026-03-11-reader-hydration-snapshot-and-literal-state-build.md` 已锁住 reader 的 hydration 行为，本轮只能改 class、token 与视觉节点，不能顺手改渲染逻辑
- `docs/summaries/2026-03-11-accessible-name-token-leak.md` 已锁住文章列表与 reader 主操作的中文可访问名称，本轮不能因为视觉改造而破坏这些语义

因此，这次设计的重点不是重新定义品牌色，而是在现有钴蓝体系里把 reader 列表收紧成“雾面蓝纸 + 高亮蓝信号”的更轻盈版本。

## 目标

- 保留 FeedFuse 当前蓝色品牌连续性，不引入新的主色方向
- 提亮 background、pane、hover 与 selected 的层次，让列表区更清透、更有呼吸感
- 把未读态从“深蓝信息点”升级成“高亮蓝信号”，优先提升一眼识别能力
- 让 card / list 两种显示模式共享同一套未读视觉语言
- 保持现有信息结构、交互顺序、状态逻辑与语义 token 体系不变

## 非目标

- 不新增新的主题模式、reader 专属并行颜色系统或局部品牌分支
- 不修改 `isRead`、`showUnreadOnly`、`selectedArticleId`、snapshot 刷新等行为逻辑
- 不重做列表结构，不新增未读标签组件、左侧导轨或其他全新布局元素
- 不顺手改 reader 的 hydration、Zustand 状态、数据流或 API 行为
- 不把成功、错误、警告等语义色并入未读视觉系统

## 已确认输入

- 品牌基调：继续使用当前蓝色家族，不改成暖色、绿色或粉色方案
- 优先级：优先强化未读信号本身，而不是主要依靠整行背景吸引注意
- 未读标记形式：保留圆点结构，但改成更亮、更大的蓝色信号点
- 风格方向：背景更透、表面更清、该加深的组件加深，该提亮活泼的地方提亮活泼
- 边界约束：只改 token、shared surface 和 `ArticleList` 视觉表达，不改结构与交互模型

## 备选方案

### 方案 A：亮点强化

做法：

- 保留当前未读圆点结构
- 只强化圆点亮度、尺寸与未读时间色
- 背景和 pane 层次只做极小调整

优点：

- 改动最小
- 与当前 UI 最兼容
- 用户学习成本几乎为零

缺点：

- 如果没有配套的层次校色，未读信号提升会有限
- 列表区整体仍可能保留当前的偏闷观感

### 方案 B：亮点强化 + 轻量层次校色（吸收采用）

做法：

- 以方案 A 为核心，保留高亮蓝圆点作为未读主信号
- 同时轻量调整背景、pane、hover、selected 的明度与边界关系
- 明确拆开 `selected / hover / unread` 三种蓝色语义

优点：

- 既能显著提升未读识别度，又能让整体更清透
- 保持现有结构，不会演变成高风险重设计
- 与用户确认的“蓝色不变、未读更强、整体更活泼”方向一致

缺点：

- 会同时触及 token、shared surface 和 `ArticleList`，需要补足视觉回归

### 方案 C：亮点强化 + 微型蓝晕底

做法：

- 保留圆点，但给未读 metadata 区域增加浅蓝底衬或内晕

优点：

- 未读信号最强

缺点：

- 设计痕迹偏重，容易超出“清透但克制”的边界
- 和用户明确选择的“保留现有圆点结构”不完全一致

## 推荐方案

采用方案 A，并吸收方案 B 的轻量层次校色。

理由：

- 它尊重用户对未读标记形式的明确选择：继续用圆点，而不是改成 chip、标签或导轨
- 它能在最小结构改动下显著提升一眼识别能力
- 通过少量吸收方案 B 的层次调整，可以避免出现“圆点变亮了，但界面整体仍然发闷”的结果
- 它把范围稳定在 token、shared surface 与 `ArticleList` 之间，不会演变成 reader 全量重设计

## 已确认设计

### 1. 色彩方向

本轮色彩采用“雾面蓝纸 + 电感亮蓝信号”的组合关系。

具体规则：

- 全局背景继续保留轻度染蓝的冷调基底，但 light 模式提亮半级到一级，减少闷感
- `card / popover / pane / hover` 的亮度关系重新拉开，让表面更干净，但不发白
- `primary` 仍保留 FeedFuse 当前品牌蓝识别，未读信号则在同一蓝色家族中选择更亮、更清澈的一档表达
- 已读文字继续退后，但避免使用发灰、发脏的处理方式
- dark 模式不反向变得更炫，而是同步保持“蓝纸面 + 清澈信号蓝”的家族关系

该层只定义颜色关系，不定义具体组件结构。

### 2. Token 与共享表面

本轮只在现有语义 token 基础上校色，不新增新的 `readerUnread*` 类别 token。

主要覆盖：

- `src/app/globals.css`
  - 轻量提亮 `background / card / popover`
  - 重新拉开 `muted / accent / border` 的层级，避免普通项、hover、selected 糊成一片
  - 为未读信号预留更亮的蓝色表达来源，但继续通过现有语义 token 和局部 class 组合落地
- `src/lib/designSystem.ts`
  - `READER_TABLET_ARTICLE_PANE_CLASS_NAME` 调整为更通透的中栏表面
  - `READER_PANE_HOVER_BACKGROUND_CLASS_NAME` 改成更轻的浅蓝雾层，而不是压下来的深灰蓝 hover
  - `FROSTED_HEADER_CLASS_NAME` 与 `FLOATING_SURFACE_CLASS_NAME` 保持蓝色品牌基调，但减少沉重感，让 reader chrome 和列表区属于同一气质

统一原则：

- `selected` 是当前上下文，应采用更大面积、低饱和度的蓝色表面
- `hover` 是临时反馈，应比 `selected` 更轻
- `unread` 是待处理信号，应保持最小面积但最高可见度
- `primary action` 继续表达操作语义，不能与未读信号复用完全相同的强调方式

### 3. ArticleList 未读表达

`src/features/articles/ArticleList.tsx` 是本轮核心改动点。

#### 未读圆点

- 保留现有圆点结构，不改成 chip、标签或导轨
- 尺寸上调一档，让它不再像被 metadata 吞掉的像素点
- 颜色从当前偏深的 `bg-primary` 改成更亮、更清澈的蓝色信号点
- 必要时允许增加轻微的亮面对比或外圈对比，但不能发展成高饱和“荧光灯点”

#### 未读时间

- 未读时间色从普通 `text-primary` 升级为更有能见度的一档蓝
- 它应与未读圆点组成同一组信号，而不是各自独立
- 已读时间继续退后，但保持清爽可读，不做脏灰处理

#### 标题与摘要

- 未读标题继续承担较强字重，但避免只靠粗体承担全部识别任务
- 已读标题与摘要可以略退后，以衬托未读信号点与未读时间
- `card` 与 `list` 两种模式必须使用同一套未读语言，不能出现一种明显、一种缩回去的情况

#### 选中态与 hover

- 选中态继续表达“当前上下文”，不能和未读信号混成同一种亮蓝表意
- hover 保持最轻反馈，只负责引导鼠标轨迹，不抢未读信号
- 如果选中项同时未读，优先保证选中上下文依然清楚，再在 metadata 区域保留未读信号

### 4. 结构边界与职责

本轮改动按三层边界推进：

- Token layer：`src/app/globals.css`
- Shared surface layer：`src/lib/designSystem.ts`
- Feature layer：`src/features/articles/ArticleList.tsx`

边界要求：

- Token layer 负责整体蓝色家族与表面明度关系
- Shared surface layer 负责 reader pane、hover 与 frosted surface 的统一语气
- Feature layer 只接入新视觉表达，不新增并行主题体系或结构性组件

### 5. 风险与防护

主要风险：

- `selected / hover / unread / primary action` 都使用蓝色家族，如果层次拆分不清，会出现“都变亮了但还是看不清主次”
- token 提亮过度会让 reader 丢掉原本的安静阅读感
- 只强化圆点而不校正周边层次，最终效果可能只剩“点更大”，整体仍不够通透
- card / list 两种显示模式可能在未读表达上再次分裂

对应防护：

- 明确用面积和饱和度拆开四种蓝色语义，而不是单纯整体提亮
- 优先调整表面层与 metadata 信号，不依赖大面积高饱和底色
- 所有未读视觉都先在 `ArticleList` 的 card / list 双模式下成对校验
- 尽量复用现有语义 token 与 class 结构，减少断言和维护成本

### 6. 验证策略

至少需要完成以下验证：

- 契约测试
  - `pnpm exec vitest run src/app/globals-css.contract.test.ts src/app/theme-token-usage.contract.test.ts`
  - 必要时扩展 token 断言，确认关键主题值不会回退到当前这版偏闷的关系
- 功能与样式回归
  - `pnpm exec vitest run src/features/articles/ArticleList.test.tsx`
  - 补充 card / list 两种模式下未读圆点与未读时间的 class 断言，锁住新的未读信号样式
- 浏览器核验
  - 确认默认 light 模式下列表背景更透，但仍属于当前品牌蓝体系
  - 确认不依赖标题粗细，也能先通过圆点和时间快速识别未读
  - 确认 `selected / hover / unread` 三者一眼能分清，不会全部像同一种蓝色高亮

## 实施建议

实现顺序建议如下：

1. 先更新 `src/app/globals.css`，校正 light / dark 主题的表面层次
2. 再更新 `src/lib/designSystem.ts`，统一 reader pane 与 hover 的共享表面表达
3. 最后改 `src/features/articles/ArticleList.tsx` 的未读圆点、未读时间与选中态配合关系
4. 每完成一层就运行对应测试，避免把视觉回归堆到最后一起排查

该顺序可以先稳定主题基础，再落到具体未读表达，最大化控制风险并保留迭代空间。

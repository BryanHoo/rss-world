# 阅读栏浮动目录设计

- 日期：2026-03-07
- 状态：已确认（Approved）
- 范围：
  - `src/features/articles/ArticleView.tsx`
  - `src/features/articles/ArticleOutlineRail.tsx`
  - `src/features/articles/articleOutline.ts`
  - `src/features/articles/ArticleOutlineRail.test.tsx`
  - `src/features/articles/articleOutline.test.ts`
  - `src/features/articles/ArticleView.outline.test.tsx`
  - `docs/plans/2026-03-07-reader-outline-rail-implementation-plan.md`

## 1. 背景与目标

当前阅读器采用三栏布局，右栏正文区已经是剩余空间列。用户希望在**不再挤压正文宽度**的前提下，为右栏阅读区增加一个常驻、低存在感的目录能力，满足两类需求：

1. 默认态能够隐约表达“当前读到哪里了”。
2. 需要时鼠标移入即可展开目录，快速跳转到文章内部章节。

本次需求目标：

1. 在正文右侧增加一个**超窄浮动概览条**，常驻显示阅读进度与 heading 分布。
2. 用户 hover 到概览条后，向左展开一个小型目录卡片。
3. 目录项基于正文真实 `h1/h2/h3` 生成，并随滚动高亮当前章节。
4. 文章没有 `h1/h2/h3` 时，整个目录入口完全不显示。
5. 不改造现有三栏布局宽度分配，不新增全局高频状态。

## 2. 已确认方向与边界

### 2.1 交互方向

采用“**窄轨道常驻 + hover 展开目录卡片**”的方向，而不是传统右侧目录栏。

确认交互：

1. 收起态只占右侧极小空间，视觉类似代码编辑器的 `minimap rail`。
2. 默认态不展示完整标题文字，只表达进度和结构分布。
3. 用户鼠标移上去后自动展开，不需要点击固定展开。
4. 鼠标离开轨道与卡片后自动收起。

### 2.2 显示规则

1. 没有选中文章时不显示。
2. 文章正文没有 `h1/h2/h3` 时不显示。
3. 不把文章页头的大标题自动并入目录，目录只关注正文内部结构。

### 2.3 不做内容

1. 不新增一个常驻完整右侧目录列。
2. 不做目录搜索、层级折叠、固定展开或拖拽调宽。
3. 不支持移动端专门手势交互。
4. 不新增全局 store 持久化目录开关或目录状态。

## 3. 相关经验与外部参考

### 3.1 项目内已知经验

- 参考总结：[`docs/summaries/2026-03-06-reader-resizable-three-column-layout.md`](../summaries/2026-03-06-reader-resizable-three-column-layout.md)
  - 启发：右栏阅读区是剩余空间列，新增能力应尽量使用绝对定位浮层，而不是再次挤占三栏宽度。
- 参考总结：[`docs/summaries/2026-03-05-translation-preserve-html-structure.md`](../summaries/2026-03-05-translation-preserve-html-structure.md)
  - 启发：翻译模式会保留并增强原 HTML 结构，因此目录应基于最终渲染 DOM 提取，而不是从原始数据单独重建。
- 参考总结：[`docs/summaries/2026-03-06-middle-column-image-loading.md`](../summaries/2026-03-06-middle-column-image-loading.md)
  - 启发：与滚动、视区相关的高频交互应尽量使用 observer / 局部状态，避免高频全局状态更新与无意义重渲染。

### 3.2 外部参考

1. Notion 发布于 2024-06-11 的更新中提供了“floating table of contents”，采用右侧 hover 触发目录的轻量模式，适合作为交互参考。
   - `https://www.notion.com/en-gb/releases/2024-06-11`
2. GitBook 的 `Page outline` 更偏传统目录栏，适合宽页面，但对当前右栏偏小的阅读器不够克制。
   - `https://gitbook.com/docs/resources/gitbook-ui`
3. VS Code 的 `Minimap` 提供了“极窄空间里表达阅读位置”的视觉启发，适合作为收起态的参考对象。
   - `https://code.visualstudio.com/docs/getstarted/userinterface`

## 4. 方案比较与选型

### 方案 A（采纳）：窄概览条 + hover 展开目录卡片

- 做法：在正文右侧绝对定位一条超窄概览条，默认显示 reading progress 与 heading 分布；hover 后向左展开目录卡片，点击目录项驱动正文容器滚动。
- 优点：
  - 最省空间，默认态干扰最低。
  - 既能表达“读到哪里”，也能在需要时做章节跳转。
  - 不改三栏骨架，与当前 `ReaderLayout` 最兼容。
- 缺点：
  - 交互和局部状态管理比纯目录列表稍复杂。

### 方案 B：右侧始终显示超窄目录列表

- 优点：
  - 实现相对直接。
  - 用户不需要学习 hover 才能发现目录。
- 缺点：
  - 即便做窄也会长期侵占右栏正文宽度。
  - 默认态信息密度偏高，不符合“低存在感”目标。

### 方案 C：纯 minimap 式进度条 + hover 浮层目录

- 优点：
  - 收起态最轻。
  - 实现复杂度略低于方案 A。
- 缺点：
  - 收起态看不到文章结构分布。
  - 无法一眼建立“这篇文章大概分几节”的认知。

结论：采用方案 A。

## 5. 交互与视觉设计

### 5.1 收起态

1. 目录入口为一条贴在正文右侧边缘的超窄轨道，不参与文档流布局。
2. 轨道默认仅展示：
   - 一个 viewport 高亮块，用于表示当前阅读进度。
   - 若干 heading 刻度，用于表示文内结构分布。
3. 收起态不展示标题文字，也不模拟整页文本缩略图，避免视觉脏乱。

### 5.2 展开态

1. 用户 hover 到轨道后，目录卡片向左展开。
2. 卡片宽度控制在“足够读标题、但不显著压迫正文”的范围。
3. 卡片显示 `h1/h2/h3`：
   - `h1` 视觉层级最高。
   - `h2` 次之。
   - `h3` 轻量缩进显示。
4. 标题过长时单行截断；需要时可通过 `title` 或 tooltip 暴露完整文本。

### 5.3 高亮与跳转

1. 当前章节高亮以“离阅读区顶部最近且已进入阅读区的 heading”为准。
2. 点击目录项时，正文滚动容器平滑滚动到对应 heading，并保留少量顶部呼吸空间。
3. 点击后的高亮仍由实际滚动位置接管，不单独维护一套“选中态”。

## 6. 架构与状态设计

### 6.1 组件边界

1. `ArticleView` 继续负责正文滚动容器与正文 HTML 渲染。
2. 新增 `ArticleOutlineRail` 组件，挂载在 `ArticleView` 内部，采用绝对定位浮在正文右侧。
3. 新增 `articleOutline.ts` 轻量工具，封装：
   - heading 提取
   - 稳定锚点生成
   - 轨道刻度位置计算

### 6.2 状态归属

以下状态全部保持在 `ArticleView` / `ArticleOutlineRail` 本地：

1. `headings`
2. `activeHeadingId`
3. `viewportProgress`
4. `isHovered`
5. 展开卡片的短暂延迟收起计时

这样设计的原因：

1. 这些状态是单篇文章生命周期内的瞬时 UI 状态。
2. 滚动与 hover 是高频交互，不适合进入 `appStore` 或 `settingsStore`。
3. 局部化更容易与正文切换、翻译切换和全文切换同步。

### 6.3 heading 数据来源

1. 目录只从正文实际渲染结果中提取 `h1/h2/h3`。
2. 不从文章元数据额外拼接目录。
3. 当 `bodyHtml` 因全文抓取、翻译视图或文章切换发生变化时，需要重新提取目录。
4. 若 heading 缺少稳定 `id`，前端在挂载后为其补齐可预测的锚点。

## 7. 数据流、边界与错误处理

### 7.1 滚动与观察源

1. 唯一滚动源为 `ArticleView` 中的 `article-scroll-container`。
2. 不依赖 `window.scrollY`，避免与页面级滚动、外层布局和浮动标题逻辑冲突。
3. 当前 heading 判断优先使用 `IntersectionObserver`；必要时可辅以轻量滚动计算。

### 7.2 重算时机

需要重新提取目录与重算轨道位置的场景：

1. 切换文章。
2. `bodyHtml` 改变。
3. 阅读区尺寸变化。
4. 正文内图片、翻译块或其他异步内容影响布局高度。

### 7.3 异常与降级

1. 没有 heading 时，整个目录轨道与目录卡片均不渲染。
2. 若点击目录项时目标节点已因重渲染消失，则静默失败，不额外提示。
3. hover 展开时若鼠标从轨道移向卡片，需保持展开；离开两者后再短延迟收起，避免闪烁。
4. 若阅读区过窄或不满足桌面体验条件，可直接隐藏目录组件。

## 8. 测试与验收设计

### 8.1 单元/组件测试

1. `articleOutline` 工具测试覆盖：
   - 提取 `h1/h2/h3`
   - 忽略非目标 heading
   - 生成稳定唯一锚点
2. `ArticleOutlineRail` 组件测试覆盖：
   - 无 heading 时不显示
   - 有 heading 时显示收起态轨道与刻度
   - hover 后展开目录卡片
   - 离开后自动收起
3. `ArticleView` 集成测试覆盖：
   - 正文包含 heading 时渲染目录轨道
   - 点击目录项会驱动 `article-scroll-container` 滚动
   - 正文滚动时当前 heading 高亮更新
   - 切换文章或正文 HTML 时目录重建

### 8.2 手工验收点

1. 长文场景下目录 hover 不抖动、不闪烁。
2. 右上角设置按钮与目录轨道不会互相遮挡。
3. 目录展开卡片不会长期压迫正文阅读。
4. 无 heading 文章中不会出现空轨道。
5. 翻译视图、全文视图切换后目录仍与正文结构一致。

## 9. 默认视觉参数建议

1. 收起态保持极窄宽度，弱透明度贴右显示。
2. 当前 viewport 块比普通 heading 刻度更明显，但仍低干扰。
3. 展开态向左展开，卡片高度不超过阅读区可视高度的一部分。
4. 当前激活 heading 通过文字高亮与细指示线联合表达，而非大面积背景色。

## 10. 结论

本次需求的核心不是在右侧再加一列目录，而是在不打扰阅读的前提下，为正文增加一个“结构感知 + 快速跳转”的轻量导航层。采用“窄轨道常驻 + hover 展开目录卡片 + 无 heading 不显示”的方案，既能满足用户对 minimap 式弱存在感的要求，也与当前三栏阅读器、全文/翻译渲染链路和局部状态管理方式保持一致。

# 阅读页右下角滚动辅助按钮设计

- 日期：2026-03-07
- 状态：已确认（Approved）
- 范围：
  - `src/features/articles/ArticleView.tsx`
  - `src/features/articles/ArticleScrollAssist.tsx`
  - `src/features/articles/ArticleView.outline.test.tsx`
  - `src/features/articles/ArticleScrollAssist.test.tsx`
  - `docs/plans/2026-03-07-reader-scroll-assist-implementation-plan.md`

## 1. 背景与目标

当前阅读器右侧已经存在目录浮层能力，但本次需求明确要求：**移除现有右侧目录**，改为在阅读区域右下角提供两个更克制的滚动辅助入口：

1. 阅读百分比，优先采用圆环形式，中间显示百分比。
2. 回到顶部按钮，放在百分比按钮下方。

已确认边界：

1. 目录功能在阅读页中完全移除，不再展示任何目录入口。
2. 两个按钮只在桌面阅读页显示。
3. 仅当文章标题离开视口后显示，不使用“滚动超过一屏”或固定像素阈值。
4. 阅读百分比按正文滚动进度计算，顶部为 `0%`，滚到底为 `100%`。
5. 百分比圆环仅作展示，不可点击。
6. 回到顶部按钮点击后平滑滚动到正文顶部。

## 2. 已确认方向与边界

### 2.1 交互方向

采用“**右下角浮动操作组**”替代现有右侧目录面板：

1. 不再保留目录面板、目录轨道或目录展开入口。
2. 右下角操作组由两个纵向堆叠的圆形控件组成。
3. 上方为阅读进度圆环，下方为回到顶部按钮。
4. 默认隐藏；当文章标题离开视口后淡入显示。

### 2.2 显示规则

1. 没有选中文章时不显示。
2. 非桌面断点时不显示。
3. 标题仍在视口中时不显示。
4. 正文没有形成有效滚动区时不显示。
5. 切换文章、切换正文 HTML、切换全文/翻译后，应重新按当前滚动容器计算显示与进度。

## 3. 架构设计

### 3.1 布局策略

继续维持现有三栏布局，不调整 `ReaderLayout` 的宽度分配，不新增新的右栏列。滚动辅助按钮组直接挂载在 `ArticleView` 内部，使用绝对定位渲染在正文视口右下角。

选择 `ArticleView` 作为承载层的原因：

1. 正文滚动容器、正文内容高度和标题显隐事实源都已经在 `ArticleView` 内。
2. 现有 `onTitleVisibilityChange` 链路已经能表达“标题是否离开视口”，可直接复用。
3. 继续把高频滚动状态保留在局部组件中，避免引入新的全局 store 或跨层通信。

### 3.2 组件拆分

建议新增 `ArticleScrollAssist` 组件，职责仅包含：

1. 渲染阅读进度圆环与百分比。
2. 渲染回到顶部按钮。
3. 接收 `progress`、`visible`、`onBackToTop` 等简单 props。

`ArticleView` 负责：

1. 基于正文滚动容器计算滚动进度。
2. 基于现有标题可见性逻辑决定是否显示按钮组。
3. 提供回到顶部行为。
4. 移除当前 `ArticleOutlineRail` 的渲染入口。

## 4. 组件与视觉设计

### 4.1 视觉语言

优先复用 shadcn/ui 的交互风格，而不是再造一套独立浮层样式：

1. 回到顶部按钮采用 `Button` 的视觉语义，保留边框、圆角、背景模糊与 focus-visible 状态。
2. 百分比圆环使用自定义 SVG 圆环，但外层容器与按钮尺寸、圆角、阴影、背景透明度保持一致。
3. 整体保持低存在感，避免抢夺正文注意力。

### 4.2 位置与层级

1. 挂载位置在正文视口右下角，建议靠近现有正文内边距，不贴边。
2. 两个按钮纵向堆叠，间距保持紧凑。
3. `z-index` 高于正文内容但低于全局模态，避免遮挡正文交互。

### 4.3 动效与可达性

1. 显示/隐藏使用轻微透明度过渡，不做大位移。
2. 回到顶部按钮支持键盘聚焦和 `aria-label`。
3. 进度圆环虽然不可点击，但文本对比度需满足阅读性要求；若使用非按钮语义，应避免误导性 hover 手势。

## 5. 数据流与状态设计

### 5.1 显示状态

不新增全局状态。显示逻辑由 `ArticleView` 局部状态派生：

1. `isDesktop`：沿用当前桌面断点判断。
2. `articleTitleVisible`：复用当前 `reportTitleVisibility` 逻辑。
3. `showScrollAssist = isDesktop && !articleTitleVisible && hasScrollableContent`。

### 5.2 阅读进度

阅读进度基于正文滚动容器计算：

```ts
const maxScroll = Math.max(scrollHeight - clientHeight, 0);
const progress = maxScroll <= 0 ? 0 : clamp(scrollTop / maxScroll, 0, 1);
const percent = Math.round(progress * 100);
```

该定义满足：

1. 顶部为 `0%`。
2. 底部为 `100%`。
3. 正文高度变化后仍以最终渲染 DOM 的滚动高度为准。

### 5.3 回到顶部

回到顶部行为直接绑定正文滚动容器：

```ts
scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
```

滚动回顶后，标题重新进入视口，按钮组自然隐藏。

## 6. 错误处理与退化策略

这是纯 UI 改动，不涉及网络和持久化。重点是安全退化：

1. 取不到滚动容器时不渲染按钮组。
2. `scrollHeight <= clientHeight` 时将进度按 `0` 处理并隐藏按钮组。
3. 任何异常进度值统一 clamp 到 `0 ~ 1`，避免出现 `NaN%` 或负值。
4. 若暂时保留目录相关 helper 文件，也不再让其参与阅读页渲染路径。

## 7. 测试策略

### 7.1 组件测试

若拆出 `ArticleScrollAssist`，应覆盖：

1. 百分比文本和圆环进度渲染。
2. `0`、`100` 和异常值 clamp。
3. 回到顶部按钮点击事件透传。
4. `visible = false` 时不渲染。

### 7.2 集成测试

`ArticleView` 应覆盖：

1. 标题可见时不显示按钮组。
2. 标题离开视口后显示按钮组。
3. 滚动更新时百分比随之变化。
4. 点击回到顶部按钮会调用滚动容器的 `scrollTo({ top: 0, behavior: 'smooth' })`。
5. 桌面以下断点不显示按钮组。
6. 原右侧目录导航不再渲染。

### 7.3 回归关注点

1. 不影响 `ReaderLayout` 现有浮动标题逻辑。
2. 不影响正文点击链接、图片加载、全文/翻译切换。
3. 不引入新的全局滚动状态。

## 8. 相关经验与证据

- `docs/summaries/2026-03-06-reader-resizable-three-column-layout.md`
  - 继续遵循“阅读器右栏能力优先采用绝对定位浮层，而不是继续切分布局宽度”的经验。
- `docs/summaries/2026-03-07-reader-outline-panel-redesign.md`
  - 复用“阅读辅助 UI 与正文滚动事实源保持局部化，不引入全局高频状态”的经验。
- `docs/summaries/2026-03-05-translation-preserve-html-structure.md`
  - 阅读进度继续基于最终渲染 DOM 的真实高度计算，兼容全文抓取和翻译后的正文长度变化。

## 9. 实施结论

本次需求的最终设计为：

1. 从阅读页中彻底移除现有右侧目录显示。
2. 在 `ArticleView` 内新增右下角浮动滚动辅助按钮组。
3. 按标题离开视口的时机显示按钮组，仅桌面端展示。
4. 上方展示不可点击的阅读百分比圆环，下方展示回到顶部按钮。
5. 所有滚动与显示状态保持局部，不调整三栏布局，不新增全局 store。

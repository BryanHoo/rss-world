# AI 解读来源底部展示与导航历史设计

## 背景

当前 AI 解读文章会在右栏正文前部渲染“来源”模块，阅读顺序会在正文开始前被打断。同时，阅读器当前会把 `view` 与 `article` 的 URL 同步统一写成 `replaceState`，导致从 AI 解读来源跳到原文文章后，浏览器返回无法回到刚才的 AI 解读上下文。

本次改动需要同时解决两个问题：

- AI 解读文章的来源模块移动到正文内容的最底部；
- URL 写入历史按交互来源区分：左栏 smart views 与订阅源（包括 `rss` 与 `ai_digest` feed）切换使用 `replace`，中栏文章点击与右栏来源文章跳转使用 `push`。

## 目标

- 仅在 `ai_digest` 文章中展示来源模块；
- 来源模块位于右栏正文 HTML 内容之后，成为正文阅读流的最后一个区块；
- 点击左栏 smart views、订阅源（包括 `rss` 与 `ai_digest` feed）时不新增浏览器历史记录；
- 点击中栏文章、AI 解读来源文章时新增浏览器历史记录，可通过浏览器返回回到上一个阅读状态；
- 保持现有 snapshot 加载与文章详情拉取机制不变，不引入新的路由系统。

## 非目标

- 不调整左栏 / 中栏的视觉结构；
- 不改变来源项的文案、卡片样式或排序；
- 不引入 React Router、Next Router 等额外路由抽象；
- 不改造成新的路由层；浏览器返回/前进恢复只在现有 `view/article` URL 参数与 store 同步机制上补齐，不扩展为新的导航框架。

## 现状

### 来源模块位置

`src/features/articles/ArticleView.tsx` 当前在正文 HTML 容器之前渲染来源模块，因此 AI 解读文章会先看到来源，再看到正文。

### URL 写入方式

`src/store/appStore.ts` 中的 `persistReaderSelectionToUrl(selectedView, selectedArticleId)` 会把当前选择统一写入 URL，并固定使用 `window.history.replaceState(...)`。这会让所有视图切换和文章切换都覆盖当前历史记录，无法为“阅读流”保留可返回的历史节点。

### 来源跳转链路

来源点击发生在 `src/features/articles/ArticleView.tsx` 的 `onAiDigestSourceClick(source)`：

1. `setSelectedView(source.feedId)`
2. `await loadSnapshot({ view: source.feedId })`
3. `setSelectedArticle(source.articleId)`

这条链路本身已经满足“先切上下文、再载入快照、最后选中文章”的顺序，本次只需要让 URL 同步按不同动作采用不同 history 模式。

## 设计方案

### 1. 将来源模块移动到正文末尾

保留现有来源模块的渲染条件、空态与点击交互，只调整其在 `ArticleView` 中的布局位置：

- `articleBodyMarkup` 对应的正文 HTML 容器继续作为主要阅读内容；
- `ai_digest` 来源模块移动到该正文容器之后；
- 这样在视觉和 DOM 顺序上，来源都位于正文的最后一个区块。

这样做能保持改动最小，不影响现有按钮样式、标题层级和测试选择器，同时满足“放到正文最底部”的要求。

### 2. 为 URL 同步增加 history 模式

把 URL 持久化从“总是 replace”改成“由调用方声明是 replace 还是 push”。

这里的 history 模式只服务于明确的用户导航动作：

- 左栏 smart views 点击；
- 左栏订阅源点击；
- 中栏文章点击；
- 右栏来源文章点击。

以下非用户导航路径不新增历史记录：

- 应用初始化按 URL 恢复状态；
- `loadSnapshot(...)` 自身带来的列表刷新；
- `getArticle(...)` 触发的详情补拉；
- `addFeed`、`addAiDigest`、删除 feed 等数据管理动作；
- 分类展开/收起（仅 UI 折叠，不属于导航）。

建议在 `src/store/appStore.ts` 内将 URL 同步接口扩展为类似下面的语义：

- `persistReaderSelectionToUrl(selectedView, selectedArticleId, mode)`
- `mode` 取值为 `replace` 或 `push`

规则如下：

- 左栏 smart views / 订阅源（包括 `rss` 与 `ai_digest` feed）切换：`replace`
- 中栏文章点击：`push`
- 右栏来源跳转到原文文章：最终落为 `push`

如果计算出的 URL 与当前 URL 完全一致，仍然直接返回，不重复写入 history。

### 3. 浏览器返回 / 前进时的状态恢复

仅把 `replaceState` 改成 `pushState` 还不够。为了让浏览器返回/前进真正恢复阅读状态，需要在现有 URL/状态同步层补齐 `popstate` 响应，但仍然不引入新路由系统。

恢复策略：

1. 监听浏览器 `popstate`；
2. 从当前 URL 重新读取 `view` 与 `article` 参数；
3. 先把 store 恢复到目标 `view`，并以非历史写入方式同步状态；
4. 执行 `loadSnapshot({ view })`，确保目标列表已加载；
5. 若 URL 中存在 `article`，再恢复目标文章选择；
6. 整个恢复过程不得再次 `push` 新 history，只能复用当前这次浏览器回退后的 URL。

这样浏览器返回时才能在不整页刷新的前提下恢复：

- 左栏高亮的目标 `view`；
- 中栏对应列表内容；
- 右栏目标文章。

这条恢复链路与来源跳转保持同样的顺序约束：先 `view`，再 `loadSnapshot`，最后 `article`。

### 4. 让 store action 与交互语义对齐

为了让 URL 行为稳定且容易测试，状态层按职责区分：

#### `setSelectedView(view)`

保持当前主要职责不变：

- 更新 `selectedView`
- 清空 `selectedArticleId`
- 切换文章列表缓存
- 根据视图重置 `showUnreadOnly`

新增约束：当它由左栏用户导航触发时，URL 同步固定使用 `replace`，因为它对应上下文切换，而不是一条需要回退的阅读记录。

#### `setSelectedArticle(id)`

保持当前选中文章与按需拉取详情的行为不变。

新增约束：当它由中栏文章点击或右栏来源点击触发时，URL 同步固定使用 `push`，因为它对应用户进入一篇具体文章的阅读动作。

#### 恢复路径的无历史写入分支

`popstate` 与初始化按 URL 恢复状态时，不能直接复用上述默认用户导航语义，否则会在恢复过程中再次写入 `replace/push`。因此需要在现有 store 同步层补一个“无 history 写入”的恢复分支：

- 只更新 store 与数据加载；
- 不调用 `pushState(...)`；
- 不调用 `replaceState(...)`；
- 仅消费浏览器当前已经切换完成的 URL。

这意味着文档中的 `replace/push` 规则只适用于显式用户导航，不适用于初始化恢复与 `popstate` 恢复。

### 5. 来源跳转的最终历史行为

来源跳转会先执行 `setSelectedView(source.feedId)`，这一步会把 URL 以 `replace` 切到目标 `view` 且清空 `article`。随后 `loadSnapshot` 完成，再执行 `setSelectedArticle(source.articleId)`，这一步会对最终 `view + article` URL 执行 `push`。

结果是：

- 左栏上下文切换本身不累计历史；
- 来源跳转最终会新增一条可回退的文章历史记录；
- 用户点击浏览器返回时，可以回到上一个 AI 解读文章状态。

虽然中间存在一次 `replace`，但最终不会破坏“来源文章进入阅读流后可返回”的目标，因为实际可回退节点由最后一次 `push` 创建。

## 数据流

术语说明：这里的“左栏导航”仅指 smart views 与订阅源按钮；订阅源包括 `rss` 与 `ai_digest` 两类 feed，不包含分类分组标题的展开/收起。分类标题点击只影响折叠状态，不涉及 URL 或 history。

### 左栏 smart views / 订阅源切换

1. 用户点击左栏项；
2. 调用 `setSelectedView(view)`；
3. `selectedArticleId` 被清空；
4. URL 使用 `replace` 更新到新的 `view` 状态；
5. 后续 snapshot 加载不再额外制造文章级历史记录。

### 中栏文章点击

1. 用户点击文章卡片 / 列表项；
2. 调用 `setSelectedArticle(articleId)`；
3. URL 使用 `push` 写入当前 `view + article`；
4. 如果文章详情不完整，沿用现有逻辑异步补拉详情。

### 右栏来源跳转

1. 用户点击来源项；
2. 调用 `setSelectedView(source.feedId)`，URL `replace` 到目标 `view`；
3. `loadSnapshot({ view: source.feedId })` 拉取目标列表；
4. 调用 `setSelectedArticle(source.articleId)`，URL `push` 到目标 `view + article`；
5. 浏览器返回时可回到之前的 AI 解读文章 URL。

## 边界条件

- 初始化 hydration、后台 snapshot 刷新、详情补拉等非用户导航路径不得新增 history；

- 若 `push` 或 `replace` 生成的 URL 与当前完全一致，不写 history，避免重复记录；
- `setSelectedView` 触发的清空文章选择不能额外再触发一次文章级 `push`；
- 来源跳转必须继续等待 `loadSnapshot` 完成后再选中目标文章，避免目标文章不在当前列表时出现短暂错态；
- 对于 `selectedArticleId` 对应文章内容缺失的情况，继续复用现有 `getArticle(...)` 补拉逻辑。

## 测试策略

遵循 TDD，先写失败测试，再做最小实现。

### `src/store/appStore.test.ts`

新增或调整以下断言：

- `setSelectedView('feed-x')` 写 URL 时调用 `window.history.replaceState(...)`；
- `setSelectedArticle('art-x')` 写 URL 时调用 `window.history.pushState(...)`；
- 当目标 URL 与当前相同时，不重复调用 history API；
- 视图切换导致的 `selectedArticleId = null` 不会额外触发文章级 `push`；
- 浏览器触发 `popstate` 后，会按 `view -> loadSnapshot -> article` 的顺序恢复状态；
- `popstate` 恢复过程不会再次调用 `pushState(...)` 或 `replaceState(...)`；
- 初始化按 URL 恢复状态时，也走无 history 写入分支，只更新 store 与数据加载。

### `src/features/articles/ArticleView.aiDigestSources.test.tsx`

新增或调整以下断言：

- `ai_digest` 文章仍然渲染来源模块，非 `ai_digest` 文章仍不渲染；
- 来源模块出现在 `data-testid="article-html-content"` 对应正文容器之后；
- 点击来源项仍然按顺序调用：
  - `setSelectedView(source.feedId)`
  - `loadSnapshot({ view: source.feedId })`
  - `setSelectedArticle(source.articleId)`

如果现有测试已覆盖交互链路，只需补位置相关断言。

## 风险与缓解

### 风险 1：普通文章阅读历史变多

这是有意行为，因为用户明确要求中栏文章点击使用 `push`。通过将左栏上下文切换保留为 `replace`，可以避免历史记录在 feed / 分类层面继续放大。

### 风险 2：来源跳转中的两段式 URL 更新造成体验混淆

由于最终文章选中会用 `push` 写入完整 URL，返回路径仍然符合目标。整个流程继续复用现有的“先切 view、再加载、再选文章”链路，不引入新的竞争条件。

### 风险 3：测试对 DOM 顺序过于脆弱

位置测试只验证“来源 section 位于正文 HTML 容器之后”，不绑定过多样式类名，避免对视觉微调过敏。

## 验收标准

- AI 解读文章的“来源”模块渲染在正文 HTML 后面；
- 左栏点击 smart views 或订阅源（包括 `rss` 与 `ai_digest` feed）时，URL 通过 `replace` 更新；
- 中栏点击文章时，URL 通过 `push` 更新；
- 应用初始化按 URL 恢复状态时，会走无 history 写入分支，只通过 store 更新与数据加载恢复当前 `view/article`；
- 从 AI 解读文章点击来源项进入原文后，触发浏览器返回时会按 `view -> loadSnapshot -> article` 顺序恢复之前的 AI 解读状态；
- 上述初始化恢复与浏览器返回恢复过程都不会新增 `pushState(...)` 或 `replaceState(...)` 历史记录；
- 所有新增或更新的测试通过。
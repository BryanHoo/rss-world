# 订阅分类内联管理实现总结

## 症状

- 分类管理仍依赖独立入口和面板，新增或编辑订阅时不能顺手创建分类，也不能在左栏分类上下文里直接完成重命名、排序和删除。
- feed 的创建、更新、删除与分类生命周期分散在多处逻辑里，容易出现空分类残留、同名分类重复创建和前后端状态不同步。
- 分类相关改动会同时影响 `FeedDialog`、`FeedList`、API 路由和 store，如果缺少统一事实源，前端列表很容易出现短暂不一致。

## 根因

- 服务端此前只接收 `categoryId`，没有一个事务边界统一处理 `categoryName` 归并、新建分类、绑定 feed 与空分类清理。
- 前端把分类管理拆到独立容器里，主流程中的弹窗和左栏交互都缺少与分类生命周期一致的 API 契约。
- store 对 `updateFeed` / `removeFeed` 的乐观更新不足以覆盖分类集合变化，分类列表和 feed 分组需要回到快照作为最终事实来源。

## 修复

- 服务端新增 `feedCategoryLifecycleService`，把 `trim + lower` 归并、分类复用或创建、feed 变更和空分类清理收进同一事务。
- `/api/feeds` 的 `POST`、`PATCH`、`DELETE` 改为走生命周期服务，并支持 `categoryId` / `categoryName` 互斥输入契约。
- `apiClient` 与 `appStore` 更新为支持 `categoryName`，并在可能影响分类集合的 feed 更新、删除后重新加载 snapshot。
- `FeedDialog` 的分类字段改为 feature-local 的输入型下拉：
  - 已有分类名提交 `categoryId`
  - 新分类名提交 `categoryName`
  - 空值或 `未分类` 提交 `categoryId: null`
- `FeedList` 移除独立“管理分类”入口，改为在左栏分类右键菜单内提供 `编辑 / 上移 / 下移 / 删除`。
- 新增 `RenameCategoryDialog` 处理分类重命名冲突提示；删除分类时保持 feed 回落到 `未分类` 的语义。
- 回归修正：
  - `AddFeedDialog.test.tsx` 在点击提交前先等待“添加”按钮变为可用，避免表单状态更新尚未完成时出现偶发失败。
  - `FeedList.tsx` 清理未使用的 `FolderTree` import，保持 lint 干净。
- Files:
  - `src/server/services/feedCategoryLifecycleService.ts`
  - `src/server/services/feedCategoryLifecycleService.test.ts`
  - `src/server/repositories/categoriesRepo.ts`
  - `src/server/repositories/categoriesRepo.test.ts`
  - `src/server/repositories/feedsRepo.ts`
  - `src/app/api/feeds/route.ts`
  - `src/app/api/feeds/[id]/route.ts`
  - `src/app/api/feeds/routes.test.ts`
  - `src/lib/apiClient.ts`
  - `src/store/appStore.ts`
  - `src/store/appStore.test.ts`
  - `src/features/feeds/CreatableCategoryField.tsx`
  - `src/features/feeds/FeedDialog.tsx`
  - `src/features/feeds/AddFeedDialog.test.tsx`
  - `src/features/feeds/FeedDialog.translationFlags.test.tsx`
  - `src/features/feeds/RenameCategoryDialog.tsx`
  - `src/features/feeds/FeedList.tsx`
  - `src/features/feeds/FeedList.test.tsx`
  - `docs/plans/2026-03-06-feed-category-inline-management-implementation-plan.md`

## 验证命令与结果

- `pnpm run test:unit -- src/server/services/feedCategoryLifecycleService.test.ts src/app/api/feeds/routes.test.ts src/store/appStore.test.ts src/features/feeds/AddFeedDialog.test.tsx src/features/feeds/FeedDialog.translationFlags.test.tsx src/features/feeds/FeedList.test.tsx`
  - 结果：通过，`Test Files 98 passed | 1 skipped (99)`，`Tests 352 passed | 4 skipped (356)`
- `pnpm run lint`
  - 结果：通过（exit code 0）
- `pnpm run test:unit`
  - 结果：通过，`Test Files 98 passed | 1 skipped (99)`，`Tests 352 passed | 4 skipped (356)`

## 相关提交

- 计划文档：`docs/plans/2026-03-06-feed-category-inline-management-implementation-plan.md`
- `92c4786 feat(server): 新增订阅分类生命周期服务`
- `f181208 refactor(api): 接入订阅分类解析服务`
- `c787c15 refactor(store): 同步订阅分类新契约与快照刷新`
- `20f9c56 feat(feeds): 支持输入型订阅分类选择`
- `15905dd refactor(feeds): 改为左栏分类右键管理`

## 后续建议

- 若后续继续扩展分类别名或批量操作，优先在 `feedCategoryLifecycleService` 扩展事务边界，不要把分类解析逻辑重新散回路由或 store。
- `FeedList.test.tsx` 目前已经补齐关键 fetch mock；后续新增侧栏交互时应优先复用现有 snapshot mock，避免再出现回归时状态源不一致。

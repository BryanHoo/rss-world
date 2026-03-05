# 分类设置表格排序改造总结

## 背景

原分类设置面板是列表式编辑，缺少明确的排序管理能力。此次改造目标是将分类管理升级为表格化交互，并提供拖拽排序与后端持久化，确保分类顺序在以下场景保持一致：

- 设置中心分类管理
- 阅读器左侧 `FeedList` 分组顺序
- `AddFeedDialog` 分类下拉顺序

## 关键改动

### 1. Repository：新增分类批量重排能力

- 文件：`src/server/repositories/categoriesRepo.ts`
- 新增 `reorderCategories(pool, items)`，使用事务执行：
  - `begin`
  - 校验所有分类 ID 存在
  - 批量更新 `position`
  - 查询并返回按 `position asc, name asc` 排序后的分类
  - `commit`，异常时 `rollback`

### 2. API：新增批量重排路由

- 文件：`src/app/api/categories/reorder/route.ts`
- 新增 `PATCH /api/categories/reorder`：
  - 校验 `items` 数组结构（`id` + `position`）
  - 校验 `id` / `position` 无重复
  - 校验 `position` 从 `0` 开始连续
  - 调用 `reorderCategories` 持久化

### 3. 客户端 API：新增 `reorderCategories`

- 文件：`src/lib/apiClient.ts`
- 新增 `reorderCategories(items)`，请求 `/api/categories/reorder`。

### 4. 分类面板 UI：表格化 + 拖拽排序

- 新增文件：`src/components/ui/table.tsx`
- 改造文件：`src/features/settings/panels/CategoriesSettingsPanel.tsx`
- 面板由列表改为 `shadcn/ui` 风格表格：
  - 列头：排序 / 分类名称 / 订阅源数量 / 操作
  - 拖拽手柄触发重排，请求后端批量持久化
  - 保留创建、重命名、删除的原有行为

### 5. 顺序一致性修复

- 文件：`src/features/feeds/FeedDialog.tsx`
- 分类下拉改为按 store 原始顺序渲染（含“未分类”），避免“未分类固定置底”导致的顺序漂移。
- 回归测试覆盖：
  - `FeedList` 分组顺序遵循 store
  - `AddFeedDialog` 分类选项遵循 store

## 验证清单

- [x] categories panel supports create/rename/delete/reorder
- [x] reorder persists after reload（通过 API + 仓储测试链路验证）
- [x] FeedList order matches category positions
- [x] AddFeedDialog order matches category positions
- [x] unit tests green
- [x] lint green

## 验证命令与结果

1. Scoped tests

```bash
pnpm run test:unit -- src/features/settings/panels/CategoriesSettingsPanel.test.tsx src/app/api/categories/routes.test.ts src/features/feeds/FeedList.test.tsx src/features/feeds/AddFeedDialog.test.tsx src/server/repositories/categoriesRepo.test.ts
```

结果：通过（`Test Files 98 passed | 1 skipped`，`Tests 340 passed | 4 skipped`）。

2. Lint

```bash
pnpm run lint
```

结果：通过。

3. Full unit tests

```bash
pnpm run test:unit
```

结果：通过（`Test Files 98 passed | 1 skipped`，`Tests 340 passed | 4 skipped`）。

## 风险与后续建议

- 当前拖拽实现基于原生 DnD 事件，移动端体验仍可继续优化（如触摸手势排序）。
- 当前前端重排失败时执行本地回滚，必要时可补充“失败后强制刷新分类快照”兜底策略。
- 可在后续加入针对 `PATCH /api/categories/reorder` 的错误码细化与用户提示差异化。

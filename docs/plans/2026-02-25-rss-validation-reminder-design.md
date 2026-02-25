# RSS 源验证提醒去重（AddFeedDialog）设计

日期：2026-02-25

## 背景

当前新增订阅源流程在前端 `AddFeedDialog` 中强制要求先验证 URL，再允许提交：

- URL 输入框 `onBlur` 触发 `validateRssUrl(url)`
- `canSave` 仅在 `validationState === 'verified' && lastVerifiedUrl === trimmedUrl` 时为 `true`

同时，界面上关于“需要验证 / 自动验证”的说明存在多处重复，造成信息冗余。

## 问题

同一信息在多个位置被重复强调（弹窗描述 + 区块说明 + URL 下方提示），影响信息密度与阅读体验。

## 目标

- 保持现有“保存前必须验证成功”的约束与交互（仍使用 `onBlur` 自动校验）。
- 收敛提醒文案：仅保留一处“自动验证”提示，其余通过状态 `Badge` + URL 下方状态行表达当前状态/结果。

## 非目标

- 不改动验证触发机制（不引入 debounce/按钮手动验证等）。
- 不改动 `validateRssUrl`、`/api/rss/validate`、`POST /api/feeds` 等后端逻辑。
- 不新增全局提示或额外的提醒机制。

## 方案（选定：最小改动）

在 `AddFeedDialog` 做纯文案与信息层级调整：

1) 将 `DialogDescription` 改为不提“验证后才能创建”，只描述填写内容与选择分类。
2) 删除“新订阅源”区块内的二级说明文案（当前用于重复强调验证）。
3) 保留 URL 下方 `role="status"` 的默认提示文案：`URL 输入框失焦后会自动校验。`

## 验收标准

- 打开新增源弹窗时，不再出现多处重复的“验证提醒”文案。
- 仍然必须验证成功后才能点击“添加”提交。
- 单测通过：`pnpm run test:unit`。

## 影响范围

- 修改：`src/features/feeds/AddFeedDialog.tsx`
- 预期不改：`src/features/feeds/AddFeedDialog.test.tsx`（不依赖相关文案）


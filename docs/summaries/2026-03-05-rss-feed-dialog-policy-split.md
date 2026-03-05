# RSS 源弹窗拆分与策略配置总结

## 症状

- 新增/编辑 RSS 源主弹窗承载了基础信息与多个 AI/翻译触发策略，表单复杂且操作负担高。
- 触发策略与订阅基础字段耦合在同一保存动作里，难以进行按需配置。
- 历史字段 `bodyTranslateEnabled` 与新字段 `bodyTranslateOnOpenEnabled` 并存，存在旧字段回写风险。

## 根因

- `FeedDialog` 既负责 feed 基础信息，又承担策略配置，职责过多。
- `FeedList` 右键菜单缺少独立策略入口，用户必须进入编辑弹窗才能配置策略。
- 前端 patch 类型与请求构造允许旧字段进入更新 payload，缺乏显式防护。

## 修复

- 主弹窗职责收敛：`FeedDialog` 仅保留 `URL / 名称 / 分类` 与 RSS URL 验证链路。
- 新增独立策略弹窗：
  - `FeedSummaryPolicyDialog`：配置 `aiSummaryOnFetchEnabled` / `aiSummaryOnOpenEnabled`
  - `FeedTranslationPolicyDialog`：配置 `titleTranslateEnabled` / `bodyTranslateOnFetchEnabled` / `bodyTranslateOnOpenEnabled`
- `FeedList` 右键菜单新增 `AI摘要配置` 与 `翻译配置` 入口，保存时仅 patch 对应策略字段。
- 迁移兼容：翻译策略弹窗初始化时将历史 `bodyTranslateEnabled` 映射到 `bodyTranslateOnOpenEnabled`，但提交时不回写旧字段。
- 回写防护：`apiClient.patchFeed` 对请求体做键级过滤，显式丢弃 `bodyTranslateEnabled`，并过滤 `undefined` 字段。

## 验证命令与结果

- `pnpm run test:unit -- src/features/feeds/AddFeedDialog.test.tsx src/features/feeds/FeedList.test.tsx src/features/feeds/FeedPolicyDialogs.test.tsx src/features/feeds/FeedDialog.translationFlags.test.tsx src/store/appStore.test.ts`
  - 结果：`Test Files 96 passed | 1 skipped (97)`，`Tests 331 passed | 4 skipped (335)`
- `pnpm run lint`
  - 结果：通过（0 error）

## 后续建议

- 可在 `FeedList.test.tsx` 中补齐 `ai-translate` 请求 mock，消除测试过程中的预期外 stderr 噪声。
- 后端若已完全弃用 `bodyTranslateEnabled`，可规划数据库/DTO 层的下一步移除窗口，彻底收敛字段模型。

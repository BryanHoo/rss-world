# 新增 RSS 源：URL 优先 + 校验后自动填充名称（仅填空）设计

日期：2026-02-28

## 背景

当前新增订阅源流程在前端 `AddFeedDialog` 中要求先对 URL 完成校验，才允许提交创建：

- URL 输入框 `onBlur` 触发 `validateRssUrl(url)`
- 仅在 `validationState === 'verified' && lastVerifiedUrl === trimmedUrl` 时允许点击“添加”

同时，新增源表单目前默认聚焦在“名称”，字段顺序为“名称 → URL”。本次需求希望改为“先填 URL → 自动校验并尽可能获取名称 → 再补充其他字段”，并删除 URL 下方默认提示文案 `URL 输入框失焦后会自动校验。`

## 目标

- 新增源表单字段顺序调整为：`URL` 在前、`名称` 在后，并在弹窗打开时自动聚焦 `URL`。
- 保持现有校验触发机制：仍然使用 URL 输入框 `onBlur` 自动触发验证（不新增“验证按钮”）。
- 当 URL 校验成功并返回 `title` 时，若“名称”为空则自动填充名称；若名称非空则不覆盖用户输入。
- 删除 URL 下方默认提示文案：不再显示 `URL 输入框失焦后会自动校验。`
- 更新单测，覆盖“自动填充仅填空、不覆盖手填名称”的行为。

## 非目标

- 不修改“编辑 RSS 源”对 URL 的处理（编辑弹窗 URL 仍为只读）。
- 不改动后端 API 结构与行为（仍使用 `GET /api/rss/validate?url=...` 返回的 `title` 字段）。
- 不引入 debounce、定时轮询、或“点击添加时自动先验证”的替代流程。
- 不将校验逻辑抽离为通用 hook/组件（保持最小改动方案）。

## 方案（选定：最小改动）

### 1) UI 与交互（`AddFeedDialog`）

调整表单展示与焦点策略：

- 字段顺序：`URL` → `名称` → `分类` →（全文/AI 摘要开关保持原位）
- 弹窗打开时：自动聚焦 `URL` 输入框（将 `onOpenAutoFocus` 的焦点从名称切到 URL）
- 删除 URL 下方默认提示文案：当 `validationMessage` 为空时不再显示 `URL 输入框失焦后会自动校验。`
  - 仍保留状态行（`role="status"`）用于展示“验证中/成功/失败”的动态信息
  - `idle` 状态下状态行可为空；当前状态由 Badge（待验证/验证中/验证成功/验证失败）承担

### 2) 数据流与状态机（校验 + 自动填充名称）

URL 校验与门禁规则保持不变，仅在“校验成功”分支追加“自动填充名称（仅填空）”：

- URL `onChange`：
  - 递增 `validationRequestIdRef`（用于丢弃过期请求的返回）
  - 更新 `url`
  - `resetValidationState()`（回到待验证状态）
- URL `onBlur`：
  - `trim()` 后调用 `handleValidate(blurValue)`
  - 已验证且 `lastVerifiedUrl === blurValue` 时跳过重复校验
- `handleValidate` 成功返回（`result.ok === true`）：
  - 若 `result.title` 有值，且当前名称为空（`title.trim()` 为空），则自动填充名称
  - 为避免异步返回覆盖用户刚输入的名称，使用函数式更新：
    - `setTitle((prev) => (prev.trim() ? prev : (result.title ?? prev)))`
- 提交门禁保持：`canSave` 仍要求 `validationState === 'verified' && lastVerifiedUrl === trimmedUrl` 且 `trimmedTitle/trimmedUrl` 非空

### 3) 边界情况

- 校验失败：不自动填充名称，状态行展示失败信息（沿用 `result.message ?? '链接验证失败。'`）。
- 校验成功但 `title` 为空：不自动填充名称，用户手动填写。
- 用户先手填名称再填 URL：允许；校验成功不会覆盖名称。
- 校验成功后修改 URL：现有逻辑会 reset 校验状态并禁用“添加”，直至再次校验成功。

## 测试计划

更新单测 `AddFeedDialog.test.tsx`：

- 用例 1：名称为空时，先填 URL → blur → 校验成功后应自动填充名称
- 用例 2：名称非空时，先手填名称 → 再填 URL → blur → 校验成功后名称不应被覆盖

同时调整 `validateRssUrl` mock：成功分支返回包含 `title` 的结果，以覆盖自动填充逻辑。

## 验收标准

- 打开新增源弹窗时，输入焦点落在 URL 输入框，且字段顺序为 URL 优先。
- URL 校验机制仍为 `onBlur` 自动触发，且仍需校验成功后才能“添加”。
- 校验成功且名称为空时自动填充名称；名称非空时不覆盖。
- 不再出现文案 `URL 输入框失焦后会自动校验。`
- `pnpm run test:unit` 通过（覆盖新增/调整的测试用例）。

## 影响范围

- 修改：`src/features/feeds/AddFeedDialog.tsx`
- 修改：`src/features/feeds/AddFeedDialog.test.tsx`
- 预期不改：`src/features/feeds/EditFeedDialog.tsx`、`src/app/api/rss/validate/route.ts`


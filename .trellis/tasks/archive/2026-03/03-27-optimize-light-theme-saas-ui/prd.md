# 优化 light 主题以贴近 saas ui

## Goal

在不改变现有页面整体布局结构的前提下，参考 `docs/saas ui.md` 的 light 主题设计语言，优化 FeedFuse 当前 light 主题的视觉表现与交互反馈，让界面在色彩层次、表面质感、按钮/输入/弹层等共享组件体验上更接近「极简但有张力」的 SaaS 风格。

## What I already know

* 用户明确要求：只优化 light 主题，不改变整体布局设计。
* `docs/saas ui.md` 给出的核心方向是：更暖的浅色背景、深 slate 前景色、显著但克制的 Electric Blue 渐变点缀、更有层次的 surface、强调 hover/focus/active 的交互反馈。
* 当前 light 主题 token 主要定义在 `src/app/globals.css`，多数页面和共享组件都依赖语义 token，例如 `background`、`primary`、`muted`、`border`、`popover`、`ring`。
* 当前共享组件实现已经集中在 `src/components/ui/`，`button.tsx`、`input.tsx`、`badge.tsx`、`dialog.tsx`、`popover.tsx`、`tooltip.tsx`、`select.tsx`、`sheet.tsx`、`context-menu.tsx` 会显著影响 light 主题的一致性。
* 现有 light 主题整体偏中性，primary/secondary/accent 与阴影层次还没有形成 `docs/saas ui.md` 中那种更明确的品牌感和表面深度。

## Assumptions (temporary)

* 本次优先通过全局 token 和共享组件样式提升 light 主题，不大范围改动业务页面结构。
* dark 主题行为和布局结构应保持不变，避免引入视觉回归。
* 如有必要，可以对高频 surface 做少量 light-only 视觉增强，但不重排页面布局、不重写信息架构。

## Open Questions

* light 主题的视觉力度希望控制在什么级别？

## Requirements (evolving)

* 保持现有页面布局和信息结构不变。
* light 主题视觉风格向 `docs/saas ui.md` 靠拢。
* 优化颜色层次、边框、阴影、弹层、按钮、输入框、标签和交互状态。
* 保持语义 token 驱动，避免散落的一次性样式。
* 除全局 token 和共享 UI 组件外，包含少量高频业务 surface 的 light-only 视觉增强。

## Acceptance Criteria (evolving)

* [ ] light 主题的全局 token 更贴近 `docs/saas ui.md` 的背景、前景、accent、surface 层次。
* [ ] 共享 UI 组件在 light 主题下拥有更明确的 hover、focus、active 反馈。
* [ ] 设置抽屉、阅读页状态卡片等高频业务 surface 得到 light-only 视觉增强，但不改变布局。
* [ ] 页面整体布局、分区和主要结构不发生变化。
* [ ] dark 主题与现有功能行为不被破坏。
* [ ] 相关测试、lint 和 typecheck 通过。

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 重做页面布局、导航结构或信息架构
* 引入新的大型设计系统或替换现有组件库
* 对 dark 主题做风格重设计

## Technical Notes

* 已检查文件：
  * `docs/saas ui.md`
  * `src/app/globals.css`
  * `src/components/ui/button.tsx`
  * `src/components/ui/input.tsx`
  * `src/components/ui/badge.tsx`
  * `src/components/ui/dialog.tsx`
  * `src/components/ui/popover.tsx`
  * `src/components/ui/tooltip.tsx`
  * `src/features/toast/ToastHost.tsx`
* 主题 token 使用契约存在于 `src/app/theme-token-usage.contract.test.ts`，需要在修改后保持契约稳定。
* 现有弹层类组件已经统一使用 `shadow-popover` 与语义色 token，适合通过 token 与少量共享组件样式统一提升 light 主题质感。
* 已确认可优先精修的高频业务 surface：
  * `src/features/settings/SettingsCenterDrawer.tsx`
  * `src/features/articles/ArticleView.tsx`

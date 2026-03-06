# 右键菜单主题同步轻量卡片化总结

**Date:** 2026-03-06
**Status:** resolved
**Area:** `feeds` / `ui`
**Related:** `docs/plans/2026-03-06-context-menu-theme-card-design.md`, `docs/plans/2026-03-06-context-menu-theme-card-implementation-plan.md`

## Symptom

- RSS 源右键菜单和分类右键菜单仍带有明显的深色玻璃浮层观感。
- 在浅色主题下，菜单颜色和页面整体卡片式阅读器布局不一致。
- RSS 源菜单宽度过宽，展开后更像功能面板而不是上下文卡片。

## Impact

- 右键菜单的视觉层级与侧栏、列表、按钮不统一，显得突兀。
- 菜单过宽导致信息密度偏低，观感不够精致。
- 分类菜单与 RSS 源菜单缺少统一的共享视觉语言。

## Root Cause

- 共享 `src/components/ui/context-menu.tsx` 仍固定为深色玻璃风格，没有使用项目现有的 theme token。
- `src/features/feeds/FeedList.tsx` 里 RSS 源菜单显式使用 `w-64`，进一步放大了“面板感”。
- 分类菜单虽然复用了共享组件，但仍停留在旧样式和纯文字结构，无法和 RSS 菜单形成同一套风格。

## Fix

- 将共享 `ContextMenu` 样式改为跟随主题切换的轻量卡片风格，改用 `bg-popover`、`text-popover-foreground`、`border-border` 等 token。
- 收紧共享菜单默认最小宽度、圆角、内边距、阴影和 hover/focus 反馈，弱化厚重玻璃感。
- 将分类右键菜单也补上结构化 icon/label 组合，并收敛到更紧凑的宽度。
- 将 RSS 源主菜单从 `w-64` 收敛为更窄宽度，分类子菜单同步收窄。
- 将 `当前` 和状态 hint 改为更适合浅/深主题的低对比卡片标签。
- Files:
  - `src/components/ui/context-menu.tsx`
  - `src/features/feeds/FeedList.tsx`
  - `src/features/feeds/FeedList.test.tsx`
  - `docs/plans/2026-03-06-context-menu-theme-card-design.md`
  - `docs/plans/2026-03-06-context-menu-theme-card-implementation-plan.md`

## Verification (Evidence)

- Run: `pnpm exec vitest run src/features/feeds/FeedList.test.tsx`
  - Result: PASS，`Test Files 1 passed`，`Tests 24 passed`
  - Note: 输出中仍有来自 `ArticleView` 的 `act(...)` warning，这次改动未引入新的测试失败。
- Run: `pnpm run lint`
  - Result: PASS（exit code 0）

## Prevention / Follow-ups

- 后续新增上下文菜单时，优先扩展 `src/components/ui/context-menu.tsx`，不要在业务层重新拼一套深色浮层样式。
- 如果未来要做浏览器级视觉验收，可继续沿用当前 `FeedList.test.tsx` 的交互回归，并补一个稳定的主题切换 UI 冒烟检查。
- 如需继续收紧视觉，可优先从 hint 文案长度和菜单项分组节奏入手，而不是重新放大宽度。

## Notes

- 本次实现与验证在 `.worktrees/context-menu-theme-card` 中完成，避免直接在 `main` 工作区改动。
- 按当前会话约束，没有执行 `git commit`。

# OPML 导出排除 AI 解读源 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superwork-subagent-driven-development (recommended) or superwork-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正 OPML 导出结果，仅导出 RSS 订阅，不导出 `feeds.kind='ai_digest'` 的 AI 解读源。

**Architecture:** 保持现有 `/api/opml/export -> exportOpml -> buildOpmlDocument` 链路不变，在 `exportOpml` 服务层收紧输入边界，只把 `kind === 'rss'` 的 feed 交给 OPML 构建器。用服务层回归测试锁住该规则，避免未来再次把应用内生成源混入订阅备份。

**Tech Stack:** Next.js Route Handlers, TypeScript, Vitest, pg repository mocks

---

### Task 1: 为 OPML 导出补回归测试

**Files:**
- Modify: `src/server/services/opmlService.test.ts`
- Test: `src/server/services/opmlService.test.ts`

- [ ] **Step 1: 写失败测试**

  添加一个 `listFeedsMock` 同时返回 `rss` 与 `ai_digest` feed 的用例，断言导出的 XML 只包含 RSS 订阅，不包含 AI 解读源标题或 URL。

- [ ] **Step 2: 运行测试并确认失败**

  Run: `pnpm test:unit src/server/services/opmlService.test.ts`
  Expected: FAIL，失败原因是当前导出仍包含 `ai_digest` feed。

### Task 2: 在服务层过滤 `ai_digest`

**Files:**
- Modify: `src/server/services/opmlService.ts`
- Test: `src/server/services/opmlService.test.ts`

- [ ] **Step 1: 写最小实现**

  在 `exportOpml` 中增加短注释并过滤 `feeds`，仅把 `kind === 'rss'` 的 feed 传给 `buildOpmlDocument`。

- [ ] **Step 2: 运行测试并确认通过**

  Run: `pnpm test:unit src/server/services/opmlService.test.ts`
  Expected: PASS，且原有导出用例保持通过。

### Task 3: 做项目级验证

**Files:**
- Modify: `docs/superwork/plans/2026-03-20-opml-export-exclude-ai-digest.md`

- [ ] **Step 1: 运行构建验证**

  Run: `pnpm build`
  Expected: BUILD SUCCESS，没有 TypeScript、Route Handler 或 OPML 相关回归错误。

- [ ] **Step 2: 整理结果**

  记录验证结果，并在回复中明确说明这次改动只影响导出，不影响文章详情中的 `aiDigestSources` 展示。

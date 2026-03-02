# AI 文章翻译（zh-CN）Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use workflow-executing-plans to implement this plan task-by-task.

**Goal:** 在文章阅读页实现正文 AI 翻译为中文（`zh-CN`），支持“原文/译文”一键切换，并将译文 HTML 持久化缓存。

**Architecture:** 新增 `POST /api/articles/:id/ai-translate` 入队 `ai.translate_article_zh`。`src/worker/index.ts` 消费队列并调用 `${apiBaseUrl}/chat/completions` 生成中文 HTML；对输出二次 `sanitizeContent` 后写入 `articles.ai_translation_zh_html`。前端通过轮询 `refreshArticle()` 获取译文落库结果并切换视图。

**Tech Stack:** Next.js Route Handlers, `pg`/SQL migrations, `pg-boss` worker, `sanitize-html`, `zod`, `vitest`, `zustand`.

---

## 范围与约束

- 目标语言固定 `zh-CN`
- 只翻译正文；标题始终显示原文
- 保留原始 HTML 结构（段落、列表、链接、图片等），输出仍以 HTML 渲染
- 若 feed 开启 `fullTextOnOpenEnabled` 且全文仍 pending，翻译必须等待全文完成（或失败）后再执行
- 不接入 `persistedSettings.ai.translateEnabled` 开关：文章页按钮始终显示可用

## 交付物

- 设计：`design.md`
- 任务拆解（可执行、TDD、频繁提交）：`tasks.md`
- Delta spec（至少 1 个场景）：`specs/article-ai-translation/spec.md`


## Tasks

> Implementation must follow @workflow-test-driven-development and final validation must follow @workflow-verification-before-completion.

### Task 1: Add DB schema for feed toggles, title translation, bilingual body, and translation API key

- [ ] Write failing migration tests for new columns
  - Files: `src/server/db/migrations/feedTitleBodyTranslateMigration.test.ts`, `src/server/db/migrations/articleBilingualTranslationMigration.test.ts`, `src/server/db/migrations/appSettingsTranslationApiKeyMigration.test.ts`
  - Snippet:
```ts
const sql = readFileSync(migrationPath, 'utf8');
expect(sql).toContain('title_translate_enabled');
expect(sql).toContain('body_translate_enabled');
expect(sql).toContain('ai_translation_bilingual_html');
expect(sql).toContain('translation_api_key');
```

- [ ] Run the new migration tests and confirm they fail first
  - Run: `pnpm vitest run src/server/db/migrations/feedTitleBodyTranslateMigration.test.ts src/server/db/migrations/articleBilingualTranslationMigration.test.ts src/server/db/migrations/appSettingsTranslationApiKeyMigration.test.ts`
  - Expected: FAIL with missing migration files or missing SQL fragments

- [ ] Add SQL migration files for new columns
  - Files: `src/server/db/migrations/0010_feed_translation_toggles.sql`, `src/server/db/migrations/0011_article_bilingual_translation.sql`, `src/server/db/migrations/0012_app_settings_translation_api_key.sql`
  - Snippet:
```sql
alter table feeds
  add column if not exists title_translate_enabled boolean not null default false,
  add column if not exists body_translate_enabled boolean not null default false;
```

- [ ] Run migration tests to verify they pass
  - Run: `pnpm vitest run src/server/db/migrations/feedTitleBodyTranslateMigration.test.ts src/server/db/migrations/articleBilingualTranslationMigration.test.ts src/server/db/migrations/appSettingsTranslationApiKeyMigration.test.ts`
  - Expected: PASS

- [ ] Commit migration changes
  - Run: `git add src/server/db/migrations src/server/db/migrations/*.test.ts && git commit -m "feat(db): 新增翻译开关与双语翻译字段"`

### Task 2: Extend feed repositories and feed APIs for title/body translation toggles

- [ ] Write failing repository tests for `titleTranslateEnabled/bodyTranslateEnabled`
  - Files: `src/server/repositories/feedsRepo.translationFlags.test.ts`
  - Snippet:
```ts
expect(sql).toContain('title_translate_enabled as "titleTranslateEnabled"');
expect(sql).toContain('body_translate_enabled as "bodyTranslateEnabled"');
```

- [ ] Run repository test and confirm failure
  - Run: `pnpm vitest run src/server/repositories/feedsRepo.translationFlags.test.ts`
  - Expected: FAIL because fields are not selected/updated

- [ ] Implement feed repo read/write support for translation flags
  - Files: `src/server/repositories/feedsRepo.ts`
  - Snippet:
```ts
if (typeof input.titleTranslateEnabled !== 'undefined') {
  fields.push(`title_translate_enabled = $${paramIndex++}`);
  values.push(Boolean(input.titleTranslateEnabled));
}
```

- [ ] Add API schema and DTO support for new feed flags
  - Files: `src/app/api/feeds/route.ts`, `src/app/api/feeds/[id]/route.ts`, `src/lib/apiClient.ts`, `src/server/services/readerSnapshotService.ts`, `src/types/index.ts`
  - Snippet:
```ts
titleTranslateEnabled: z.boolean().optional(),
bodyTranslateEnabled: z.boolean().optional(),
```

- [ ] Run feed API and repository tests
  - Run: `pnpm vitest run src/server/repositories/feedsRepo.translationFlags.test.ts src/app/api/feeds/routes.test.ts src/app/api/reader/snapshot/route.test.ts`
  - Expected: PASS

- [ ] Commit feed flag changes
  - Run: `git add src/server/repositories/feedsRepo.ts src/server/repositories/feedsRepo.translationFlags.test.ts src/app/api/feeds/route.ts src/app/api/feeds/[id]/route.ts src/lib/apiClient.ts src/server/services/readerSnapshotService.ts src/types/index.ts src/app/api/feeds/routes.test.ts src/app/api/reader/snapshot/route.test.ts && git commit -m "feat(feed): 支持标题与正文翻译开关"`

### Task 3: Add shared-or-dedicated translation configuration in settings and translation API key endpoint

- [ ] Write failing settings normalization and validation tests for `ai.translation`
  - Files: `src/features/settings/settingsSchema.test.ts`, `src/features/settings/validateSettingsDraft.test.ts`
  - Snippet:
```ts
expect(normalized.ai.translation.useSharedAi).toBe(true);
expect(result.errors['ai.translation.apiBaseUrl']).toBeTruthy();
```

- [ ] Run settings tests and confirm failure
  - Run: `pnpm vitest run src/features/settings/settingsSchema.test.ts src/features/settings/validateSettingsDraft.test.ts`
  - Expected: FAIL because translation settings do not exist

- [ ] Implement settings schema/state support for translation config
  - Files: `src/types/index.ts`, `src/features/settings/settingsSchema.ts`, `src/store/settingsStore.ts`, `src/features/settings/panels/AISettingsPanel.tsx`
  - Snippet:
```ts
translation: {
  useSharedAi: true,
  model: '',
  apiBaseUrl: '',
},
```

- [ ] Add backend support for dedicated translation API key
  - Files: `src/server/repositories/settingsRepo.ts`, `src/app/api/settings/translation/api-key/route.ts`, `src/lib/apiClient.ts`
  - Snippet:
```ts
select translation_api_key as "translationApiKey"
from app_settings
where id = 1
```

- [ ] Run settings and API tests
  - Run: `pnpm vitest run src/features/settings/settingsSchema.test.ts src/features/settings/validateSettingsDraft.test.ts src/app/api/settings/routes.test.ts src/lib/apiClient.test.ts`
  - Expected: PASS

- [ ] Commit settings translation config changes
  - Run: `git add src/types/index.ts src/features/settings/settingsSchema.ts src/features/settings/settingsSchema.test.ts src/features/settings/validateSettingsDraft.ts src/features/settings/validateSettingsDraft.test.ts src/store/settingsStore.ts src/features/settings/panels/AISettingsPanel.tsx src/server/repositories/settingsRepo.ts src/app/api/settings/translation/api-key/route.ts src/lib/apiClient.ts src/lib/apiClient.test.ts src/app/api/settings/routes.test.ts && git commit -m "feat(settings): 增加翻译独立配置与密钥接口"`

### Task 4: Implement translation config resolver and title auto-translation job

- [ ] Write failing unit tests for translation config resolver (shared vs dedicated)
  - Files: `src/server/ai/translationConfig.test.ts`
  - Snippet:
```ts
expect(resolveTranslationConfig(input).apiKey).toBe('dedicated-key');
```

- [ ] Run resolver tests and confirm failure
  - Run: `pnpm vitest run src/server/ai/translationConfig.test.ts`
  - Expected: FAIL because resolver is missing

- [ ] Implement translation config resolver
  - Files: `src/server/ai/translationConfig.ts`
  - Snippet:
```ts
if (settings.ai.translation.useSharedAi) {
  return { model: settings.ai.model, apiBaseUrl: settings.ai.apiBaseUrl, apiKey: aiApiKey };
}
```

- [ ] Add title translation job name and worker handling
  - Files: `src/server/queue/jobs.ts`, `src/server/queue/jobs.test.ts`, `src/worker/index.ts`, `src/server/ai/translateTitle.ts`
  - Snippet:
```ts
export const JOB_AI_TRANSLATE_TITLE = 'ai.translate_title_zh';
```

- [ ] Add title translation persistence helpers and retry state updates
  - Files: `src/server/repositories/articlesRepo.ts`, `src/server/repositories/articlesRepo.titleTranslation.test.ts`
  - Snippet:
```ts
update articles
set title_zh = $2, title_translation_model = $3, title_translated_at = now()
where id = $1
```

- [ ] Run worker + queue + repository tests
  - Run: `pnpm vitest run src/server/queue/jobs.test.ts src/server/repositories/articlesRepo.titleTranslation.test.ts src/server/ai/translationConfig.test.ts src/worker/*.test.ts`
  - Expected: PASS

- [ ] Commit title translation job changes
  - Run: `git add src/server/ai/translationConfig.ts src/server/ai/translationConfig.test.ts src/server/ai/translateTitle.ts src/server/queue/jobs.ts src/server/queue/jobs.test.ts src/server/repositories/articlesRepo.ts src/server/repositories/articlesRepo.titleTranslation.test.ts src/worker/index.ts src/worker/*.test.ts && git commit -m "feat(worker): 增加标题自动翻译任务与配置解析"`

### Task 5: Build DOM segment extractor and bilingual HTML reconstruction for body translation

- [ ] Write failing tests for segment extraction and code/pre exclusion
  - Files: `src/server/ai/bilingualHtmlTranslator.test.ts`
  - Snippet:
```ts
expect(segments.map((s) => s.text)).toContain('Normal paragraph');
expect(segments.map((s) => s.text)).not.toContain('const x = 1');
```

- [ ] Run translator tests and confirm failure
  - Run: `pnpm vitest run src/server/ai/bilingualHtmlTranslator.test.ts`
  - Expected: FAIL because extractor/reconstructor is missing

- [ ] Implement DOM segment extraction and batch translation pipeline
  - Files: `src/server/ai/bilingualHtmlTranslator.ts`
  - Snippet:
```ts
const translatableSelectors = ['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'td', 'th'];
```

- [ ] Implement bilingual block reconstruction with stable `data-segment-id`
  - Files: `src/server/ai/bilingualHtmlTranslator.ts`
  - Snippet:
```ts
wrapper.className = 'ff-bilingual-block';
originalEl.className = 'ff-original';
translationEl.className = 'ff-translation';
```

- [ ] Run translator tests to verify pass
  - Run: `pnpm vitest run src/server/ai/bilingualHtmlTranslator.test.ts src/server/ai/translateHtml.test.ts`
  - Expected: PASS

- [ ] Commit bilingual translator changes
  - Run: `git add src/server/ai/bilingualHtmlTranslator.ts src/server/ai/bilingualHtmlTranslator.test.ts src/server/ai/translateHtml.test.ts && git commit -m "feat(ai): 实现正文段落双语翻译管线"`

### Task 6: Integrate body translation API/worker with feed gating and new storage field

- [ ] Write failing API tests for `body_translate_disabled` and new bilingual completion condition
  - Files: `src/app/api/articles/routes.test.ts`
  - Snippet:
```ts
expect(json.data).toEqual({ enqueued: false, reason: 'body_translate_disabled' });
```

- [ ] Run article API tests and confirm failure
  - Run: `pnpm vitest run src/app/api/articles/routes.test.ts`
  - Expected: FAIL with missing reason branch

- [ ] Update `/api/articles/:id/ai-translate` guard logic
  - Files: `src/app/api/articles/[id]/ai-translate/route.ts`
  - Snippet:
```ts
if (feedBodyTranslateEnabled !== true) {
  return ok({ enqueued: false, reason: 'body_translate_disabled' });
}
```

- [ ] Update worker body translation branch to write bilingual HTML field
  - Files: `src/worker/index.ts`, `src/server/repositories/articlesRepo.ts`
  - Snippet:
```ts
await setArticleAiTranslationBilingual(pool, articleId, {
  aiTranslationBilingualHtml: bilingualHtml,
  aiTranslationModel: model,
});
```

- [ ] Run API and worker tests
  - Run: `pnpm vitest run src/app/api/articles/routes.test.ts src/features/articles/ArticleView.aiTranslate.test.ts src/worker/*.test.ts`
  - Expected: PASS

- [ ] Commit body translation integration changes
  - Run: `git add src/app/api/articles/[id]/ai-translate/route.ts src/app/api/articles/routes.test.ts src/worker/index.ts src/server/repositories/articlesRepo.ts src/features/articles/ArticleView.aiTranslate.test.ts src/worker/*.test.ts && git commit -m "feat(api): 接入正文双语翻译与开关校验"`

### Task 7: Wire frontend feed dialog and state with new translation toggles

- [ ] Write failing UI tests for feed dialog translation toggles
  - Files: `src/features/articles/ArticleList.test.tsx` or new `src/features/feeds/FeedDialog.translationFlags.test.tsx`
  - Snippet:
```ts
expect(screen.getByLabelText('列表标题自动翻译')).toBeInTheDocument();
expect(screen.getByLabelText('正文翻译')).toBeInTheDocument();
```

- [ ] Run feed dialog tests and confirm failure
  - Run: `pnpm vitest run src/features/feeds/FeedDialog.translationFlags.test.tsx`
  - Expected: FAIL because controls do not exist

- [ ] Implement feed dialog controls and payload fields
  - Files: `src/features/feeds/FeedDialog.tsx`, `src/store/appStore.ts`, `src/lib/apiClient.ts`, `src/types/index.ts`
  - Snippet:
```ts
titleTranslateEnabled: titleTranslateEnabledValue === 'enabled',
bodyTranslateEnabled: bodyTranslateEnabledValue === 'enabled',
```

- [ ] Run feed dialog and app store tests
  - Run: `pnpm vitest run src/features/feeds/FeedDialog.translationFlags.test.tsx src/store/appStore.test.ts`
  - Expected: PASS

- [ ] Commit feed dialog translation toggle changes
  - Run: `git add src/features/feeds/FeedDialog.tsx src/features/feeds/FeedDialog.translationFlags.test.tsx src/store/appStore.ts src/store/appStore.test.ts src/lib/apiClient.ts src/types/index.ts && git commit -m "feat(reader): 支持源级标题与正文翻译配置"`

### Task 8: Render immersive bilingual title/body in `ArticleView` while keeping `翻译/原文` copy

- [ ] Write failing `ArticleView` tests for bilingual rendering and disabled button behavior
  - Files: `src/features/articles/ArticleView.aiTranslate.test.tsx`
  - Snippet:
```ts
expect(screen.getByText('Original paragraph')).toBeInTheDocument();
expect(screen.getByText('翻译后的段落')).toBeInTheDocument();
expect(screen.getByRole('button', { name: '翻译' })).toBeDisabled();
```

- [ ] Run `ArticleView` tests and confirm failure
  - Run: `pnpm vitest run src/features/articles/ArticleView.aiTranslate.test.tsx src/features/articles/ArticleView.aiSummary.test.tsx`
  - Expected: FAIL because bilingual mode and disabled gating are not implemented

- [ ] Implement bilingual title/body rendering in translation mode
  - Files: `src/features/articles/ArticleView.tsx`, `src/lib/apiClient.ts`, `src/types/index.ts`
  - Snippet:
```tsx
<h1>
  <span>{article.titleOriginal}</span>
  <span>{article.titleZh}</span>
</h1>
```

- [ ] Run `ArticleView` tests to verify pass
  - Run: `pnpm vitest run src/features/articles/ArticleView.aiTranslate.test.tsx src/features/articles/ArticleView.aiSummary.test.tsx src/features/articles/ArticleView.titleLink.test.tsx`
  - Expected: PASS

- [ ] Commit bilingual rendering changes
  - Run: `git add src/features/articles/ArticleView.tsx src/features/articles/ArticleView.aiTranslate.test.tsx src/lib/apiClient.ts src/types/index.ts && git commit -m "feat(reader): 实现沉浸式中英双语阅读视图"`

### Task 9: End-to-end verification, docs sync, and cleanup

- [ ] Run focused full test suite for changed domains
  - Run: `pnpm vitest run src/server/db/migrations src/server/repositories src/app/api src/features/articles src/features/feeds src/features/settings src/store`
  - Expected: PASS

- [ ] Run lint for changed files
  - Run: `pnpm lint`
  - Expected: PASS with no new errors

- [ ] Validate OpenSpec change structure and tasks parseability
  - Run: `openspec instructions apply --change rss-translation-bilingual-refactor --json`
  - Expected: JSON output containing parsed checkbox tasks

- [ ] Update implementation notes in this change set if any command diverges
  - Files: `openspec/changes/rss-translation-bilingual-refactor/design.md`, `openspec/changes/rss-translation-bilingual-refactor/tasks.md`

- [ ] Commit final verification/documentation updates
  - Run: `git add openspec/changes/rss-translation-bilingual-refactor && git commit -m "docs(openspec): 完成翻译重构实施任务编排"`


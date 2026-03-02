# article-ai-translation Specification

## Purpose
TBD - created by archiving change article-ai-translation. Update Purpose after archive.
## Requirements
### Requirement: Persisted zh-CN translation for article body
The system SHALL generate and persist a zh-CN translation for an article body as HTML in `articles.ai_translation_zh_html`.

#### Scenario: Persist translation and reuse it later
- **GIVEN** an article with body HTML available
- **WHEN** the user clicks the `翻译` action for that article
- **THEN** the system enqueues translation work and eventually stores `ai_translation_zh_html`
- **THEN** reopening the same article shows the persisted translation without re-translating

### Requirement: Original/translated toggle (body only)
The system SHALL allow users to toggle article body rendering between original HTML and translated HTML.

#### Scenario: Toggle between original and translation
- **GIVEN** an article already has `ai_translation_zh_html`
- **WHEN** the user clicks `翻译`
- **THEN** the UI renders `ai_translation_zh_html`
- **WHEN** the user clicks `原文`
- **THEN** the UI renders the original article body HTML
- **AND** the article title remains unchanged

### Requirement: Fulltext gating when enabled
When a feed has `fullTextOnOpenEnabled = true`, translation MUST wait until fulltext fetch completes (success or error) before translating.

#### Scenario: Fulltext pending blocks translation enqueue
- **GIVEN** a feed with `fullTextOnOpenEnabled = true`
- **AND** an article where `contentFullHtml` is empty and `contentFullError` is empty
- **WHEN** the user requests translation
- **THEN** the API returns `reason = 'fulltext_pending'`
- **AND** the UI indicates the article is waiting for fulltext

### Requirement: Missing API key handling
If the system has no AI API key configured, translation requests MUST NOT enqueue work and MUST return a user-actionable reason.

#### Scenario: Missing API key prevents enqueue
- **GIVEN** `app_settings.ai_api_key` is empty
- **WHEN** the user requests translation
- **THEN** the API returns `reason = 'missing_api_key'`


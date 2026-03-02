alter table articles
  add column if not exists ai_translation_zh_html text null;

alter table articles
  add column if not exists ai_translation_model text null;

alter table articles
  add column if not exists ai_translated_at timestamptz null;


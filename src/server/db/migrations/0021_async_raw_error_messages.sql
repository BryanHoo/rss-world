alter table article_tasks add column if not exists raw_error_message text null;
alter table article_ai_summary_sessions add column if not exists raw_error_message text null;
alter table article_translation_sessions add column if not exists raw_error_message text null;
alter table article_translation_segments add column if not exists raw_error_message text null;
alter table feeds add column if not exists last_fetch_raw_error text null;

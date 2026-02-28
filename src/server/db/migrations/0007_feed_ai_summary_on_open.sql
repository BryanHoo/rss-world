alter table feeds
  add column if not exists ai_summary_on_open_enabled boolean not null default false;


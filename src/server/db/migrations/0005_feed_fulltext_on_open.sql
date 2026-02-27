alter table feeds
  add column if not exists full_text_on_open_enabled boolean not null default false;

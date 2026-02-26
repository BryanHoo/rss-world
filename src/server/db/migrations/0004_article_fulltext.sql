alter table articles
  add column if not exists content_full_html text null;

alter table articles
  add column if not exists content_full_fetched_at timestamptz null;

alter table articles
  add column if not exists content_full_error text null;

alter table articles
  add column if not exists content_full_source_url text null;


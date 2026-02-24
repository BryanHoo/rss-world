create extension if not exists pgcrypto;

create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists categories_name_unique on categories (lower(name));

create table if not exists feeds (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  site_url text null,
  icon_url text null,
  enabled boolean not null default true,
  category_id uuid null references categories(id) on delete set null,
  fetch_interval_minutes int not null default 30,
  etag text null,
  last_modified text null,
  last_fetched_at timestamptz null,
  last_fetch_status int null,
  last_fetch_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists feeds_url_unique on feeds (url);
create index if not exists feeds_enabled_idx on feeds (enabled);
create index if not exists feeds_category_id_idx on feeds (category_id);

create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references feeds(id) on delete cascade,
  dedupe_key text not null,
  title text not null,
  link text null,
  author text null,
  published_at timestamptz null,
  content_html text null,
  summary text null,
  fetched_at timestamptz not null default now(),
  is_read boolean not null default false,
  read_at timestamptz null,
  is_starred boolean not null default false,
  starred_at timestamptz null,
  ai_summary text null,
  ai_summary_model text null,
  ai_summarized_at timestamptz null
);
create unique index if not exists articles_dedupe_unique on articles (feed_id, dedupe_key);
create index if not exists articles_feed_published_idx on articles (feed_id, published_at desc, id desc);
create index if not exists articles_is_read_published_idx on articles (is_read, published_at desc, id desc);
create index if not exists articles_is_starred_published_idx on articles (is_starred, published_at desc, id desc);

create table if not exists app_settings (
  id int primary key default 1 check (id = 1),
  ai_summary_enabled boolean not null default false,
  ai_translate_enabled boolean not null default false,
  ai_auto_summarize boolean not null default false,
  ai_model text not null default '',
  ai_api_base_url text not null default '',
  rss_user_agent text not null default 'FeedFuse/1.0',
  rss_timeout_ms int not null default 10000,
  updated_at timestamptz not null default now()
);

insert into app_settings (id) values (1)
on conflict (id) do nothing;


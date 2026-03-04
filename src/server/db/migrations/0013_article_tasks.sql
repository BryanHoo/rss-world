create table if not exists article_tasks (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  type text not null,
  status text not null,
  job_id text null,
  requested_at timestamptz null,
  started_at timestamptz null,
  finished_at timestamptz null,
  attempts int not null default 0,
  error_code text null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint article_tasks_status_check check (status in ('queued', 'running', 'succeeded', 'failed'))
);

create unique index if not exists article_tasks_article_id_type_unique on article_tasks (article_id, type);
create index if not exists article_tasks_article_id_idx on article_tasks (article_id);
create index if not exists article_tasks_status_updated_at_idx on article_tasks (status, updated_at desc);


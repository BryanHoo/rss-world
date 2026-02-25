alter table app_settings
  add column if not exists ui_settings jsonb not null default '{}'::jsonb;


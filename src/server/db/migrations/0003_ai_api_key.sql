alter table app_settings
  add column if not exists ai_api_key text not null default '';


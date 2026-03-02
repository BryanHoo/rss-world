alter table feeds
  add column article_list_display_mode text not null default 'card',
  add constraint feeds_article_list_display_mode_check
    check (article_list_display_mode in ('card', 'list'));

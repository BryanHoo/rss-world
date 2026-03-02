import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('db migrations', () => {
  it('adds article-list-display-mode to feeds', () => {
    const migrationPath =
      'src/server/db/migrations/0008_feed_article_list_display_mode.sql';
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('alter table feeds');
    expect(sql).toContain('article_list_display_mode');
    expect(sql).toContain('feeds_article_list_display_mode_check');
  });
});

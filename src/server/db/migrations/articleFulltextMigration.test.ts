import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('db migrations', () => {
  it('adds fulltext columns to articles', () => {
    const migrationPath = 'src/server/db/migrations/0004_article_fulltext.sql';
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('content_full_html');
    expect(sql).toContain('content_full_fetched_at');
    expect(sql).toContain('content_full_error');
    expect(sql).toContain('content_full_source_url');
  });
});


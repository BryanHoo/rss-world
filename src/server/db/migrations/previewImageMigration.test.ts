import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('db migrations', () => {
  it('adds preview image url to articles', () => {
    const migrationPath = 'src/server/db/migrations/0006_article_preview_image.sql';
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('preview_image_url');
  });
});


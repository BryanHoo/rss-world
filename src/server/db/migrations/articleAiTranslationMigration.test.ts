import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('db migrations', () => {
  it('adds ai translation columns to articles', () => {
    const migrationPath = 'src/server/db/migrations/0009_article_ai_translation.sql';
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('ai_translation_zh_html');
    expect(sql).toContain('ai_translation_model');
    expect(sql).toContain('ai_translated_at');
  });
});


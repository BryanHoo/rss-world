import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('db migrations', () => {
  it('adds translation session/segment/event tables', () => {
    const migrationPath = 'src/server/db/migrations/0014_article_translation_sessions.sql';
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('create table if not exists article_translation_sessions');
    expect(sql).toContain('create table if not exists article_translation_segments');
    expect(sql).toContain('create table if not exists article_translation_events');
  });
});

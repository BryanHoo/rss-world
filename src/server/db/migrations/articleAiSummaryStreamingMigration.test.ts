import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('db migrations', () => {
  it('adds ai summary session and event tables', () => {
    const migrationPath = 'src/server/db/migrations/0018_article_ai_summary_streaming.sql';
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('create table if not exists article_ai_summary_sessions');
    expect(sql).toContain('create table if not exists article_ai_summary_events');
    expect(sql).toContain('superseded_by_session_id');
  });
});

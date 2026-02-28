import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('db migrations', () => {
  it('adds ai-summary-on-open flag to feeds', () => {
    const migrationPath = 'src/server/db/migrations/0007_feed_ai_summary_on_open.sql';
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('alter table feeds');
    expect(sql).toContain('ai_summary_on_open_enabled');
  });
});


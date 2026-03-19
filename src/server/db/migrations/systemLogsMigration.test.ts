import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('db migrations', () => {
  it('adds system_logs table with context_json column and descending indexes', () => {
    const migrationPath = 'src/server/db/migrations/0022_system_logs.sql';
    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('create table if not exists system_logs');
    expect(sql).toContain('context_json jsonb not null default');
    expect(sql).toContain("check (level in ('error', 'warning', 'info'))");
    expect(sql).toContain('create index if not exists idx_system_logs_created_at_desc');
    expect(sql).toContain('create index if not exists idx_system_logs_level_created_at_desc');
  });
});

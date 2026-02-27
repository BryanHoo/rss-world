import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

const listCategoriesMock = vi.fn();
const listFeedsMock = vi.fn();

vi.mock('../repositories/categoriesRepo', () => ({
  listCategories: (...args: unknown[]) => listCategoriesMock(...args),
}));

vi.mock('../repositories/feedsRepo', () => ({
  listFeeds: (...args: unknown[]) => listFeedsMock(...args),
}));

describe('readerSnapshotService (preview image)', () => {
  it('selects preview_image_url as previewImage', async () => {
    listCategoriesMock.mockResolvedValue([]);
    listFeedsMock.mockResolvedValue([]);

    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;

    const mod = (await import('./readerSnapshotService')) as typeof import('./readerSnapshotService');
    await mod.getReaderSnapshot(pool, { view: 'all', limit: 1 });

    const sql = String(query.mock.calls[1]?.[0] ?? '');
    expect(sql).toContain('preview_image_url');
  });
});


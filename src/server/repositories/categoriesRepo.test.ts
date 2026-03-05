import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { reorderCategories } from './categoriesRepo';

describe('reorderCategories', () => {
  it('updates positions in a transaction and returns sorted rows', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rows: [{ id: 'c1' }, { id: 'c2' }] })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        rows: [
          { id: 'c2', name: '设计', position: 0 },
          { id: 'c1', name: '科技', position: 1 },
        ],
      })
      .mockResolvedValueOnce(undefined);

    const pool = { query } as unknown as Pool;

    const rows = await reorderCategories(pool, [
      { id: 'c2', position: 0 },
      { id: 'c1', position: 1 },
    ]);

    expect(rows.map((item) => item.id)).toEqual(['c2', 'c1']);
    expect(query).toHaveBeenNthCalledWith(1, 'begin');
    expect(query).toHaveBeenLastCalledWith('commit');
  });
});

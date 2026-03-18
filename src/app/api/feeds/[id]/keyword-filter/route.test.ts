import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUiSettingsMock = vi.fn();
const updateUiSettingsMock = vi.fn();
const getFeedCategoryAssignmentMock = vi.fn();
const pool = {};

vi.mock('../../../../../server/db/pool', () => ({ getPool: () => pool }));
vi.mock('../../../../../server/repositories/settingsRepo', () => ({
  getUiSettings: (...args: unknown[]) => getUiSettingsMock(...args),
  updateUiSettings: (...args: unknown[]) => updateUiSettingsMock(...args),
}));
vi.mock('../../../../../server/repositories/feedsRepo', () => ({
  getFeedCategoryAssignment: (...args: unknown[]) => getFeedCategoryAssignmentMock(...args),
}));

describe('/api/feeds/[id]/keyword-filter', () => {
  const feedId = '1001';

  beforeEach(() => {
    getUiSettingsMock.mockReset();
    updateUiSettingsMock.mockReset();
    getFeedCategoryAssignmentMock.mockReset();
  });

  it('PATCH stores keywords for a feed and returns normalized values', async () => {
    getFeedCategoryAssignmentMock.mockResolvedValue({
      id: feedId,
      categoryId: null,
    });
    getUiSettingsMock.mockResolvedValue({
      rss: { articleKeywordFilter: { globalKeywords: [], feedKeywordsByFeedId: {} } },
    });
    updateUiSettingsMock.mockResolvedValue({
      rss: {
        articleKeywordFilter: {
          globalKeywords: [],
          feedKeywordsByFeedId: {
            [feedId]: ['Sponsored'],
          },
        },
      },
    });

    const mod = await import('./route');
    const res = await mod.PATCH(
      new Request(`http://localhost/api/feeds/${feedId}/keyword-filter`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ keywords: [' Sponsored ', 'sponsored'] }),
      }),
      { params: Promise.resolve({ id: feedId }) },
    );
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.data.keywords).toEqual(['Sponsored']);
  });

  it('PATCH rejects non-numeric feed id', async () => {
    const mod = await import('./route');
    const res = await mod.PATCH(
      new Request('http://localhost/api/feeds/not-a-number/keyword-filter', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ keywords: ['Sponsored'] }),
      }),
      { params: Promise.resolve({ id: 'not-a-number' }) },
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('validation_error');
  });
});

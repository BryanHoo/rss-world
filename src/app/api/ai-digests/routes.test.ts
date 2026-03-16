import { beforeEach, describe, expect, it, vi } from 'vitest';

const pool = { connect: vi.fn() };
const createAiDigestWithCategoryResolutionMock = vi.fn();

vi.mock('../../../server/db/pool', () => ({ getPool: () => pool }));
vi.mock('../../../../server/db/pool', () => ({ getPool: () => pool }));

vi.mock('../../../server/services/aiDigestLifecycleService', () => ({
  createAiDigestWithCategoryResolution: (...args: unknown[]) =>
    createAiDigestWithCategoryResolutionMock(...args),
}));
vi.mock('../../../../server/services/aiDigestLifecycleService', () => ({
  createAiDigestWithCategoryResolution: (...args: unknown[]) =>
    createAiDigestWithCategoryResolutionMock(...args),
}));

describe('/api/ai-digests', () => {
  beforeEach(() => {
    createAiDigestWithCategoryResolutionMock.mockReset();
  });

  it('POST creates ai_digest feed and returns unreadCount=0', async () => {
    createAiDigestWithCategoryResolutionMock.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000000',
      kind: 'ai_digest',
      title: 'My Digest',
      url: 'http://localhost/__feedfuse_ai_digest__/00000000-0000-0000-0000-000000000000',
      siteUrl: null,
      iconUrl: null,
      enabled: true,
      fullTextOnOpenEnabled: false,
      aiSummaryOnOpenEnabled: false,
      aiSummaryOnFetchEnabled: false,
      bodyTranslateOnFetchEnabled: false,
      bodyTranslateOnOpenEnabled: false,
      titleTranslateEnabled: false,
      bodyTranslateEnabled: false,
      articleListDisplayMode: 'card',
      categoryId: null,
      fetchIntervalMinutes: 30,
      lastFetchStatus: null,
      lastFetchError: null,
    });

    const mod = await import('./route');
    const res = await mod.POST(
      new Request('http://localhost/api/ai-digests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'My Digest',
          prompt: '解读这些文章',
          intervalMinutes: 60,
          selectedFeedIds: ['22222222-2222-2222-8222-222222222222'],
          selectedCategoryIds: [],
          categoryName: 'Tech',
        }),
      }),
    );
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.data.unreadCount).toBe(0);
    expect(json.data.kind).toBe('ai_digest');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectMock = vi.fn();
const queryMock = vi.fn();
const releaseMock = vi.fn();

const findCategoryByNormalizedNameMock = vi.fn();
const getNextCategoryPositionMock = vi.fn();
const createCategoryMock = vi.fn();
const createAiDigestFeedMock = vi.fn();
const createAiDigestConfigMock = vi.fn();

vi.mock('../repositories/categoriesRepo', () => ({
  findCategoryByNormalizedName: (...args: unknown[]) =>
    findCategoryByNormalizedNameMock(...args),
  getNextCategoryPosition: (...args: unknown[]) => getNextCategoryPositionMock(...args),
  createCategory: (...args: unknown[]) => createCategoryMock(...args),
}));
vi.mock('../repositories/feedsRepo', () => ({
  createAiDigestFeed: (...args: unknown[]) => createAiDigestFeedMock(...args),
}));
vi.mock('../repositories/aiDigestRepo', () => ({
  createAiDigestConfig: (...args: unknown[]) => createAiDigestConfigMock(...args),
}));

describe('aiDigestLifecycleService', () => {
  beforeEach(() => {
    connectMock.mockReset();
    queryMock.mockReset();
    releaseMock.mockReset();
    findCategoryByNormalizedNameMock.mockReset();
    getNextCategoryPositionMock.mockReset();
    createCategoryMock.mockReset();
    createAiDigestFeedMock.mockReset();
    createAiDigestConfigMock.mockReset();

    queryMock.mockResolvedValue(undefined);
    connectMock.mockResolvedValue({
      query: queryMock,
      release: releaseMock,
    });
  });

  it('reuses an existing category when categoryName matches', async () => {
    findCategoryByNormalizedNameMock.mockResolvedValue({ id: 'cat-tech' });
    createAiDigestFeedMock.mockResolvedValue({ id: 'feed-1' });
    createAiDigestConfigMock.mockResolvedValue({ feedId: 'feed-1' });

    const pool = { connect: connectMock };
    const { createAiDigestWithCategoryResolution } = await import('./aiDigestLifecycleService');

    await expect(
      createAiDigestWithCategoryResolution(pool as never, {
        title: 'My Digest',
        prompt: '解读这些文章',
        intervalMinutes: 60,
        selectedFeedIds: [],
        selectedCategoryIds: [],
        categoryName: 'Tech',
      }),
    ).resolves.toBeTruthy();

    expect(createCategoryMock).not.toHaveBeenCalled();
    expect(createAiDigestFeedMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ categoryId: 'cat-tech' }),
    );
  });

  it('creates a new category when categoryName does not exist', async () => {
    findCategoryByNormalizedNameMock.mockResolvedValue(null);
    getNextCategoryPositionMock.mockResolvedValue(3);
    createCategoryMock.mockResolvedValue({ id: 'cat-new' });
    createAiDigestFeedMock.mockResolvedValue({ id: 'feed-1' });
    createAiDigestConfigMock.mockResolvedValue({ feedId: 'feed-1' });

    const pool = { connect: connectMock };
    const { createAiDigestWithCategoryResolution } = await import('./aiDigestLifecycleService');

    await expect(
      createAiDigestWithCategoryResolution(pool as never, {
        title: 'My Digest',
        prompt: '解读这些文章',
        intervalMinutes: 60,
        selectedFeedIds: [],
        selectedCategoryIds: [],
        categoryName: 'Tech',
      }),
    ).resolves.toBeTruthy();

    expect(createCategoryMock).toHaveBeenCalled();
    expect(createAiDigestFeedMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ categoryId: 'cat-new' }),
    );
  });
});


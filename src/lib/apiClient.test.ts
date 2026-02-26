import { describe, expect, it } from 'vitest';
import type { ReaderSnapshotDto } from './apiClient';
import { mapSnapshotArticleItem } from './apiClient';

describe('mapSnapshotArticleItem', () => {
  it('maps preview image from snapshot payload', () => {
    const dto: ReaderSnapshotDto['articles']['items'][number] = {
      id: 'article-1',
      feedId: 'feed-1',
      title: 'Test Article',
      summary: 'Summary',
      author: 'Author',
      publishedAt: '2026-01-01T00:00:00.000Z',
      link: 'https://example.com/article',
      isRead: false,
      isStarred: false,
      previewImage: 'https://example.com/preview.jpg',
    };

    const mapped = mapSnapshotArticleItem(dto);

    expect(mapped.previewImage).toBe('https://example.com/preview.jpg');
    expect(mapped.content).toBe('');
  });
});

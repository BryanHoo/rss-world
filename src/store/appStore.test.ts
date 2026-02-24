import { beforeEach, describe, expect, it, vi } from 'vitest';

type AppStoreModule = typeof import('./appStore');
let useAppStore: AppStoreModule['useAppStore'];

beforeEach(async () => {
  vi.resetModules();
  ({ useAppStore } = await import('./appStore'));
});

describe('appStore provider integration', () => {
  it('marks article as read via store action', () => {
    const firstId = useAppStore.getState().articles[0].id;
    useAppStore.getState().markAsRead(firstId);

    const updated = useAppStore.getState().articles.find((a) => a.id === firstId);
    expect(updated?.isRead).toBe(true);
  });

  it('uses categoryId mapping in mock data', () => {
    const { categories, feeds } = useAppStore.getState();
    const techCategory = categories.find((category) => category.id === 'cat-tech');

    expect(techCategory?.name).toBe('科技');
    expect(feeds.find((feed) => feed.id === 'feed-1')?.categoryId).toBe('cat-tech');
    expect(feeds.find((feed) => feed.id === 'feed-6')?.categoryId).toBeNull();
  });

  it('maps legacy category to categoryId when adding feed for transition compatibility', () => {
    useAppStore.getState().addFeed({
      id: 'feed-legacy-category',
      title: 'Legacy Category Feed',
      url: 'https://example.com/legacy.xml',
      unreadCount: 0,
      category: '设计',
    });

    const added = useAppStore.getState().feeds.find((item) => item.id === 'feed-legacy-category');
    expect(added?.categoryId).toBe('cat-design');
    expect(added?.category).toBe('设计');
  });

  it('prefers categoryId when both categoryId and legacy category are provided', () => {
    useAppStore.getState().addFeed({
      id: 'feed-id-priority',
      title: 'CategoryId Priority Feed',
      url: 'https://example.com/priority.xml',
      unreadCount: 0,
      categoryId: 'cat-tech',
      category: '设计',
    });

    const added = useAppStore.getState().feeds.find((item) => item.id === 'feed-id-priority');
    expect(added?.categoryId).toBe('cat-tech');
    expect(added?.category).toBe('科技');
  });

  it('toggles category by id first and supports legacy name fallback', () => {
    const expandedBefore = useAppStore.getState().categories.find((item) => item.id === 'cat-tech')?.expanded;

    useAppStore.getState().toggleCategory('cat-tech');
    const expandedAfterIdToggle = useAppStore.getState().categories.find((item) => item.id === 'cat-tech')?.expanded;

    useAppStore.getState().toggleCategory('科技');
    const expandedAfterNameToggle = useAppStore.getState().categories.find((item) => item.id === 'cat-tech')?.expanded;

    expect(expandedBefore).toBeDefined();
    expect(expandedAfterIdToggle).toBe(!expandedBefore);
    expect(expandedAfterNameToggle).toBe(expandedBefore);
  });

  it('adds feed without leaking state across tests', () => {
    const feedCountBefore = useAppStore.getState().feeds.length;

    useAppStore.getState().addFeed({
      id: 'feed-new-category-id',
      title: 'CategoryId Feed',
      url: 'https://example.com/feed.xml',
      unreadCount: 0,
      categoryId: 'cat-tech',
    });

    const feed = useAppStore.getState().feeds.find((item) => item.id === 'feed-new-category-id');
    expect(useAppStore.getState().feeds.length).toBe(feedCountBefore + 1);
    expect(feed?.categoryId).toBe('cat-tech');
    expect(feed?.category).toBe('科技');
  });

  it('starts from a clean store snapshot per test case', () => {
    const feed = useAppStore.getState().feeds.find((item) => item.id === 'feed-new-category-id');
    expect(feed).toBeUndefined();
  });
});

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewType } from '../../types';

type ArticleListModule = typeof import('./ArticleList');
type AppStoreModule = typeof import('../../store/appStore');
type NotificationModule = typeof import('../notifications/NotificationProvider');
type LoadSnapshot = (input?: { view?: ViewType }) => Promise<void>;

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function setupImagePreloadMock() {
  const originalImage = globalThis.Image;

  class MockImage {
    onload: ((event: Event) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    src = '';

    triggerLoad() {
      this.onload?.(new Event('load'));
    }

    triggerError() {
      this.onerror?.(new Event('error'));
    }
  }

  const instances: MockImage[] = [];

  class MockImageConstructor extends MockImage {
    constructor() {
      super();
      instances.push(this);
    }
  }

  vi.stubGlobal('Image', MockImageConstructor as unknown as typeof Image);

  return {
    instances,
    restore() {
      vi.stubGlobal('Image', originalImage);
    },
  };
}

describe('ArticleList', () => {
  let ArticleList: ArticleListModule['default'];
  let useAppStore: AppStoreModule['useAppStore'];
  let NotificationProvider: NotificationModule['NotificationProvider'];
  let fetchMock: ReturnType<typeof vi.fn>;

  function renderWithNotifications() {
    return render(
      <NotificationProvider>
        <ArticleList />
      </NotificationProvider>,
    );
  }

  beforeEach(async () => {
    vi.resetModules();
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.includes('/api/feeds/refresh') && method === 'POST') {
        return jsonResponse({ ok: true, data: { enqueued: true, jobId: 'job-1' } });
      }
      if (url.includes('/api/feeds/') && url.endsWith('/refresh') && method === 'POST') {
        return jsonResponse({ ok: true, data: { enqueued: true, jobId: 'job-1' } });
      }
      if (url.includes('/api/articles/') && method === 'PATCH') {
        return jsonResponse({ ok: true, data: { updated: true } });
      }

      return jsonResponse({ ok: true, data: { updated: true } });
    });
    vi.stubGlobal('fetch', fetchMock);

    ({ default: ArticleList } = await import('./ArticleList'));
    ({ NotificationProvider } = await import('../notifications/NotificationProvider'));
    ({ useAppStore } = await import('../../store/appStore'));

    useAppStore.setState({
      feeds: [
        {
          id: 'feed-1',
          title: 'Example Feed',
          url: 'https://example.com/rss.xml',
          unreadCount: 2,
          enabled: true,
          categoryId: null,
        },
      ],
      articles: [
        {
          id: 'art-1',
          feedId: 'feed-1',
          title: 'Selected Article',
          content: '',
          summary: 'Summary',
          publishedAt: new Date('2026-02-25T00:00:00.000Z').toISOString(),
          link: 'https://example.com/1',
          isRead: false,
          isStarred: false,
        },
        {
          id: 'art-2',
          feedId: 'feed-1',
          title: 'Other Article',
          content: '',
          summary: 'Summary',
          publishedAt: new Date('2026-02-24T00:00:00.000Z').toISOString(),
          link: 'https://example.com/2',
          isRead: false,
          isStarred: false,
        },
      ],
      selectedView: 'all',
      selectedArticleId: 'art-1',
      showUnreadOnly: true,
    });
  });

  it('keeps selected article visible after it is marked as read when showUnreadOnly is enabled', () => {
    renderWithNotifications();
    expect(screen.getByText('Selected Article')).toBeInTheDocument();

    act(() => {
      useAppStore.getState().markAsRead('art-1');
    });

    expect(screen.getByText('Selected Article')).toBeInTheDocument();
  });

  it('keeps selected read article visible when showUnreadOnly is enabled (fresh session)', () => {
    useAppStore.setState((state) => ({
      ...state,
      articles: state.articles.map((article) =>
        article.id === 'art-1' ? { ...article, isRead: true } : article,
      ),
    }));

    renderWithNotifications();

    expect(screen.getByText('Selected Article')).toBeInTheDocument();
    expect(screen.queryByText('Other Article')).toBeInTheDocument();
  });

  it('retains all currently visible articles in unread view after marking them read', () => {
    useAppStore.setState({
      selectedView: 'unread',
      showUnreadOnly: false,
      selectedArticleId: 'art-1',
    });

    renderWithNotifications();

    act(() => {
      useAppStore.getState().markAsRead('art-1');
      useAppStore.getState().markAsRead('art-2');
    });

    expect(screen.getByText('Selected Article')).toBeInTheDocument();
    expect(screen.getByText('Other Article')).toBeInTheDocument();
  });

  it('retains a non-selected article that was already visible in unread-only mode', () => {
    useAppStore.setState({
      selectedView: 'all',
      showUnreadOnly: true,
      selectedArticleId: 'art-1',
    });

    renderWithNotifications();

    act(() => {
      useAppStore.getState().markAsRead('art-2');
    });

    expect(screen.getByText('Other Article')).toBeInTheDocument();
  });

  it('drops retained read items after selectedView changes', () => {
    useAppStore.setState({ selectedView: 'all', showUnreadOnly: true });
    renderWithNotifications();

    act(() => {
      useAppStore.getState().markAsRead('art-1');
      useAppStore.getState().markAsRead('art-2');
    });
    expect(screen.getByText('Selected Article')).toBeInTheDocument();
    expect(screen.getByText('Other Article')).toBeInTheDocument();

    act(() => {
      useAppStore.setState({ selectedView: 'unread', showUnreadOnly: false });
      useAppStore.setState({ selectedView: 'all', showUnreadOnly: true });
    });

    expect(screen.getByText('Selected Article')).toBeInTheDocument();
    expect(screen.queryByText('Other Article')).not.toBeInTheDocument();
  });

  it('drops retained read items after unread-only toggle off and on', () => {
    useAppStore.setState({ selectedView: 'all', showUnreadOnly: true });
    renderWithNotifications();

    act(() => {
      useAppStore.getState().markAsRead('art-1');
      useAppStore.getState().markAsRead('art-2');
      useAppStore.setState({ showUnreadOnly: false });
      useAppStore.setState({ showUnreadOnly: true });
    });

    expect(screen.getByText('Selected Article')).toBeInTheDocument();
    expect(screen.queryByText('Other Article')).not.toBeInTheDocument();
  });

  it('drops retained read items when snapshot loading completes', () => {
    useAppStore.setState({ selectedView: 'all', showUnreadOnly: true });
    renderWithNotifications();

    act(() => {
      useAppStore.getState().markAsRead('art-1');
      useAppStore.getState().markAsRead('art-2');
      useAppStore.setState({ snapshotLoading: true });
      useAppStore.setState({ snapshotLoading: false });
    });

    expect(screen.getByText('Selected Article')).toBeInTheDocument();
    expect(screen.queryByText('Other Article')).not.toBeInTheDocument();
  });

  it('renders preview image only after preload succeeds', async () => {
    const previewImageUrl = 'https://example.com/preview.jpg';
    const preload = setupImagePreloadMock();

    useAppStore.setState((state) => ({
      ...state,
      articles: state.articles.map((article) =>
        article.id === 'art-1' ? { ...article, previewImage: previewImageUrl } : article,
      ),
    }));

    try {
      const { container } = renderWithNotifications();

      expect(preload.instances).toHaveLength(1);
      expect(preload.instances[0].src).toBe(previewImageUrl);
      expect(container.querySelector(`img[src="${previewImageUrl}"]`)).not.toBeInTheDocument();

      act(() => {
        preload.instances[0].triggerLoad();
      });

      await waitFor(() => {
        expect(container.querySelector(`img[src="${previewImageUrl}"]`)).toBeInTheDocument();
      });
    } finally {
      preload.restore();
    }
  });

  it('keeps preview image hidden when preload fails', () => {
    const brokenImageUrl = 'https://example.com/broken-preview.jpg';
    const preload = setupImagePreloadMock();

    useAppStore.setState((state) => ({
      ...state,
      articles: state.articles.map((article) =>
        article.id === 'art-1' ? { ...article, previewImage: brokenImageUrl } : article,
      ),
    }));

    try {
      const { container } = renderWithNotifications();

      expect(preload.instances).toHaveLength(1);
      expect(container.querySelector(`img[src="${brokenImageUrl}"]`)).not.toBeInTheDocument();

      act(() => {
        preload.instances[0].triggerError();
      });

      expect(container.querySelector(`img[src="${brokenImageUrl}"]`)).not.toBeInTheDocument();
    } finally {
      preload.restore();
    }
  });

  it.each(['all', 'unread', 'starred'] as const)(
    'refreshes all enabled feeds in %s view',
    async (view) => {
      vi.useFakeTimers();
      try {
        const loadSnapshotMock = vi.fn().mockResolvedValue(undefined);
        useAppStore.setState({
          selectedView: view,
          selectedArticleId: null,
          loadSnapshot: loadSnapshotMock as unknown as LoadSnapshot,
        });

        renderWithNotifications();

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'refresh-feeds' }));
          await vi.runAllTimersAsync();
        });

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/api/feeds/refresh'),
          expect.objectContaining({ method: 'POST' }),
        );
        expect(loadSnapshotMock).toHaveBeenCalledWith({ view });
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it('refreshes selected feed in feed view', async () => {
    vi.useFakeTimers();
    try {
      const loadSnapshotMock = vi.fn().mockResolvedValue(undefined);
      useAppStore.setState({
        selectedView: 'feed-1',
        selectedArticleId: null,
        loadSnapshot: loadSnapshotMock as unknown as LoadSnapshot,
      });

      renderWithNotifications();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'refresh-feeds' }));
        await vi.runAllTimersAsync();
      });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/feeds/feed-1/refresh'),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(loadSnapshotMock).toHaveBeenCalledWith({ view: 'feed-1' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('disables refresh button when selected feed is disabled', () => {
    useAppStore.setState({
      selectedView: 'feed-1',
      feeds: [
        {
          id: 'feed-1',
          title: 'Example Feed',
          url: 'https://example.com/rss.xml',
          unreadCount: 2,
          enabled: false,
          categoryId: null,
        },
      ],
    });

    renderWithNotifications();

    expect(screen.getByRole('button', { name: 'refresh-feeds' })).toBeDisabled();
  });
});

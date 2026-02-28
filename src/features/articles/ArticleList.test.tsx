import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type ArticleListModule = typeof import('./ArticleList');
type AppStoreModule = typeof import('../../store/appStore');

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('ArticleList', () => {
  let ArticleList: ArticleListModule['default'];
  let useAppStore: AppStoreModule['useAppStore'];

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ ok: true, data: { updated: true } })),
    );

    ({ default: ArticleList } = await import('./ArticleList'));
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
    render(<ArticleList />);
    expect(screen.getByText('Selected Article')).toBeInTheDocument();

    act(() => {
      useAppStore.getState().markAsRead('art-1');
    });

    expect(screen.getByText('Selected Article')).toBeInTheDocument();
  });

  it('retains all currently visible articles in unread view after marking them read', () => {
    useAppStore.setState({
      selectedView: 'unread',
      showUnreadOnly: false,
      selectedArticleId: 'art-1',
    });

    render(<ArticleList />);

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

    render(<ArticleList />);

    act(() => {
      useAppStore.getState().markAsRead('art-2');
    });

    expect(screen.getByText('Other Article')).toBeInTheDocument();
  });

  it('drops retained read items after selectedView changes', () => {
    useAppStore.setState({ selectedView: 'all', showUnreadOnly: true });
    render(<ArticleList />);

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

    expect(screen.queryByText('Selected Article')).not.toBeInTheDocument();
    expect(screen.queryByText('Other Article')).not.toBeInTheDocument();
  });

  it('drops retained read items after unread-only toggle off and on', () => {
    useAppStore.setState({ selectedView: 'all', showUnreadOnly: true });
    render(<ArticleList />);

    act(() => {
      useAppStore.getState().markAsRead('art-1');
      useAppStore.getState().markAsRead('art-2');
      useAppStore.setState({ showUnreadOnly: false });
      useAppStore.setState({ showUnreadOnly: true });
    });

    expect(screen.queryByText('Selected Article')).not.toBeInTheDocument();
    expect(screen.queryByText('Other Article')).not.toBeInTheDocument();
  });

  it('drops retained read items when snapshot loading completes', () => {
    useAppStore.setState({ selectedView: 'all', showUnreadOnly: true });
    render(<ArticleList />);

    act(() => {
      useAppStore.getState().markAsRead('art-1');
      useAppStore.getState().markAsRead('art-2');
      useAppStore.setState({ snapshotLoading: true });
      useAppStore.setState({ snapshotLoading: false });
    });

    expect(screen.queryByText('Selected Article')).not.toBeInTheDocument();
    expect(screen.queryByText('Other Article')).not.toBeInTheDocument();
  });

  it('hides preview image when image loading fails', () => {
    const brokenImageUrl = 'https://example.com/broken-preview.jpg';

    useAppStore.setState((state) => ({
      ...state,
      articles: state.articles.map((article) =>
        article.id === 'art-1' ? { ...article, previewImage: brokenImageUrl } : article,
      ),
    }));

    const { container } = render(<ArticleList />);
    const image = container.querySelector(`img[src="${brokenImageUrl}"]`);

    expect(image).toBeInTheDocument();
    fireEvent.error(image as HTMLImageElement);
    expect(container.querySelector(`img[src="${brokenImageUrl}"]`)).not.toBeInTheDocument();
  });
});

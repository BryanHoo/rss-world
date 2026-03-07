import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
type ApiClientModule = typeof import('../../lib/apiClient');

const idleTasks = {
  fulltext: {
    type: 'fulltext' as const,
    status: 'idle' as const,
    jobId: null,
    requestedAt: null,
    startedAt: null,
    finishedAt: null,
    attempts: 0,
    errorCode: null,
    errorMessage: null,
  },
  ai_summary: {
    type: 'ai_summary' as const,
    status: 'idle' as const,
    jobId: null,
    requestedAt: null,
    startedAt: null,
    finishedAt: null,
    attempts: 0,
    errorCode: null,
    errorMessage: null,
  },
  ai_translate: {
    type: 'ai_translate' as const,
    status: 'idle' as const,
    jobId: null,
    requestedAt: null,
    startedAt: null,
    finishedAt: null,
    attempts: 0,
    errorCode: null,
    errorMessage: null,
  },
};

vi.mock('../../lib/apiClient', async () => {
  const actual = await vi.importActual<ApiClientModule>('../../lib/apiClient');
  return {
    ...actual,
    enqueueArticleAiSummary: vi.fn(),
    enqueueArticleFulltext: vi.fn(),
    getArticleTasks: vi.fn(),
  };
});

import ArticleView from './ArticleView';
import { useAppStore } from '../../store/appStore';
import { useSettingsStore } from '../../store/settingsStore';
import { defaultPersistedSettings } from '../settings/settingsSchema';

describe('ArticleView outline rail', () => {
  beforeEach(async () => {
    const apiClient = await import('../../lib/apiClient');
    vi.mocked(apiClient.enqueueArticleAiSummary).mockReset();
    vi.mocked(apiClient.enqueueArticleFulltext).mockReset();
    vi.mocked(apiClient.getArticleTasks).mockReset();
    vi.mocked(apiClient.getArticleTasks).mockResolvedValue(idleTasks);

    useSettingsStore.setState((state) => ({
      ...state,
      persistedSettings: {
        ...structuredClone(defaultPersistedSettings),
        general: {
          ...structuredClone(defaultPersistedSettings.general),
          autoMarkReadEnabled: false,
          autoMarkReadDelayMs: 0,
        },
      },
    }));

    useAppStore.setState({
      feeds: [
        {
          id: 'feed-1',
          title: 'Feed 1',
          url: 'https://example.com/rss.xml',
          unreadCount: 0,
          enabled: true,
          fullTextOnOpenEnabled: false,
          aiSummaryOnOpenEnabled: false,
          categoryId: 'cat-uncategorized',
          category: '未分类',
        },
      ],
      categories: [{ id: 'cat-uncategorized', name: '未分类', expanded: true }],
      articles: [
        {
          id: 'article-1',
          feedId: 'feed-1',
          title: 'Article 1',
          content: '<h2>Overview</h2><p>A</p><h3>Details</h3><p>B</p>',
          summary: 'summary',
          publishedAt: new Date('2026-03-07T00:00:00.000Z').toISOString(),
          link: 'https://example.com/a1',
          isRead: true,
          isStarred: false,
        },
      ],
      selectedView: 'all',
      selectedArticleId: 'article-1',
      refreshArticle: vi.fn().mockResolvedValue({
        hasFulltext: false,
        hasFulltextError: false,
        hasAiSummary: false,
        hasAiTranslation: false,
      }),
    });
  });

  it('renders the outline rail when the article body contains headings and expands on hover', async () => {
    await act(async () => {
      render(<ArticleView />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const rail = await screen.findByTestId('article-outline-rail');
    expect(rail).toBeInTheDocument();

    fireEvent.mouseEnter(rail);
    expect(await screen.findByRole('button', { name: 'Overview' })).toBeInTheDocument();
  });

  it('scrolls the article container when an outline item is clicked', async () => {
    render(<ArticleView />);

    const scrollContainer = await screen.findByTestId('article-scroll-container');
    const scrollTo = vi.fn();
    Object.defineProperty(scrollContainer, 'scrollTo', {
      value: scrollTo,
      configurable: true,
    });

    fireEvent.mouseEnter(screen.getByTestId('article-outline-rail'));
    fireEvent.click(await screen.findByRole('button', { name: 'Details' }));

    expect(scrollTo).toHaveBeenCalled();
  });

  it('rebuilds the outline when the rendered body html changes', async () => {
    const { rerender } = render(<ArticleView />);

    fireEvent.mouseEnter(await screen.findByTestId('article-outline-rail'));
    expect(await screen.findByRole('button', { name: 'Overview' })).toBeInTheDocument();

    await act(async () => {
      useAppStore.setState((state) => ({
        ...state,
        articles: state.articles.map((article) =>
          article.id === 'article-1'
            ? { ...article, content: '<h2>Fresh heading</h2><p>Updated</p>' }
            : article,
        ),
      }));

      rerender(<ArticleView />);
      await Promise.resolve();
    });

    fireEvent.mouseEnter(screen.getByTestId('article-outline-rail'));
    expect(await screen.findByRole('button', { name: 'Fresh heading' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Overview' })).not.toBeInTheDocument();
  });
});

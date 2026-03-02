import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ApiClientModule = typeof import('../../lib/apiClient');
type ArticleViewModule = typeof import('./ArticleView');
type AppStoreModule = typeof import('../../store/appStore');
type SettingsStoreModule = typeof import('../../store/settingsStore');

vi.mock('../../lib/apiClient', async () => {
  const actual = await vi.importActual<ApiClientModule>('../../lib/apiClient');
  return {
    ...actual,
    enqueueArticleFulltext: vi.fn(),
    enqueueArticleAiSummary: vi.fn(),
  };
});

describe('ArticleView ai summary', () => {
  let ArticleView: ArticleViewModule['default'];
  let useAppStore: AppStoreModule['useAppStore'];
  let useSettingsStore: SettingsStoreModule['useSettingsStore'];
  let enqueueArticleFulltextMock: ReturnType<typeof vi.fn>;
  let enqueueArticleAiSummaryMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.useRealTimers();

    const apiClient = await import('../../lib/apiClient');
    enqueueArticleFulltextMock = vi.mocked(apiClient.enqueueArticleFulltext);
    enqueueArticleAiSummaryMock = vi.mocked(apiClient.enqueueArticleAiSummary);
    enqueueArticleFulltextMock.mockReset();
    enqueueArticleAiSummaryMock.mockReset();

    ({ default: ArticleView } = await import('./ArticleView'));
    ({ useAppStore } = await import('../../store/appStore'));
    ({ useSettingsStore } = await import('../../store/settingsStore'));

    const persisted = useSettingsStore.getState().persistedSettings;
    useSettingsStore.setState({
      persistedSettings: {
        ...persisted,
        general: {
          ...persisted.general,
          autoMarkReadEnabled: false,
          autoMarkReadDelayMs: 0,
        },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('自动模式打开文章会触发摘要入队', async () => {
    enqueueArticleAiSummaryMock.mockResolvedValue({
      enqueued: false,
      reason: 'missing_api_key',
    });

    const refreshArticleMock = vi.fn().mockResolvedValue({
      hasFulltext: false,
      hasFulltextError: false,
      hasAiSummary: false,
    });

    useAppStore.setState({
      feeds: [
        {
          id: 'feed-1',
          title: 'Feed 1',
          url: 'https://example.com/rss.xml',
          unreadCount: 1,
          enabled: true,
          fullTextOnOpenEnabled: false,
          aiSummaryOnOpenEnabled: true,
          categoryId: null,
          category: null,
        },
      ],
      categories: [{ id: 'cat-uncategorized', name: '未分类', expanded: true }],
      articles: [
        {
          id: 'article-1',
          feedId: 'feed-1',
          title: 'Article 1',
          content: '<p>Hello</p>',
          summary: 'hello',
          publishedAt: new Date('2026-02-28T00:00:00.000Z').toISOString(),
          link: 'https://example.com/a1',
          isRead: true,
          isStarred: false,
        },
      ],
      selectedView: 'all',
      selectedArticleId: 'article-1',
      refreshArticle: refreshArticleMock,
    });

    render(<ArticleView />);

    await waitFor(() => {
      expect(enqueueArticleAiSummaryMock).toHaveBeenCalledWith('article-1');
    });
  });

  it('手动模式下全文 pending 时禁用按钮，失败后可点击触发摘要', async () => {
    enqueueArticleFulltextMock.mockResolvedValue({
      enqueued: true,
      jobId: 'job-fulltext-1',
    });
    enqueueArticleAiSummaryMock.mockResolvedValue({
      enqueued: false,
      reason: 'missing_api_key',
    });

    const refreshArticleMock = vi
      .fn()
      .mockResolvedValueOnce({
        hasFulltext: false,
        hasFulltextError: true,
        hasAiSummary: false,
      })
      .mockResolvedValue({
        hasFulltext: false,
        hasFulltextError: false,
        hasAiSummary: false,
      });

    useAppStore.setState({
      feeds: [
        {
          id: 'feed-1',
          title: 'Feed 1',
          url: 'https://example.com/rss.xml',
          unreadCount: 1,
          enabled: true,
          fullTextOnOpenEnabled: true,
          aiSummaryOnOpenEnabled: false,
          categoryId: null,
          category: null,
        },
      ],
      categories: [{ id: 'cat-uncategorized', name: '未分类', expanded: true }],
      articles: [
        {
          id: 'article-1',
          feedId: 'feed-1',
          title: 'Article 1',
          content: '<p>Hello</p>',
          summary: 'hello',
          publishedAt: new Date('2026-02-28T00:00:00.000Z').toISOString(),
          link: 'https://example.com/a1',
          isRead: true,
          isStarred: false,
        },
      ],
      selectedView: 'all',
      selectedArticleId: 'article-1',
      refreshArticle: refreshArticleMock,
    });

    render(<ArticleView />);

    const aiSummaryButton = await screen.findByRole('button', { name: 'AI摘要' });
    await waitFor(() => {
      expect(aiSummaryButton).toBeDisabled();
    });

    await waitFor(() => {
      expect(aiSummaryButton).toBeEnabled();
    }, { timeout: 3000 });

    fireEvent.click(aiSummaryButton);
    await waitFor(() => {
      expect(enqueueArticleAiSummaryMock).toHaveBeenCalledWith('article-1');
    });
  });

  it('点击 AI 摘要区域任意位置可展开和收起', () => {
    useAppStore.setState({
      feeds: [
        {
          id: 'feed-1',
          title: 'Feed 1',
          url: 'https://example.com/rss.xml',
          unreadCount: 1,
          enabled: true,
          fullTextOnOpenEnabled: false,
          aiSummaryOnOpenEnabled: false,
          categoryId: null,
          category: null,
        },
      ],
      categories: [{ id: 'cat-uncategorized', name: '未分类', expanded: true }],
      articles: [
        {
          id: 'article-1',
          feedId: 'feed-1',
          title: 'Article 1',
          content: '<p>Hello</p>',
          summary: 'hello',
          aiSummary: '第一段\n第二段\n第三段',
          publishedAt: new Date('2026-02-28T00:00:00.000Z').toISOString(),
          link: 'https://example.com/a1',
          isRead: true,
          isStarred: false,
        },
      ],
      selectedView: 'all',
      selectedArticleId: 'article-1',
    });

    render(<ArticleView />);

    expect(screen.getByRole('button', { name: '展开摘要' })).toBeInTheDocument();

    const aiSummaryCard = screen.getByLabelText('AI 摘要');
    fireEvent.click(aiSummaryCard);
    expect(screen.getByRole('button', { name: '收起摘要' })).toBeInTheDocument();
    expect(screen.getByText('第三段')).toBeInTheDocument();

    fireEvent.click(aiSummaryCard);
    expect(screen.getByRole('button', { name: '展开摘要' })).toBeInTheDocument();
  });
});

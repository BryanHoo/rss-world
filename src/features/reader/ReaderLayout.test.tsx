import { fireEvent, render, screen } from '@testing-library/react';
import ReaderLayout from './ReaderLayout';
import { NotificationProvider } from '../notifications/NotificationProvider';
import { defaultPersistedSettings } from '../settings/settingsSchema';
import { useSettingsStore } from '../../store/settingsStore';
import { useAppStore } from '../../store/appStore';

function resetSettingsStore() {
  useSettingsStore.setState((state) => ({
    ...state,
    persistedSettings: structuredClone(defaultPersistedSettings),
    sessionSettings: { ai: { apiKey: '', hasApiKey: false, clearApiKey: false }, rssValidation: {} },
    draft: null,
    validationErrors: {},
    settings: structuredClone(defaultPersistedSettings.appearance),
  }));
  window.localStorage.clear();

  useAppStore.setState({
    feeds: [],
    categories: [{ id: 'cat-uncategorized', name: '未分类', expanded: true }],
    articles: [],
    selectedView: 'all',
    selectedArticleId: null,
    sidebarCollapsed: false,
    snapshotLoading: false,
  });
}

function renderWithNotifications() {
  return render(
    <NotificationProvider>
      <ReaderLayout />
    </NotificationProvider>,
  );
}

describe('ReaderLayout', () => {
  it('keeps the existing 3-column reader interactions', () => {
    resetSettingsStore();
    renderWithNotifications();
    expect(screen.getByLabelText('add-feed')).toBeInTheDocument();
    expect(screen.getByLabelText('open-settings')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('open-settings'));
    expect(screen.getByTestId('settings-center-modal')).toBeInTheDocument();
  });

  it('shows clickable floating article title after scrolling the reader pane', () => {
    resetSettingsStore();
    useAppStore.setState({
      feeds: [
        {
          id: 'feed-1',
          title: 'Example Feed',
          url: 'https://example.com/rss.xml',
          unreadCount: 1,
          enabled: true,
          fullTextOnOpenEnabled: false,
          aiSummaryOnOpenEnabled: false,
          categoryId: 'cat-uncategorized',
          category: '未分类',
        },
      ],
      articles: [
        {
          id: 'article-1',
          feedId: 'feed-1',
          title: 'Selected Article',
          content: '<p>content</p>',
          summary: 'summary',
          publishedAt: new Date().toISOString(),
          link: 'https://example.com/article-1',
          isRead: false,
          isStarred: false,
        },
      ],
      selectedView: 'all',
      selectedArticleId: 'article-1',
    });

    renderWithNotifications();
    expect(screen.queryByTestId('reader-floating-title')).not.toBeInTheDocument();

    const readerScrollContainer = screen.getByTestId('article-scroll-container');
    readerScrollContainer.scrollTop = 120;
    fireEvent.scroll(readerScrollContainer);

    const floatingTitle = screen.getByTestId('reader-floating-title');
    expect(floatingTitle).toHaveTextContent('Selected Article');
    expect(floatingTitle).toHaveAttribute('href', 'https://example.com/article-1');
    expect(floatingTitle).toHaveAttribute('target', '_blank');
  });

  it('groups feeds by category with uncategorized fallback', () => {
    resetSettingsStore();
    useAppStore.setState({
      categories: [
        { id: 'cat-tech', name: '科技', expanded: true },
        { id: 'cat-uncategorized', name: '未分类', expanded: true },
      ],
      feeds: [
        {
          id: 'feed-1',
          title: 'Example 1',
          url: 'https://example.com/rss.xml',
          unreadCount: 1,
          categoryId: 'cat-tech',
          category: '科技',
        },
        {
          id: 'feed-2',
          title: 'Example 2',
          url: 'https://example.com/other.xml',
          unreadCount: 0,
          categoryId: null,
          category: null,
        },
      ],
      articles: [],
      selectedView: 'all',
      selectedArticleId: null,
    });
    renderWithNotifications();
    expect(screen.getByText('科技')).toBeInTheDocument();
    expect(screen.getByText('未分类')).toBeInTheDocument();
  });

  it('hides categories without feeds in sidebar', () => {
    resetSettingsStore();
    useAppStore.setState((state) => ({
      ...state,
      categories: [...state.categories, { id: 'cat-empty', name: '空分类', expanded: true }],
    }));

    renderWithNotifications();
    expect(screen.queryByText('空分类')).not.toBeInTheDocument();
  });
});

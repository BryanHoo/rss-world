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

import { create } from 'zustand';
import { createMockProvider } from '../data/mock/mockProvider';
import type { Article, Category, Feed, ViewType } from '../types';

interface AppState {
  feeds: Feed[];
  categories: Category[];
  articles: Article[];
  selectedView: ViewType;
  selectedArticleId: string | null;
  sidebarCollapsed: boolean;

  setSelectedView: (view: ViewType) => void;
  setSelectedArticle: (id: string | null) => void;
  toggleSidebar: () => void;
  markAsRead: (articleId: string) => void;
  markAllAsRead: (feedId?: string) => void;
  addFeed: (feed: Feed) => void;
  toggleStar: (articleId: string) => void;
  toggleCategory: (categoryId: string) => void;
}

const provider = createMockProvider();
const initialSnapshot = provider.getSnapshot();

export const useAppStore = create<AppState>((set) => ({
  feeds: initialSnapshot.feeds,
  categories: initialSnapshot.categories,
  articles: initialSnapshot.articles,
  selectedView: 'all',
  selectedArticleId: null,
  sidebarCollapsed: false,

  setSelectedView: (view) => set({ selectedView: view, selectedArticleId: null }),
  setSelectedArticle: (id) => set({ selectedArticleId: id }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  markAsRead: (articleId) => set(provider.markAsRead(articleId)),

  markAllAsRead: (feedId) => set(provider.markAllAsRead(feedId)),

  addFeed: (feed) => set(provider.addFeed(feed)),

  toggleStar: (articleId) => set(provider.toggleStar(articleId)),

  toggleCategory: (categoryId) => set(provider.toggleCategory(categoryId)),
}));

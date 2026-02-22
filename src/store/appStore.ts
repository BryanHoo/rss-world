import { create } from 'zustand';
import { mockArticles, mockFeeds, mockFolders } from '../mock/data';
import type { Article, Feed, Folder, ViewType } from '../types';

interface AppState {
  feeds: Feed[];
  folders: Folder[];
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
  toggleFolder: (folderId: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  feeds: mockFeeds,
  folders: mockFolders,
  articles: mockArticles,
  selectedView: 'all',
  selectedArticleId: null,
  sidebarCollapsed: false,

  setSelectedView: (view) => set({ selectedView: view, selectedArticleId: null }),
  setSelectedArticle: (id) => set({ selectedArticleId: id }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  markAsRead: (articleId) =>
    set((state) => ({
      articles: state.articles.map((article) =>
        article.id === articleId ? { ...article, isRead: true } : article
      ),
    })),

  markAllAsRead: (feedId) =>
    set((state) => ({
      articles: state.articles.map((article) =>
        feedId
          ? article.feedId === feedId
            ? { ...article, isRead: true }
            : article
          : { ...article, isRead: true }
      ),
    })),

  addFeed: (feed) =>
    set((state) => ({
      feeds: [...state.feeds, feed],
    })),

  toggleStar: (articleId) =>
    set((state) => ({
      articles: state.articles.map((article) =>
        article.id === articleId ? { ...article, isStarred: !article.isStarred } : article
      ),
    })),

  toggleFolder: (folderId) =>
    set((state) => ({
      folders: state.folders.map((folder) =>
        folder.id === folderId ? { ...folder, expanded: !folder.expanded } : folder
      ),
    })),
}));

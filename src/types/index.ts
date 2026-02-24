export interface Feed {
  id: string;
  title: string;
  url: string;
  icon?: string;
  unreadCount: number;
  categoryId?: string | null;
  category?: string | null;
}

export interface Category {
  id: string;
  name: string;
  expanded?: boolean;
}

export type Folder = Category;

export interface Article {
  id: string;
  feedId: string;
  title: string;
  content: string;
  summary: string;
  author?: string;
  publishedAt: string;
  link: string;
  isRead: boolean;
  isStarred: boolean;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: 'sans' | 'serif';
  lineHeight: 'compact' | 'normal' | 'relaxed';
}

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: 'sans' | 'serif';
  lineHeight: 'compact' | 'normal' | 'relaxed';
}

export interface AIPersistedSettings {
  summaryEnabled: boolean;
  translateEnabled: boolean;
  autoSummarize: boolean;
  model: string;
  apiBaseUrl: string;
}

export interface RssSourceSetting {
  id: string;
  name: string;
  url: string;
  category: string | null;
  enabled: boolean;
}

export interface RssSettings {
  sources: RssSourceSetting[];
}

export interface PersistedSettings {
  appearance: AppearanceSettings;
  ai: AIPersistedSettings;
  categories: Category[];
  rss: RssSettings;
}

export type ViewType = 'all' | 'unread' | 'starred' | string;

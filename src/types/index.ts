export interface Feed {
  id: string;
  title: string;
  url: string;
  icon?: string;
  unreadCount: number;
  folderId?: string;
}

export interface Folder {
  id: string;
  name: string;
  expanded: boolean;
}

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

export type ViewType = 'all' | 'unread' | 'starred' | string;

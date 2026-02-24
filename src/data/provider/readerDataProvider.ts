import type { Article, Feed, Folder } from '../../types';

export interface ReaderSnapshot {
  feeds: Feed[];
  categories: Folder[];
  articles: Article[];
}

export interface ReaderDataProvider {
  getSnapshot(): ReaderSnapshot;
  markAsRead(articleId: string): ReaderSnapshot;
  markAllAsRead(feedId?: string): ReaderSnapshot;
  toggleStar(articleId: string): ReaderSnapshot;
  addFeed(feed: Feed): ReaderSnapshot;
  toggleCategory(categoryId: string): ReaderSnapshot;
}

import type { Article, Category, Feed } from '../../types';

export interface ReaderSnapshot {
  feeds: Feed[];
  categories: Category[];
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

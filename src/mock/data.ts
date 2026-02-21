import type { Article, Feed, Folder } from '../types';

export const mockFolders: Folder[] = [
  { id: 'folder-1', name: '科技', expanded: true },
  { id: 'folder-2', name: '设计', expanded: true },
  { id: 'folder-3', name: '开发', expanded: true },
];

export const mockFeeds: Feed[] = [
  {
    id: 'feed-1',
    title: 'Hacker News',
    url: 'https://news.ycombinator.com/rss',
    icon: '🔶',
    unreadCount: 12,
    folderId: 'folder-1',
  },
  {
    id: 'feed-2',
    title: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    icon: '🚀',
    unreadCount: 8,
    folderId: 'folder-1',
  },
  {
    id: 'feed-3',
    title: 'Dribbble Blog',
    url: 'https://dribbble.com/stories.rss',
    icon: '🎨',
    unreadCount: 5,
    folderId: 'folder-2',
  },
  {
    id: 'feed-4',
    title: 'Smashing Magazine',
    url: 'https://www.smashingmagazine.com/feed/',
    icon: '📐',
    unreadCount: 7,
    folderId: 'folder-2',
  },
  {
    id: 'feed-5',
    title: 'CSS-Tricks',
    url: 'https://css-tricks.com/feed/',
    icon: '💅',
    unreadCount: 6,
    folderId: 'folder-3',
  },
  {
    id: 'feed-6',
    title: 'Dev.to',
    url: 'https://dev.to/feed',
    icon: '👨‍💻',
    unreadCount: 10,
    folderId: 'folder-3',
  },
];

export const mockArticles: Article[] = [
  {
    id: 'article-1',
    feedId: 'feed-1',
    title: 'Show HN: I built a modern RSS reader',
    content: '<p>After Google Reader shut down, I decided to build my own RSS reader...</p>',
    summary: 'A developer shares their journey building a modern RSS reader from scratch.',
    author: 'johndoe',
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    link: 'https://example.com/article-1',
    isRead: false,
    isStarred: false,
  },
  {
    id: 'article-2',
    feedId: 'feed-1',
    title: 'The State of JavaScript 2024',
    content: '<p>The annual JavaScript survey results are in...</p>',
    summary: 'Survey results showing the most popular JavaScript frameworks and tools.',
    author: 'janedoe',
    publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    link: 'https://example.com/article-2',
    isRead: false,
    isStarred: false,
  },
  // Add more articles in P6.3.
];

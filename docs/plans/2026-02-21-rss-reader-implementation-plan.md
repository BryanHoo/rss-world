# RSS World 实施计划

基于设计文档：`docs/plans/2026-02-21-rss-reader-design.md`

## 阶段概览

| 阶段 | 内容 | 任务数 |
|------|------|--------|
| P0 | 项目初始化与基础设施 | 3 |
| P1 | 核心数据层 | 3 |
| P2 | 三栏布局骨架 | 1 |
| P3 | 侧边栏（订阅源列表） | 1 |
| P4 | 文章列表 | 1 |
| P5 | 阅读面板 | 1 |
| P6 | 阅读体验优化 | 3 |
| P7 | 设置与收尾 | 2 |

---

## P0: 项目初始化与基础设施

### 任务 P0.1: 初始化 Vite + React + TypeScript 项目

**步骤 1: 创建 Vite 项目**

```bash
pnpm create vite@latest . -- --template react-ts
```

**步骤 2: 安装依赖**

```bash
pnpm install
```

**步骤 3: 验证项目运行**

```bash
pnpm run dev
```

预期：浏览器打开 `http://localhost:5173`，显示 Vite + React 默认页面

**步骤 4: 提交**

```bash
git add .
git commit -m "chore: initialize Vite + React + TypeScript project"
```

---

### 任务 P0.2: 安装核心依赖

**步骤 1: 安装 TailwindCSS**

```bash
pnpm install -D tailwindcss postcss autoprefixer
pnpm dlx tailwindcss init -p
```

**步骤 2: 配置 Tailwind**

修改 `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**步骤 3: 添加 Tailwind 指令到 CSS**

修改 `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**步骤 4: 安装其他依赖**

```bash
pnpm install zustand react-router-dom lucide-react
pnpm install -D @types/node
```

**步骤 5: 验证 Tailwind 工作**

修改 `src/App.tsx`:

```tsx
function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <h1 className="text-4xl font-bold text-blue-600">RSS World</h1>
    </div>
  )
}

export default App
```

运行 `pnpm run dev`，预期看到蓝色标题居中显示

**步骤 6: 提交**

```bash
git add .
git commit -m "chore: setup TailwindCSS and core dependencies"
```

---

### 任务 P0.3: 创建项目目录结构

**步骤 1: 创建目录**

```bash
mkdir -p src/{components/{Layout,FeedList,ArticleList,ArticleView,Settings},store,types,mock,utils,hooks}
```

**步骤 2: 创建占位文件**

```bash
touch src/components/Layout/index.tsx
touch src/components/FeedList/index.tsx
touch src/components/ArticleList/index.tsx
touch src/components/ArticleView/index.tsx
touch src/components/Settings/index.tsx
touch src/store/appStore.ts
touch src/store/settingsStore.ts
touch src/types/index.ts
touch src/mock/data.ts
touch src/utils/storage.ts
touch src/utils/date.ts
```

**步骤 3: 验证结构**

```bash
tree src -L 3
```

**步骤 4: 提交**

```bash
git add .
git commit -m "chore: create project directory structure"
```

---

## P1: 核心数据层

### 任务 P1.1: 定义 TypeScript 类型

**文件**: `src/types/index.ts`

**步骤 1: 创建类型定义**

```typescript
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

export type ViewType = 'all' | 'unread' | 'starred' | string; // string for feedId
```

**步骤 2: 提交**

```bash
git add src/types/index.ts
git commit -m "feat: define core TypeScript types"
```

---

### 任务 P1.2: 创建 Mock 数据

**文件**: `src/mock/data.ts`

**步骤 1: 创建 mock 数据**

```typescript
import { Feed, Folder, Article } from '../types';

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
  // 添加更多文章...
];
```

**步骤 2: 提交**

```bash
git add src/mock/data.ts
git commit -m "feat: create mock data for feeds, folders, and articles"
```

---

### 任务 P1.3: 创建 Zustand Stores

**文件**: `src/store/appStore.ts`

**步骤 1: 创建主 Store**

```typescript
import { create } from 'zustand';
import { Feed, Folder, Article, ViewType } from '../types';
import { mockFeeds, mockFolders, mockArticles } from '../mock/data';

interface AppState {
  feeds: Feed[];
  folders: Folder[];
  articles: Article[];
  selectedView: ViewType;
  selectedArticleId: string | null;
  sidebarCollapsed: boolean;

  // Actions
  setSelectedView: (view: ViewType) => void;
  setSelectedArticle: (id: string | null) => void;
  toggleSidebar: () => void;
  markAsRead: (articleId: string) => void;
  markAllAsRead: (feedId?: string) => void;
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
        feedId ? (article.feedId === feedId ? { ...article, isRead: true } : article) : { ...article, isRead: true }
      ),
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
```

**步骤 2: 创建设置 Store**

**文件**: `src/store/settingsStore.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserSettings } from '../types';

interface SettingsState {
  settings: UserSettings;
  updateSettings: (partial: Partial<UserSettings>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: {
        theme: 'auto',
        fontSize: 'medium',
        fontFamily: 'sans',
        lineHeight: 'normal',
      },
      updateSettings: (partial) =>
        set((state) => ({
          settings: { ...state.settings, ...partial },
        })),
    }),
    {
      name: 'rss-world-settings',
    }
  )
);
```

**步骤 3: 提交**

```bash
git add src/store/
git commit -m "feat: create Zustand stores for app state and settings"
```

---

## P2: 三栏布局骨架

### 任务 P2.1: 实现三栏布局组件

**文件**: `src/components/Layout/index.tsx`

**步骤 1: 创建布局组件**

```typescript
import { useAppStore } from '../../store/appStore';
import FeedList from '../FeedList';
import ArticleList from '../ArticleList';
import ArticleView from '../ArticleView';

export default function Layout() {
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* 侧边栏 */}
      <div
        className={`${
          sidebarCollapsed ? 'w-0' : 'w-60'
        } transition-all duration-300 border-r border-gray-200 dark:border-gray-700 overflow-hidden`}
      >
        <FeedList />
      </div>

      {/* 文章列表 */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700">
        <ArticleList />
      </div>

      {/* 阅读面板 */}
      <div className="flex-1 overflow-hidden">
        <ArticleView />
      </div>
    </div>
  );
}
```

**步骤 2: 更新 App.tsx**

```typescript
import Layout from './components/Layout';

function App() {
  return <Layout />;
}

export default App;
```

**步骤 3: 验证布局**

运行 `pnpm run dev`，预期看到三栏布局骨架

**步骤 4: 提交**

```bash
git add src/components/Layout/ src/App.tsx
git commit -m "feat: implement three-column layout skeleton"
```

---

## P3: 侧边栏（订阅源列表）

### 任务 P3.1: 实现订阅源列表

**文件**: `src/components/FeedList/index.tsx`

**步骤 1: 创建组件**

```typescript
import { ChevronRight, ChevronDown, Circle } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

export default function FeedList() {
  const { folders, feeds, selectedView, setSelectedView, toggleFolder } = useAppStore();

  const smartViews = [
    { id: 'all', name: '全部文章', icon: '📚' },
    { id: 'unread', name: '未读文章', icon: '⭕' },
    { id: 'starred', name: '星标文章', icon: '⭐' },
  ];

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      {/* 头部 */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">RSS World</h1>
      </div>

      {/* 智能视图 */}
      <div className="p-2">
        {smartViews.map((view) => (
          <button
            key={view.id}
            onClick={() => setSelectedView(view.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              selectedView === view.id
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span>{view.icon}</span>
            <span>{view.name}</span>
          </button>
        ))}
      </div>

      {/* 订阅源列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        {folders.map((folder) => {
          const folderFeeds = feeds.filter((f) => f.folderId === folder.id);
          return (
            <div key={folder.id} className="mb-2">
              {/* 文件夹标题 */}
              <button
                onClick={() => toggleFolder(folder.id)}
                className="w-full flex items-center gap-1 px-2 py-1 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                {folder.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span>{folder.name}</span>
              </button>

              {/* 订阅源 */}
              {folder.expanded &&
                folderFeeds.map((feed) => (
                  <button
                    key={feed.id}
                    onClick={() => setSelectedView(feed.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 ml-4 rounded-lg text-sm ${
                      selectedView === feed.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span>{feed.icon}</span>
                      <span className="truncate">{feed.title}</span>
                    </div>
                    {feed.unreadCount > 0 && (
                      <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full">
                        {feed.unreadCount}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**步骤 2: 验证功能**

运行 `pnpm run dev`，预期：
- 看到智能视图和文件夹分组
- 点击文件夹可折叠/展开
- 点击订阅源高亮显示

**步骤 3: 提交**

```bash
git add src/components/FeedList/
git commit -m "feat: implement feed list sidebar with folders"
```

---

## P4: 文章列表

### 任务 P4.1: 实现文章列表组件

**文件**: `src/utils/date.ts`

**步骤 1: 创建日期工具函数**

```typescript
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return '刚刚';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分钟前`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}小时前`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}天前`;

  return date.toLocaleDateString('zh-CN');
}
```

**文件**: `src/components/ArticleList/index.tsx`

**步骤 2: 创建文章列表组件**

```typescript
import { Circle, CircleDot } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { formatRelativeTime } from '../../utils/date';

export default function ArticleList() {
  const { articles, feeds, selectedView, selectedArticleId, setSelectedArticle } = useAppStore();

  // 根据选中的视图过滤文章
  const filteredArticles = articles.filter((article) => {
    if (selectedView === 'all') return true;
    if (selectedView === 'unread') return !article.isRead;
    if (selectedView === 'starred') return article.isStarred;
    return article.feedId === selectedView;
  });

  const getFeedTitle = (feedId: string) => {
    return feeds.find((f) => f.id === feedId)?.title || '';
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      {/* 头部 */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            文章列表
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {filteredArticles.length} 篇
          </span>
        </div>
      </div>

      {/* 文章列表 */}
      <div className="flex-1 overflow-y-auto">
        {filteredArticles.map((article) => (
          <button
            key={article.id}
            onClick={() => setSelectedArticle(article.id)}
            className={`w-full p-4 border-b border-gray-200 dark:border-gray-700 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
              selectedArticleId === article.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
          >
            <div className="flex items-start gap-2">
              {/* 未读标记 */}
              {!article.isRead && (
                <CircleDot size={12} className="text-blue-500 mt-1 flex-shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                {/* 标题 */}
                <h3
                  className={`text-sm font-medium mb-1 ${
                    article.isRead
                      ? 'text-gray-600 dark:text-gray-400'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {article.title}
                </h3>

                {/* 来源和时间 */}
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>{getFeedTitle(article.feedId)}</span>
                  <span>·</span>
                  <span>{formatRelativeTime(article.publishedAt)}</span>
                </div>

                {/* 摘要 */}
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                  {article.summary}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

**步骤 3: 验证功能**

运行 `pnpm run dev`，预期：
- 文章列表显示标题、来源、时间、摘要
- 未读文章有蓝点标记
- 点击文章高亮显示

**步骤 4: 提交**

```bash
git add src/components/ArticleList/ src/utils/date.ts
git commit -m "feat: implement article list with filtering"
```

---

## P5: 阅读面板

### 任务 P5.1: 实现文章阅读组件

**文件**: `src/components/ArticleView/index.tsx`

**步骤 1: 创建阅读面板组件**

```typescript
import { Star, ExternalLink, Circle } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useSettingsStore } from '../../store/settingsStore';
import { formatRelativeTime } from '../../utils/date';
import { useEffect } from 'react';

export default function ArticleView() {
  const { articles, feeds, selectedArticleId, markAsRead, toggleStar } = useAppStore();
  const { settings } = useSettingsStore();

  const article = articles.find((a) => a.id === selectedArticleId);
  const feed = article ? feeds.find((f) => f.id === article.feedId) : null;

  // 自动标记已读
  useEffect(() => {
    if (article && !article.isRead) {
      const timer = setTimeout(() => {
        markAsRead(article.id);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [article, markAsRead]);

  if (!article) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-gray-800">
        <p className="text-gray-400 dark:text-gray-500">选择一篇文章开始阅读</p>
      </div>
    );
  }

  const fontSizeClass = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
  }[settings.fontSize];

  const lineHeightClass = {
    compact: 'leading-normal',
    normal: 'leading-relaxed',
    relaxed: 'leading-loose',
  }[settings.lineHeight];

  const fontFamilyClass = settings.fontFamily === 'serif' ? 'font-serif' : 'font-sans';

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-gray-800">
      <div className="max-w-3xl mx-auto px-8 py-12">
        {/* 文章头部 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            {article.title}
          </h1>

          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
            <div className="flex items-center gap-2">
              <span>{feed?.icon}</span>
              <span>{feed?.title}</span>
              <span>·</span>
              <span>{formatRelativeTime(article.publishedAt)}</span>
              {article.author && (
                <>
                  <span>·</span>
                  <span>{article.author}</span>
                </>
              )}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleStar(article.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
                article.isStarred
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Star size={16} fill={article.isStarred ? 'currentColor' : 'none'} />
              <span>{article.isStarred ? '已星标' : '星标'}</span>
            </button>

            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <ExternalLink size={16} />
              <span>原文</span>
            </a>
          </div>
        </div>

        {/* 文章内容 */}
        <div
          className={`prose dark:prose-invert max-w-none ${fontSizeClass} ${lineHeightClass} ${fontFamilyClass}`}
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
      </div>
    </div>
  );
}
```

**步骤 2: 添加 Tailwind Typography 插件**

```bash
pnpm install -D @tailwindcss/typography
```

修改 `tailwind.config.js`:

```js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
```

**步骤 3: 验证功能**

运行 `pnpm run dev`，预期：
- 点击文章后显示完整内容
- 2秒后自动标记为已读
- 星标按钮可切换
- 原文链接在新标签页打开

**步骤 4: 提交**

```bash
git add src/components/ArticleView/ tailwind.config.js package.json
git commit -m "feat: implement article reading panel with auto mark-as-read"
```

---

## P6: 阅读体验优化

### 任务 P6.1: 实现主题切换

**文件**: `src/hooks/useTheme.ts`

**步骤 1: 创建主题 Hook**

```typescript
import { useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';

export function useTheme() {
  const { settings } = useSettingsStore();

  useEffect(() => {
    const root = window.document.documentElement;

    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else if (settings.theme === 'light') {
      root.classList.remove('dark');
    } else {
      // auto: 跟随系统
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const updateTheme = () => {
        if (mediaQuery.matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      };

      updateTheme();
      mediaQuery.addEventListener('change', updateTheme);
      return () => mediaQuery.removeEventListener('change', updateTheme);
    }
  }, [settings.theme]);
}
```

**步骤 2: 在 App.tsx 中使用**

```typescript
import Layout from './components/Layout';
import { useTheme } from './hooks/useTheme';

function App() {
  useTheme();
  return <Layout />;
}

export default App;
```

**步骤 3: 提交**

```bash
git add src/hooks/useTheme.ts src/App.tsx
git commit -m "feat: implement theme switching (light/dark/auto)"
```

---

### 任务 P6.2: 实现键盘快捷键

**文件**: `src/hooks/useKeyboardShortcuts.ts`

**步骤 1: 创建快捷键 Hook**

```typescript
import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';

export function useKeyboardShortcuts() {
  const { articles, selectedArticleId, setSelectedArticle, toggleStar, markAsRead } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果在输入框中，不触发快捷键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const currentIndex = articles.findIndex((a) => a.id === selectedArticleId);

      switch (e.key.toLowerCase()) {
        case 'j': // 下一篇
          e.preventDefault();
          if (currentIndex < articles.length - 1) {
            setSelectedArticle(articles[currentIndex + 1].id);
          }
          break;

        case 'k': // 上一篇
          e.preventDefault();
          if (currentIndex > 0) {
            setSelectedArticle(articles[currentIndex - 1].id);
          }
          break;

        case 's': // 星标
          e.preventDefault();
          if (selectedArticleId) {
            toggleStar(selectedArticleId);
          }
          break;

        case 'm': // 标记已读/未读
          e.preventDefault();
          if (selectedArticleId) {
            markAsRead(selectedArticleId);
          }
          break;

        case 'v': // 在浏览器打开
          e.preventDefault();
          if (selectedArticleId) {
            const article = articles.find((a) => a.id === selectedArticleId);
            if (article) {
              window.open(article.link, '_blank');
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [articles, selectedArticleId, setSelectedArticle, toggleStar, markAsRead]);
}
```

**步骤 2: 在 App.tsx 中使用**

```typescript
import Layout from './components/Layout';
import { useTheme } from './hooks/useTheme';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

function App() {
  useTheme();
  useKeyboardShortcuts();
  return <Layout />;
}

export default App;
```

**步骤 3: 验证功能**

运行 `pnpm run dev`，测试快捷键：
- `j/k`: 切换文章
- `s`: 星标
- `m`: 标记已读
- `v`: 打开原文

**步骤 4: 提交**

```bash
git add src/hooks/useKeyboardShortcuts.ts src/App.tsx
git commit -m "feat: implement keyboard shortcuts (j/k/s/m/v)"
```

---

### 任务 P6.3: 完善 Mock 数据

**文件**: `src/mock/data.ts`

**步骤 1: 扩充文章数据到 30 篇**

添加更多文章，包含富文本内容（标题、段落、图片、代码块）

**步骤 2: 提交**

```bash
git add src/mock/data.ts
git commit -m "feat: expand mock data to 30 articles with rich content"
```

---

## P7: 设置与收尾

### 任务 P7.1: 实现设置面板

**文件**: `src/components/Settings/index.tsx`

**步骤 1: 创建设置组件**

```typescript
import { X, Sun, Moon, Monitor } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';

interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  const { settings, updateSettings } = useSettingsStore();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">设置</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* 设置项 */}
        <div className="p-4 space-y-6">
          {/* 主题 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              主题
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'light', label: '浅色', icon: Sun },
                { value: 'dark', label: '深色', icon: Moon },
                { value: 'auto', label: '自动', icon: Monitor },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => updateSettings({ theme: value as any })}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 ${
                    settings.theme === value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-sm">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 字号 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              字号
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'small', label: '小' },
                { value: 'medium', label: '中' },
                { value: 'large', label: '大' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => updateSettings({ fontSize: value as any })}
                  className={`p-2 rounded-lg border-2 ${
                    settings.fontSize === value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 字体 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              字体
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'sans', label: '无衬线' },
                { value: 'serif', label: '衬线' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => updateSettings({ fontFamily: value as any })}
                  className={`p-2 rounded-lg border-2 ${
                    settings.fontFamily === value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 行距 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              行距
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'compact', label: '紧凑' },
                { value: 'normal', label: '标准' },
                { value: 'relaxed', label: '宽松' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => updateSettings({ lineHeight: value as any })}
                  className={`p-2 rounded-lg border-2 ${
                    settings.lineHeight === value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**步骤 2: 在 Layout 中集成设置按钮**

修改 `src/components/Layout/index.tsx`，添加设置按钮和弹窗

**步骤 3: 验证功能**

运行 `pnpm run dev`，测试设置面板各项功能

**步骤 4: 提交**

```bash
git add src/components/Settings/ src/components/Layout/
git commit -m "feat: implement settings panel with theme/font/size controls"
```

---

### 任务 P7.2: 最终优化与文档

**步骤 1: 清理代码**

- 移除未使用的导入
- 统一代码风格
- 添加必要的注释

**步骤 2: 创建 README**

**文件**: `README.md`

```markdown
# RSS World

现代化 RSS 阅读器 Web 应用

## 功能特性

- 三栏布局（订阅源、文章列表、阅读面板）
- 文件夹分组管理订阅源
- 舒适的阅读体验（字体、字号、行距可调）
- 深色/浅色主题切换
- 键盘快捷键支持
- 星标收藏功能

## 技术栈

- React 18 + TypeScript
- Vite
- TailwindCSS
- Zustand
- Lucide React

## 开发

\`\`\`bash
pnpm install
pnpm run dev
\`\`\`

## 键盘快捷键

- `j/k`: 下一篇/上一篇
- `s`: 星标切换
- `m`: 标记已读
- `v`: 在浏览器打开原文
\`\`\`

**步骤 3: 最终测试**

- 测试所有功能
- 检查响应式布局
- 验证深色模式

**步骤 4: 提交**

```bash
git add .
git commit -m "docs: add README and final polish"
```

---

## 完成

所有任务完成后，项目应该：
- 可以正常运行
- 所有核心功能可用
- 代码结构清晰
- 有完整的文档

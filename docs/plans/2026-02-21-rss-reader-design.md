# RSS World - 现代化 RSS 阅读器设计文档

## 概述

面向个人轻度阅读者的现代化 RSS 阅读器 Web 应用。纯前端实现，使用 mock 数据，注重舒适的阅读体验。

## 技术栈

- **框架**：React 18 + TypeScript
- **构建工具**：Vite
- **样式**：TailwindCSS
- **状态管理**：Zustand
- **路由**：React Router v6
- **数据存储**：localStorage
- **图标**：Lucide React

## 目标用户

个人轻度阅读者：
- 订阅 10-50 个源
- 每天浏览 20-50 篇文章
- 注重简洁和易用性

## 项目结构

```
rss-world/
├── src/
│   ├── components/
│   │   ├── Layout/         # 三栏布局
│   │   ├── FeedList/       # 订阅源列表
│   │   ├── ArticleList/    # 文章列表
│   │   ├── ArticleView/    # 阅读面板
│   │   └── Settings/       # 设置面板
│   ├── store/              # Zustand 状态管理
│   ├── types/              # TypeScript 类型
│   ├── mock/               # Mock 数据
│   ├── utils/              # 工具函数
│   ├── hooks/              # 自定义 Hooks
│   └── App.tsx
├── public/
└── package.json
```

## 数据模型

```typescript
interface Feed {
  id: string;
  title: string;
  url: string;
  icon?: string;
  unreadCount: number;
  folderId?: string;
}

interface Folder {
  id: string;
  name: string;
  expanded: boolean;
}

interface Article {
  id: string;
  feedId: string;
  title: string;
  content: string;
  summary: string;
  author?: string;
  publishedAt: Date;
  link: string;
  isRead: boolean;
  isStarred: boolean;
}

interface UserSettings {
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: 'sans' | 'serif';
  lineHeight: 'compact' | 'normal' | 'relaxed';
}
```

## UI 布局

经典三栏布局：
- 侧边栏（240px，可折叠）：订阅源列表、文件夹分组
- 文章列表（320px）：文章标题、来源、时间、摘要
- 阅读面板（自适应，内容区最大 720px 居中）

## 阅读体验设计

### 排版
- 正文 16px，行高 1.75
- 内容区最大宽度 720px 居中
- 标题层级清晰

### 主题
- 浅色：白底 `#FAFAFA`，正文 `#1A1A1A`
- 深色：深灰底 `#1A1A1A`，正文 `#E5E5E5`
- 支持跟随系统自动切换

### 字体设置
- 字号：小 / 中 / 大
- 字体：无衬线 / 衬线
- 行距：紧凑 / 标准 / 宽松

## 核心功能

### 订阅源管理
- 智能视图（全部、未读、星标）
- 文件夹分组（可折叠）
- 未读数量徽章
- 添加/删除订阅源

### 文章列表
- 未读标记（蓝点）
- 标题 + 来源 + 相对时间 + 摘要预览
- 排序：最新/最旧优先
- 过滤：全部/仅未读
- 全部标记为已读

### 阅读面板
- 文章头部：标题、来源、时间、操作按钮
- HTML 内容安全渲染
- 图片懒加载
- 滚动到底部自动标记已读

### 键盘快捷键
- `j/k`：下一篇/上一篇
- `s`：星标切换
- `m`：已读/未读切换
- `v`：在浏览器打开原文

### 设置
- 外观：主题、字号、字体、行距
- 数据：导入/导出 OPML、清除数据

## Mock 数据

3 个文件夹（科技、设计、开发），6-8 个订阅源，约 30 篇文章，包含富文本内容。

## 状态管理

```typescript
// 主 Store
interface AppStore {
  feeds: Feed[];
  folders: Folder[];
  articles: Article[];
  selectedFeedId: string | null;
  selectedArticleId: string | null;
  sidebarCollapsed: boolean;
  markAsRead: (articleId: string) => void;
  markAllAsRead: (feedId?: string) => void;
  toggleStar: (articleId: string) => void;
}

// 设置 Store（持久化到 localStorage）
interface SettingsStore {
  settings: UserSettings;
  updateSettings: (partial: Partial<UserSettings>) => void;
}
```

## 数据持久化

- 阅读状态（已读/星标）→ localStorage
- 用户设置 → localStorage
- 订阅源和文章 → mock 数据（后续替换为 API）

## 方案选择

选择极简纯净路线：零后端依赖，轻量依赖，专注阅读体验打磨，易于后续扩展接入真实 API。

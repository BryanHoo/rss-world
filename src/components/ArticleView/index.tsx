import { useEffect } from 'react';
import { ExternalLink, Star } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useSettingsStore } from '../../store/settingsStore';
import { formatRelativeTime } from '../../utils/date';

export default function ArticleView() {
  const { articles, feeds, selectedArticleId, markAsRead, toggleStar } = useAppStore();
  const { settings } = useSettingsStore();

  const article = articles.find((item) => item.id === selectedArticleId);
  const feed = article ? feeds.find((item) => item.id === article.feedId) : null;

  useEffect(() => {
    if (article && !article.isRead) {
      const timer = setTimeout(() => {
        markAsRead(article.id);
      }, 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [article, markAsRead]);

  if (!article) {
    return (
      <div className="flex h-full items-center justify-center bg-white dark:bg-gray-800">
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
      <div className="mx-auto max-w-3xl px-8 py-12">
        <div className="mb-8">
          <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">{article.title}</h1>

          <div className="mb-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
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

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleStar(article.id)}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm ${
                article.isStarred
                  ? 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
              }`}
            >
              <Star size={16} fill={article.isStarred ? 'currentColor' : 'none'} />
              <span>{article.isStarred ? '已星标' : '星标'}</span>
            </button>

            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
            >
              <ExternalLink size={16} />
              <span>原文</span>
            </a>
          </div>
        </div>

        <div
          className={`prose max-w-none dark:prose-invert ${fontSizeClass} ${lineHeightClass} ${fontFamilyClass}`}
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
      </div>
    </div>
  );
}

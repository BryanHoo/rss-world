import { useEffect } from 'react';
import { ExternalLink, Languages, Sparkles, Star } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useSettingsStore } from '../../store/settingsStore';
import { formatRelativeTime } from '../../utils/date';

export default function ArticleView() {
  const { articles, feeds, selectedArticleId, markAsRead, toggleStar } = useAppStore();
  const appearance = useSettingsStore((state) => state.persistedSettings.appearance);

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
      <div className="flex h-full flex-col bg-white dark:bg-gray-800">
        <div className="h-12 shrink-0" />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-gray-400 dark:text-gray-500">选择一篇文章开始阅读</p>
        </div>
      </div>
    );
  }

  const fontSizeClass = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
  }[appearance.fontSize];

  const lineHeightClass = {
    compact: 'leading-normal',
    normal: 'leading-relaxed',
    relaxed: 'leading-loose',
  }[appearance.lineHeight];

  const fontFamilyClass = appearance.fontFamily === 'serif' ? 'font-serif' : 'font-sans';

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-800">
      <div className="h-12 shrink-0" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 pb-12 pt-4">
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
                <span>{article.isStarred ? '已收藏' : '收藏'}</span>
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

              <button
                type="button"
                onClick={(event) => event.preventDefault()}
                className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                title="翻译功能即将上线"
              >
                <Languages size={16} />
                <span>翻译</span>
              </button>

              <button
                type="button"
                onClick={(event) => event.preventDefault()}
                className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
                title="AI摘要功能即将上线"
              >
                <Sparkles size={16} />
                <span>AI摘要</span>
              </button>
            </div>
          </div>

          <div
            className={`prose max-w-none dark:prose-invert ${fontSizeClass} ${lineHeightClass} ${fontFamilyClass}`}
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        </div>
      </div>
    </div>
  );
}

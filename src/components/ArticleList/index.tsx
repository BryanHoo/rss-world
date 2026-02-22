import { CircleDot } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { formatRelativeTime } from '../../utils/date';

export default function ArticleList() {
  const { articles, feeds, selectedView, selectedArticleId, setSelectedArticle } = useAppStore();

  const filteredArticles = articles.filter((article) => {
    if (selectedView === 'all') return true;
    if (selectedView === 'unread') return !article.isRead;
    if (selectedView === 'starred') return article.isStarred;
    return article.feedId === selectedView;
  });

  const getFeedTitle = (feedId: string) => {
    return feeds.find((feed) => feed.id === feedId)?.title ?? '';
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-800">
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">文章列表</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">{filteredArticles.length} 篇</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredArticles.map((article) => (
          <button
            key={article.id}
            onClick={() => setSelectedArticle(article.id)}
            className={`w-full border-b border-gray-200 p-4 text-left hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50 ${
              selectedArticleId === article.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
          >
            <div className="flex items-start gap-2">
              {!article.isRead && (
                <CircleDot size={12} className="mt-1 shrink-0 text-blue-500" />
              )}

              <div className="min-w-0 flex-1">
                <h3
                  className={`mb-1 text-sm font-medium ${
                    article.isRead ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {article.title}
                </h3>

                <div className="mb-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{getFeedTitle(article.feedId)}</span>
                  <span>·</span>
                  <span>{formatRelativeTime(article.publishedAt)}</span>
                </div>

                <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{article.summary}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

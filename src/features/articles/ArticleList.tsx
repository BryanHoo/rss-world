import { CheckCheck, CircleDot } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "../../store/appStore";
import { formatRelativeTime } from "../../utils/date";

export default function ArticleList() {
  const {
    articles,
    feeds,
    selectedView,
    selectedArticleId,
    setSelectedArticle,
    markAllAsRead,
  } = useAppStore();
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const showHeaderActions =
    selectedView !== "unread" && selectedView !== "starred";

  const baseFilteredArticles = articles.filter((article) => {
    if (selectedView === "all") return true;
    if (selectedView === "unread") return !article.isRead;
    if (selectedView === "starred") return article.isStarred;
    return article.feedId === selectedView;
  });

  const filteredArticles =
    showUnreadOnly && showHeaderActions
      ? baseFilteredArticles.filter((article) => !article.isRead)
      : baseFilteredArticles;

  const getFeedTitle = (feedId: string) => {
    return feeds.find((feed) => feed.id === feedId)?.title ?? "";
  };

  const getPreviewImage = (content: string) => {
    const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    return match?.[1] ?? null;
  };

  const handleMarkAllAsRead = () => {
    if (selectedView === "all") {
      markAllAsRead();
      return;
    }

    markAllAsRead(selectedView);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center justify-between px-4">
        <h2 className="font-brand text-[0.96rem] font-semibold tracking-[0.01em] text-gray-900 dark:text-white">
          文章
        </h2>
        <div className="flex items-center gap-2">
          {showHeaderActions && (
            <>
              <button
                onClick={() => setShowUnreadOnly((value) => !value)}
                className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                  showUnreadOnly
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                    : "text-gray-600 hover:bg-gray-200/90 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-600/70"
                }`}
                aria-label="toggle-unread-only"
                title="仅显示未读"
              >
                <CircleDot size={14} />
              </button>
              <button
                onClick={handleMarkAllAsRead}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-200/90 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-600/70 dark:hover:text-gray-100"
                aria-label="mark-all-as-read"
                title="标记全部为已读"
              >
                <CheckCheck size={14} />
              </button>
            </>
          )}
          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">
            {filteredArticles.length} 篇
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-3 pt-1">
        {filteredArticles.map((article) => {
          const previewImage = getPreviewImage(article.content);

          return (
            <button
              key={article.id}
              onClick={() => setSelectedArticle(article.id)}
              className={`h-[6.5rem] w-full px-4 py-2.5 text-left transition-colors duration-150 ${
                selectedArticleId === article.id
                  ? "bg-blue-100/80 dark:bg-blue-900/20"
                  : "hover:bg-gray-200/80 dark:hover:bg-gray-600/70"
              }`}
            >
              <div className="flex h-full items-stretch gap-3">
                <div className="flex h-full min-w-0 flex-1 flex-col">
                  <h3
                    className={`line-clamp-2 text-[0.94rem] leading-[1.35] ${
                      article.isRead
                        ? "font-medium text-gray-700 dark:text-gray-300"
                        : "font-semibold text-gray-900 dark:text-gray-100"
                    }`}
                  >
                    {article.title}
                  </h3>

                  <p className="mt-0.5 line-clamp-1 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
                    {article.summary}
                  </p>

                  <div className="mt-auto flex items-center justify-between gap-3 pt-1.5 text-[11px]">
                    <span className="max-w-[10.5rem] truncate font-medium text-gray-600 dark:text-gray-300">
                      {getFeedTitle(article.feedId)}
                    </span>
                    <div className="shrink-0 flex items-center gap-1.5">
                      {!article.isRead && (
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 rounded-full bg-blue-600/80 dark:bg-blue-300/75"
                        />
                      )}
                      <span
                        className={
                          article.isRead
                            ? "text-gray-500 dark:text-gray-400"
                            : "text-blue-700 dark:text-blue-300"
                        }
                      >
                        {formatRelativeTime(article.publishedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {previewImage && (
                  <div className="h-full w-24 shrink-0 overflow-hidden rounded-md bg-gray-200/70 dark:bg-gray-700">
                    <img
                      src={previewImage}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

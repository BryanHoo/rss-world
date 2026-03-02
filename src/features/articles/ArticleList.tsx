import { CheckCheck, CircleDot, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../../store/appStore";
import { formatRelativeTime, getArticleSectionHeading, getLocalDayKey } from "../../utils/date";
import { refreshAllFeeds, refreshFeed } from "../../lib/apiClient";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mapApiErrorToUserMessage } from "../notifications/mapApiErrorToUserMessage";
import { useNotify } from "../notifications/useNotify";

const sessionVisibleArticleIds = new Set<string>();
const REFRESH_POLL_INTERVAL_MS = 1000;
const REFRESH_POLL_MAX_ATTEMPTS = 12;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function ArticleList() {
  const {
    articles,
    feeds,
    selectedView,
    selectedArticleId,
    setSelectedArticle,
    markAllAsRead,
    showUnreadOnly,
    toggleShowUnreadOnly,
    loadSnapshot,
  } = useAppStore();
  const notify = useNotify();
  const refreshRequestIdRef = useRef(0);
  const [refreshing, setRefreshing] = useState(false);

  const showHeaderActions =
    selectedView !== "unread" && selectedView !== "starred";

  const showUnreadFilterActive =
    selectedView === "unread" || (showUnreadOnly && showHeaderActions);

  const [failedPreviewImageKeys, setFailedPreviewImageKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    refreshRequestIdRef.current += 1;
    setRefreshing(false);
  }, [selectedView]);

  useEffect(() => {
    const unsubscribe = useAppStore.subscribe((state, previousState) => {
      const previousShowHeaderActions =
        previousState.selectedView !== "unread" && previousState.selectedView !== "starred";
      const previousShowUnreadFilterActive =
        previousState.selectedView === "unread" ||
        (previousState.showUnreadOnly && previousShowHeaderActions);

      const currentShowHeaderActions =
        state.selectedView !== "unread" && state.selectedView !== "starred";
      const currentShowUnreadFilterActive =
        state.selectedView === "unread" || (state.showUnreadOnly && currentShowHeaderActions);

      const selectedViewChanged = previousState.selectedView !== state.selectedView;
      const showUnreadOnlyChanged = previousState.showUnreadOnly !== state.showUnreadOnly;
      const unreadFilterDisabled =
        previousShowUnreadFilterActive && !currentShowUnreadFilterActive;
      const snapshotLoadingCompleted = previousState.snapshotLoading && !state.snapshotLoading;

      if (selectedViewChanged || showUnreadOnlyChanged || unreadFilterDisabled || snapshotLoadingCompleted) {
        sessionVisibleArticleIds.clear();
      }
    });

    return () => {
      sessionVisibleArticleIds.clear();
      unsubscribe();
    };
  }, []);

  const viewScopedArticles = (() => {
    if (selectedView === "all") return articles;
    if (selectedView === "unread") return articles;
    if (selectedView === "starred") return articles.filter((article) => article.isStarred);
    return articles.filter((article) => article.feedId === selectedView);
  })();

  const filteredArticles = (() => {
    if (!showUnreadFilterActive) return viewScopedArticles;

    const retainedArticleIds = sessionVisibleArticleIds;
    const visibleArticles: typeof viewScopedArticles = [];

    for (const article of viewScopedArticles) {
      if (!article.isRead || retainedArticleIds.has(article.id) || article.id === selectedArticleId) {
        visibleArticles.push(article);
      }
    }

    for (const article of visibleArticles) {
      retainedArticleIds.add(article.id);
    }
    return visibleArticles;
  })();

  const articleSections = useMemo(() => {
    const now = new Date();
    const sections: Array<{
      key: string;
      title: string;
      articles: typeof filteredArticles;
    }> = [];

    let currentSection: (typeof sections)[number] | null = null;

    for (const article of filteredArticles) {
      const publishedDate = new Date(article.publishedAt);
      const hasValidDate = !Number.isNaN(publishedDate.getTime());
      const sectionKey = hasValidDate ? getLocalDayKey(publishedDate) : "unknown";

      if (!currentSection || currentSection.key !== sectionKey) {
        const title = hasValidDate ? getArticleSectionHeading(publishedDate, now) : "未知日期";

        currentSection = {
          key: sectionKey,
          title,
          articles: [],
        };

        sections.push(currentSection);
      }

      currentSection.articles.push(article);
    }

    return sections;
  }, [filteredArticles]);

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

  const globalRefreshView =
    selectedView === "all" || selectedView === "unread" || selectedView === "starred";
  const selectedFeed = globalRefreshView
    ? null
    : feeds.find((feed) => feed.id === selectedView) ?? null;

  const canRefresh = (() => {
    if (refreshing) return false;
    if (globalRefreshView) {
      return feeds.some((feed) => feed.enabled);
    }
    return Boolean(selectedFeed?.enabled);
  })();

  const refreshButtonTitle = globalRefreshView ? "刷新全部订阅源" : "刷新订阅源";

  const onRefreshClick = () => {
    if (!canRefresh) return;

    const requestId = refreshRequestIdRef.current + 1;
    refreshRequestIdRef.current = requestId;
    const view = selectedView;
    const isGlobalView = globalRefreshView;

    setRefreshing(true);

    void (async () => {
      try {
        if (isGlobalView) {
          await refreshAllFeeds();
        } else {
          await refreshFeed(view);
        }

        for (let attempt = 0; attempt < REFRESH_POLL_MAX_ATTEMPTS; attempt += 1) {
          if (refreshRequestIdRef.current !== requestId) return;

          await loadSnapshot({ view });

          if (refreshRequestIdRef.current !== requestId) return;
          if (attempt >= REFRESH_POLL_MAX_ATTEMPTS - 1) return;
          await sleep(REFRESH_POLL_INTERVAL_MS);
        }
      } catch (err) {
        notify.error(
          mapApiErrorToUserMessage(err, isGlobalView ? "refresh-all-feeds" : "refresh-feed"),
        );
      } finally {
        if (refreshRequestIdRef.current === requestId) {
          setRefreshing(false);
        }
      }
    })();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center justify-between px-4">
        <h2 className="text-[0.96rem] font-semibold tracking-[0.01em]">文章</h2>
        <div className="flex items-center gap-2">
          <Button
            onClick={onRefreshClick}
            type="button"
            variant="ghost"
            size="icon"
            disabled={!canRefresh}
            className="h-6 w-6 text-muted-foreground"
            aria-label="refresh-feeds"
            title={refreshButtonTitle}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </Button>
          {showHeaderActions && (
            <>
              <Button
                onClick={toggleShowUnreadOnly}
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 text-muted-foreground",
                  showUnreadOnly && "bg-primary/10 text-primary hover:bg-primary/15",
                )}
                aria-label="toggle-unread-only"
                title="仅显示未读"
              >
                <CircleDot className="h-3.5 w-3.5" />
              </Button>
              <Button
                onClick={handleMarkAllAsRead}
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground"
                aria-label="mark-all-as-read"
                title="标记全部为已读"
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <span className="text-[10px] font-medium text-muted-foreground">{filteredArticles.length} 篇</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-3 pt-1">
        {articleSections.map((section, sectionIndex) => (
          <div
            key={`${section.key}-${sectionIndex}`}
            className="mt-3 first:mt-0"
          >
            <div className="px-4 py-2">
              <h3 className="text-[18px] font-semibold tracking-tight text-foreground">
                {section.title}
              </h3>
            </div>

            {section.articles.map((article) => {
              const previewImage = article.previewImage ?? getPreviewImage(article.content);
              const previewImageKey = previewImage ? `${article.id}:${previewImage}` : null;
              const showPreviewImage =
                previewImage && (!previewImageKey || !failedPreviewImageKeys.has(previewImageKey));

              return (
                <button
                  key={article.id}
                  onClick={() => setSelectedArticle(article.id)}
                  className={cn(
                    "h-[6.5rem] w-full px-4 py-2.5 text-left transition-colors duration-150",
                    selectedArticleId === article.id ? "bg-accent" : "hover:bg-accent",
                  )}
                >
                  <div className="flex h-full items-stretch gap-3">
                    <div className="flex h-full min-w-0 flex-1 flex-col">
                      <h3
                        className={cn(
                          "line-clamp-2 text-[0.94rem] leading-[1.35]",
                          article.isRead
                            ? "font-medium text-muted-foreground"
                            : "font-semibold text-foreground",
                        )}
                      >
                        {article.title}
                      </h3>

                      <p className="mt-0.5 line-clamp-1 text-[12px] leading-relaxed text-muted-foreground">
                        {article.summary}
                      </p>

                      <div className="mt-auto flex items-center justify-between gap-3 pt-1.5 text-[11px]">
                        <span className="max-w-[10.5rem] truncate font-medium text-muted-foreground">
                          {getFeedTitle(article.feedId)}
                        </span>
                        <div className="shrink-0 flex items-center gap-1.5">
                          {!article.isRead && (
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
                          )}
                          <span className={article.isRead ? "text-muted-foreground" : "text-primary"}>
                            {formatRelativeTime(article.publishedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {showPreviewImage && (
                      <div className="h-full w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                        <img
                          src={previewImage}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          className="h-full w-full object-cover"
                          onError={() => {
                            if (!previewImageKey) return;

                            setFailedPreviewImageKeys((previousKeys) => {
                              if (previousKeys.has(previewImageKey)) return previousKeys;
                              const nextKeys = new Set(previousKeys);
                              nextKeys.add(previewImageKey);
                              return nextKeys;
                            });
                          }}
                        />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

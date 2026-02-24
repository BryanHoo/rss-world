import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import AddFeedDialog from './AddFeedDialog';

const uncategorizedName = '未分类';

const getFeedFaviconUrl = (feedUrl: string) => {
  if (!feedUrl) return '';
  try {
    const { origin } = new URL(feedUrl);
    return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(origin)}`;
  } catch {
    return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(feedUrl)}`;
  }
};

export default function FeedList() {
  const { categories, feeds, selectedView, setSelectedView, toggleCategory, addFeed } = useAppStore();
  const [addFeedOpen, setAddFeedOpen] = useState(false);

  const smartViews = [
    { id: 'all', name: '全部文章', icon: '📚' },
    { id: 'unread', name: '未读文章', icon: '⭕' },
    { id: 'starred', name: '收藏文章', icon: '⭐' },
  ];

  const openAddFeedModal = () => {
    setAddFeedOpen(true);
  };

  const feedsByCategory = feeds.reduce((accumulator, feed) => {
    const key = feed.category?.trim() || uncategorizedName;
    const existing = accumulator.get(key);

    if (existing) {
      existing.push(feed);
    } else {
      accumulator.set(key, [feed]);
    }

    return accumulator;
  }, new Map<string, typeof feeds>());

  const expandedByCategory = new Map(categories.map((item) => [item.name, item.expanded]));
  const categoryNames = Array.from(new Set([...categories.map((item) => item.name), ...feedsByCategory.keys()]));

  if (!categoryNames.includes(uncategorizedName)) {
    categoryNames.push(uncategorizedName);
  }

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="flex h-12 items-center justify-between px-4">
          <h1 className="flex items-center">
            <img src="/feedfuse-logo.svg" alt="FeedFuse" className="h-7 w-auto shrink-0" />
          </h1>
          <button
            onClick={openAddFeedModal}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-300/70 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-600/80 dark:hover:text-gray-100"
            aria-label="add-feed"
            title="添加 RSS 源"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="space-y-0.5 px-2 pb-2 pt-1">
          {smartViews.map((view) => (
            <button
              key={view.id}
              onClick={() => setSelectedView(view.id)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                selectedView === view.id
                  ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200'
                  : 'text-gray-800 hover:bg-gray-300/70 dark:text-gray-200 dark:hover:bg-gray-600/70'
              }`}
            >
              <span className="mr-2 text-base">{view.icon}</span>
              <span>{view.name}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {categoryNames.map((categoryName) => {
            const categoryFeeds = feedsByCategory.get(categoryName) ?? [];
            const expanded = expandedByCategory.get(categoryName) ?? true;

            return (
              <div key={categoryName} className="mb-1.5">
                <button
                  onClick={() => toggleCategory(categoryName)}
                  className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold tracking-[0.04em] text-gray-700 transition-colors hover:bg-gray-300/60 dark:text-gray-300 dark:hover:bg-gray-600/70"
                >
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span>{categoryName}</span>
                </button>

                {expanded && (
                  <div className="mt-0.5 space-y-0.5 pl-4">
                    {categoryFeeds.map((feed) => (
                      <button
                        key={feed.id}
                        onClick={() => setSelectedView(feed.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                          selectedView === feed.id
                            ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200'
                            : 'text-gray-800 hover:bg-gray-300/70 dark:text-gray-200 dark:hover:bg-gray-600/70'
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                            <span aria-hidden="true" className="text-[11px] leading-none">
                              {feed.icon ?? '📰'}
                            </span>
                            <img
                              src={getFeedFaviconUrl(feed.url)}
                              alt=""
                              aria-hidden="true"
                              loading="lazy"
                              className="absolute inset-0 h-full w-full rounded-[3px] bg-white object-cover dark:bg-gray-800"
                              onError={(event) => {
                                event.currentTarget.style.display = 'none';
                              }}
                            />
                          </span>
                          <span className="truncate font-medium">{feed.title}</span>
                        </div>
                        {feed.unreadCount > 0 && (
                          <span className="min-w-6 pr-0.5 text-right text-[10px] font-semibold tabular-nums text-current/65">
                            {feed.unreadCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {addFeedOpen ? (
        <AddFeedDialog
          open
          onOpenChange={setAddFeedOpen}
          categories={categories}
          onSubmit={({ title, url, category }) => {
            const id = `feed-${Date.now()}`;
            addFeed({
              id,
              title,
              url,
              icon: '📰',
              unreadCount: 0,
              category,
            });
            setSelectedView(id);
          }}
        />
      ) : null}
    </>
  );
}

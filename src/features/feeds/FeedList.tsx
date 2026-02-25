import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import AddFeedDialog from './AddFeedDialog';

const uncategorizedName = '未分类';
const uncategorizedId = 'cat-uncategorized';

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
  const { categories: appCategories, feeds, selectedView, setSelectedView, toggleCategory, addFeed } = useAppStore();
  const [addFeedOpen, setAddFeedOpen] = useState(false);

  const smartViews = [
    { id: 'all', name: '全部文章', icon: '📚' },
    { id: 'unread', name: '未读文章', icon: '⭕' },
    { id: 'starred', name: '收藏文章', icon: '⭐' },
  ];

  const openAddFeedModal = () => {
    setAddFeedOpen(true);
  };

  const categoryMaster = useMemo(() => {
    return appCategories
      .filter((item) => item.id !== uncategorizedId && item.name !== uncategorizedName)
      .map((item) => ({ id: item.id, name: item.name }));
  }, [appCategories]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();

    appCategories.forEach((item) => {
      map.set(item.id, item.name);
    });
    categoryMaster.forEach((item) => {
      map.set(item.id, item.name);
    });

    return map;
  }, [appCategories, categoryMaster]);

  const categoryIdByName = useMemo(() => {
    const map = new Map<string, string>();

    categoryNameById.forEach((name, id) => {
      const key = name.trim().toLowerCase();
      if (!key || map.has(key)) {
        return;
      }
      map.set(key, id);
    });

    return map;
  }, [categoryNameById]);

  const feedGroups = useMemo(() => {
    type FeedGroup = { id: string; name: string; feeds: typeof feeds };
    const groups = new Map<string, FeedGroup>();

    feeds.forEach((feed) => {
      const normalizedCategoryId = feed.categoryId?.trim();
      const normalizedLegacyCategory = feed.category?.trim();

      let groupId = uncategorizedId;
      let groupName = uncategorizedName;

      if (normalizedCategoryId && categoryNameById.has(normalizedCategoryId)) {
        groupId = normalizedCategoryId;
        groupName = categoryNameById.get(normalizedCategoryId) ?? uncategorizedName;
      } else if (normalizedLegacyCategory) {
        const mappedCategoryId = categoryIdByName.get(normalizedLegacyCategory.toLowerCase());
        if (mappedCategoryId) {
          groupId = mappedCategoryId;
          groupName = categoryNameById.get(mappedCategoryId) ?? normalizedLegacyCategory;
        }
      }

      const existing = groups.get(groupId);
      if (existing) {
        existing.feeds.push(feed);
      } else {
        groups.set(groupId, { id: groupId, name: groupName, feeds: [feed] });
      }
    });

    categoryMaster.forEach((category) => {
      if (!groups.has(category.id)) {
        groups.set(category.id, { id: category.id, name: category.name, feeds: [] });
      }
    });

    if (!groups.has(uncategorizedId)) {
      groups.set(uncategorizedId, { id: uncategorizedId, name: uncategorizedName, feeds: [] });
    }

    const orderedIds = [
      ...categoryMaster.map((item) => item.id),
      uncategorizedId,
      ...Array.from(groups.keys()).filter(
        (id) => id !== uncategorizedId && !categoryMaster.some((category) => category.id === id)
      ),
    ];

    return orderedIds
      .map((id) => groups.get(id))
      .filter((group): group is FeedGroup => group !== undefined && group.feeds.length > 0);
  }, [feeds, categoryMaster, categoryNameById, categoryIdByName]);

  const expandedByCategoryId = new Map(appCategories.map((item) => [item.id, item.expanded ?? true]));

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
          {feedGroups.map((category) => {
            const categoryFeeds = category.feeds;
            const expanded = expandedByCategoryId.get(category.id) ?? true;

            return (
              <div key={category.id} className="mb-1.5">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold tracking-[0.04em] text-gray-700 transition-colors hover:bg-gray-300/60 dark:text-gray-300 dark:hover:bg-gray-600/70"
                >
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span>{category.name}</span>
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
          categories={categoryMaster}
          onSubmit={({ title, url, categoryId }) => {
            addFeed({ title, url, categoryId });
          }}
        />
      ) : null}
    </>
  );
}

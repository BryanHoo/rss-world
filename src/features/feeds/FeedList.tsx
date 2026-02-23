import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';

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
  const { folders, feeds, selectedView, setSelectedView, toggleFolder, addFeed } = useAppStore();
  const [addFeedOpen, setAddFeedOpen] = useState(false);
  const [feedTitle, setFeedTitle] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [feedFolderId, setFeedFolderId] = useState('');

  const smartViews = [
    { id: 'all', name: '全部文章', icon: '📚' },
    { id: 'unread', name: '未读文章', icon: '⭕' },
    { id: 'starred', name: '收藏文章', icon: '⭐' },
  ];

  const openAddFeedModal = () => {
    setFeedTitle('');
    setFeedUrl('');
    setFeedFolderId(folders[0]?.id ?? '');
    setAddFeedOpen(true);
  };

  const handleAddFeed = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const title = feedTitle.trim();
    const url = feedUrl.trim();

    if (!title || !url) return;

    const id = `feed-${Date.now()}`;

    addFeed({
      id,
      title,
      url,
      icon: '📰',
      unreadCount: 0,
      folderId: feedFolderId || undefined,
    });

    setSelectedView(id);
    setAddFeedOpen(false);
  };

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="flex h-12 items-center justify-between px-4">
          <h1 className="flex items-center">
            <img src="/feedfuse-logo.svg" alt="FeedFuse" className="h-7 w-auto shrink-0" />
          </h1>
          <button
            onClick={openAddFeedModal}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-600/70 dark:hover:text-gray-100"
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
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
                  : 'text-gray-800 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-600/70'
              }`}
            >
              <span className="mr-2 text-base">{view.icon}</span>
              <span>{view.name}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {folders.map((folder) => {
            const folderFeeds = feeds.filter((feed) => feed.folderId === folder.id);

            return (
              <div key={folder.id} className="mb-1.5">
                <button
                  onClick={() => toggleFolder(folder.id)}
                  className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold tracking-[0.04em] text-gray-600 transition-colors hover:bg-gray-200/80 dark:text-gray-300 dark:hover:bg-gray-600/70"
                >
                  {folder.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span>{folder.name}</span>
                </button>

                {folder.expanded && (
                  <div className="mt-0.5 space-y-0.5 pl-4">
                    {folderFeeds.map((feed) => (
                      <button
                        key={feed.id}
                        onClick={() => setSelectedView(feed.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                          selectedView === feed.id
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
                            : 'text-gray-800 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-600/70'
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

      {addFeedOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">添加 RSS 源</h2>
              <button
                onClick={() => setAddFeedOpen(false)}
                className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                aria-label="close-add-feed"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddFeed} className="space-y-4 p-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">名称</label>
                <input
                  type="text"
                  value={feedTitle}
                  onChange={(event) => setFeedTitle(event.target.value)}
                  placeholder="例如：The Verge"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">URL</label>
                <input
                  type="url"
                  value={feedUrl}
                  onChange={(event) => setFeedUrl(event.target.value)}
                  placeholder="https://example.com/feed.xml"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">
                  文件夹
                </label>
                <select
                  value={feedFolderId}
                  onChange={(event) => setFeedFolderId(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
                >
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                  <option value="">不分组</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAddFeedOpen(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!feedTitle.trim() || !feedUrl.trim()}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  添加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

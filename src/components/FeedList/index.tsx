import { ChevronDown, ChevronRight } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

export default function FeedList() {
  const { folders, feeds, selectedView, setSelectedView, toggleFolder } = useAppStore();

  const smartViews = [
    { id: 'all', name: '全部文章', icon: '📚' },
    { id: 'unread', name: '未读文章', icon: '⭕' },
    { id: 'starred', name: '星标文章', icon: '⭐' },
  ];

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-800">
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">RSS World</h1>
      </div>

      <div className="p-2">
        {smartViews.map((view) => (
          <button
            key={view.id}
            onClick={() => setSelectedView(view.id)}
            className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
              selectedView === view.id
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            <span className="mr-2">{view.icon}</span>
            <span>{view.name}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {folders.map((folder) => {
          const folderFeeds = feeds.filter((feed) => feed.folderId === folder.id);

          return (
            <div key={folder.id} className="mb-2">
              <button
                onClick={() => toggleFolder(folder.id)}
                className="flex w-full items-center gap-1 rounded px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                {folder.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span>{folder.name}</span>
              </button>

              {folder.expanded &&
                folderFeeds.map((feed) => (
                  <button
                    key={feed.id}
                    onClick={() => setSelectedView(feed.id)}
                    className={`ml-4 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                      selectedView === feed.id
                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span>{feed.icon}</span>
                      <span className="truncate">{feed.title}</span>
                    </div>
                    {feed.unreadCount > 0 && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-900 dark:text-blue-300">
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

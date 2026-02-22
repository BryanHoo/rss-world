import { Settings as SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import ArticleList from '../ArticleList';
import ArticleView from '../ArticleView';
import FeedList from '../FeedList';
import Settings from '../Settings';

export default function Layout() {
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="relative flex h-screen bg-gray-50 dark:bg-gray-900">
      <div
        className={`${
          sidebarCollapsed ? 'w-0' : 'w-60'
        } overflow-hidden border-r border-gray-200 transition-all duration-300 dark:border-gray-700`}
      >
        <FeedList />
      </div>

      <div className="w-80 border-r border-gray-200 dark:border-gray-700">
        <ArticleList />
      </div>

      <div className="flex-1 overflow-hidden">
        <ArticleView />
      </div>

      <button
        onClick={() => setSettingsOpen(true)}
        className="absolute right-4 top-4 z-40 rounded-lg bg-white p-2 text-gray-600 shadow hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        aria-label="open-settings"
      >
        <SettingsIcon size={18} />
      </button>

      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

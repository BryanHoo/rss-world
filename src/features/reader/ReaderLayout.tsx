import { Settings as SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import ArticleList from '../articles/ArticleList';
import ArticleView from '../articles/ArticleView';
import FeedList from '../feeds/FeedList';
import SettingsCenterModal from '../settings/SettingsCenterModal';
import { useAppStore } from '../../store/appStore';

export default function ReaderLayout() {
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="relative flex h-screen overflow-hidden bg-gray-100 dark:bg-gray-900">
      <div
        className={`${
          sidebarCollapsed ? 'w-0' : 'w-60'
        } overflow-hidden bg-gray-100/95 transition-all duration-300 dark:bg-gray-800`}
      >
        <FeedList />
      </div>

      <div className="w-[25rem] border-r border-gray-200/90 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
        <ArticleList />
      </div>

      <div className="flex-1 overflow-hidden bg-white dark:bg-gray-800">
        <ArticleView />
      </div>

      <button
        onClick={() => setSettingsOpen(true)}
        className="absolute right-4 top-6 z-40 -translate-y-1/2 rounded-lg border border-gray-200/80 bg-white/90 p-2 text-gray-600 shadow-sm backdrop-blur-sm transition-colors hover:bg-gray-100 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        aria-label="open-settings"
      >
        <SettingsIcon size={18} />
      </button>

      {settingsOpen && <SettingsCenterModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

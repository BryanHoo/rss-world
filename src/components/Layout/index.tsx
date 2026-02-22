import { useAppStore } from '../../store/appStore';
import ArticleList from '../ArticleList';
import ArticleView from '../ArticleView';
import FeedList from '../FeedList';

export default function Layout() {
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
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
    </div>
  );
}

import { Settings as SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import ArticleList from '../articles/ArticleList';
import ArticleView from '../articles/ArticleView';
import FeedList from '../feeds/FeedList';
import SettingsCenterModal from '../settings/SettingsCenterModal';
import { useAppStore } from '../../store/appStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ReaderLayout() {
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const selectedView = useAppStore((state) => state.selectedView);
  const selectedArticleId = useAppStore((state) => state.selectedArticleId);
  const selectedArticleTitle = useAppStore(
    (state) => state.articles.find((article) => article.id === state.selectedArticleId)?.title ?? '',
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [articleTitleVisible, setArticleTitleVisible] = useState(true);

  const showFloatingArticleTitle = Boolean(
    selectedArticleId && selectedArticleTitle && !articleTitleVisible,
  );

  return (
    <div className="relative flex h-screen overflow-hidden bg-background text-foreground">
      <div
        className={cn(
          'overflow-hidden bg-muted/45 transition-all duration-300',
          sidebarCollapsed ? 'w-0' : 'w-60',
        )}
      >
        <FeedList />
      </div>

      <div className="w-[25rem] border-r border-border bg-muted/5">
        <ArticleList key={selectedView} />
      </div>

      <div className="relative flex-1 overflow-hidden bg-background">
        <ArticleView onTitleVisibilityChange={setArticleTitleVisible} />

        {showFloatingArticleTitle ? (
          <div
            className="pointer-events-none absolute left-6 top-6 z-40 max-w-[calc(100%-8rem)] -translate-y-1/2 truncate rounded-md bg-background/90 px-3 py-1 text-lg font-semibold tracking-tight text-foreground/95 backdrop-blur-sm"
            title={selectedArticleTitle}
            data-testid="reader-floating-title"
          >
            {selectedArticleTitle}
          </div>
        ) : null}
      </div>

      <Button
        onClick={() => setSettingsOpen(true)}
        type="button"
        variant="outline"
        size="icon"
        className="absolute right-4 top-6 z-40 -translate-y-1/2 bg-background/90 backdrop-blur-sm"
        aria-label="open-settings"
      >
        <SettingsIcon />
      </Button>

      {settingsOpen && <SettingsCenterModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

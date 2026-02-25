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
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="relative flex h-screen overflow-hidden bg-background text-foreground">
      <div
        className={cn(
          'overflow-hidden bg-muted/30 transition-all duration-300',
          sidebarCollapsed ? 'w-0' : 'w-60 border-r border-border',
        )}
      >
        <FeedList />
      </div>

      <div className="w-[25rem] border-r border-border bg-muted/10">
        <ArticleList />
      </div>

      <div className="flex-1 overflow-hidden bg-background">
        <ArticleView />
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

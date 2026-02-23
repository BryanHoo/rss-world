import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import AppDrawer from '../../components/common/AppDrawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useSettingsStore } from '../../store/settingsStore';
import AppearanceSettingsPanel from './panels/AppearanceSettingsPanel';
import AISettingsPanel from './panels/AISettingsPanel';
import ShortcutsSettingsPanel from './panels/ShortcutsSettingsPanel';
import RssSourcesSettingsPanel from './panels/RssSourcesSettingsPanel';

interface SettingsCenterDrawerProps {
  onClose: () => void;
}

type PanelKey = 'appearance' | 'ai' | 'shortcuts' | 'rss';

const panelItems: Array<{ key: PanelKey; label: string }> = [
  { key: 'appearance', label: '外观' },
  { key: 'ai', label: 'AI' },
  { key: 'shortcuts', label: '快捷键' },
  { key: 'rss', label: 'RSS 源' },
];

export default function SettingsCenterDrawer({ onClose }: SettingsCenterDrawerProps) {
  const [activePanel, setActivePanel] = useState<PanelKey>('appearance');
  const draft = useSettingsStore((state) => state.draft);
  const loadDraft = useSettingsStore((state) => state.loadDraft);
  const updateDraft = useSettingsStore((state) => state.updateDraft);
  const discardDraft = useSettingsStore((state) => state.discardDraft);
  const validationErrors = useSettingsStore((state) => state.validationErrors);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  const handleClose = () => {
    discardDraft();
    onClose();
  };

  return (
    <AppDrawer
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
        }
      }}
      title="设置中心"
      description="管理阅读体验、AI、快捷键与 RSS"
      closeLabel="close-settings"
      testId="settings-center-modal"
      overlayTestId="settings-center-overlay"
      headerExtra={
        <Button type="button" variant="secondary" onClick={handleClose}>
          取消
        </Button>
      }
    >
      {draft ? (
        <Tabs
          value={activePanel}
          onValueChange={(value) => setActivePanel(value as PanelKey)}
          orientation="vertical"
          className="grid h-full min-h-0 grid-cols-[12rem_minmax(0,1fr)] gap-5 p-5"
        >
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-gray-500">分组</p>
            <TabsList className="flex w-full flex-col items-stretch gap-1 rounded-xl p-1.5">
              {panelItems.map((panel) => (
                <TabsTrigger
                  key={panel.key}
                  value={panel.key}
                  onClick={() => setActivePanel(panel.key)}
                  className="w-full justify-start px-3 py-2"
                >
                  {panel.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="min-w-0 rounded-xl border border-gray-200 p-4">
            <TabsContent value="appearance" className="mt-0">
              <AppearanceSettingsPanel draft={draft} onChange={updateDraft} />
            </TabsContent>
            <TabsContent value="ai" className="mt-0">
              <AISettingsPanel draft={draft} onChange={updateDraft} errors={validationErrors} />
            </TabsContent>
            <TabsContent value="shortcuts" className="mt-0">
              <ShortcutsSettingsPanel draft={draft} onChange={updateDraft} errors={validationErrors} />
            </TabsContent>
            <TabsContent value="rss" className="mt-0">
              <RssSourcesSettingsPanel draft={draft} onChange={updateDraft} errors={validationErrors} />
            </TabsContent>
          </div>
        </Tabs>
      ) : null}
    </AppDrawer>
  );
}

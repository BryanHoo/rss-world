import { useEffect, useState } from 'react';
import AppDialog from '../../components/common/AppDialog';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useSettingsStore } from '../../store/settingsStore';
import AppearanceSettingsPanel from './panels/AppearanceSettingsPanel';
import AISettingsPanel from './panels/AISettingsPanel';
import ShortcutsSettingsPanel from './panels/ShortcutsSettingsPanel';
import RssSourcesSettingsPanel from './panels/RssSourcesSettingsPanel';

interface SettingsCenterModalProps {
  onClose: () => void;
}

type PanelKey = 'appearance' | 'ai' | 'shortcuts' | 'rss';

const panelItems: Array<{ key: PanelKey; label: string }> = [
  { key: 'appearance', label: '外观' },
  { key: 'ai', label: 'AI' },
  { key: 'shortcuts', label: '快捷键' },
  { key: 'rss', label: 'RSS 源' },
];

export default function SettingsCenterModal({ onClose }: SettingsCenterModalProps) {
  const [activePanel, setActivePanel] = useState<PanelKey>('appearance');
  const draft = useSettingsStore((state) => state.draft);
  const loadDraft = useSettingsStore((state) => state.loadDraft);
  const updateDraft = useSettingsStore((state) => state.updateDraft);
  const saveDraft = useSettingsStore((state) => state.saveDraft);
  const discardDraft = useSettingsStore((state) => state.discardDraft);
  const validationErrors = useSettingsStore((state) => state.validationErrors);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  const handleCancel = () => {
    discardDraft();
    onClose();
  };

  const handleSave = () => {
    const result = saveDraft();
    if (result.ok) {
      onClose();
    }
  };

  return (
    <AppDialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleCancel();
        }
      }}
      title="设置中心"
      description="管理阅读体验、AI 与快捷键设置"
      closeLabel="close-settings"
      testId="settings-center-modal"
      overlayTestId="settings-center-overlay"
      className="h-[80vh] w-[80vw] max-h-[80vh] max-w-[80vw]"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleCancel}>
            取消
          </Button>
          <Button type="button" onClick={handleSave}>
            保存
          </Button>
        </>
      }
    >
      {draft ? (
        <Tabs
          value={activePanel}
          onValueChange={(value) => setActivePanel(value as PanelKey)}
          orientation="vertical"
          className="grid min-h-[28rem] grid-cols-[12rem_minmax(0,1fr)] gap-5"
        >
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">分组</p>
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

          <div className="min-w-0 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
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
    </AppDialog>
  );
}

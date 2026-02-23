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
        <Tabs value={activePanel} onValueChange={(value) => setActivePanel(value as PanelKey)} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="appearance" onClick={() => setActivePanel('appearance')}>
              外观
            </TabsTrigger>
            <TabsTrigger value="ai" onClick={() => setActivePanel('ai')}>
              AI
            </TabsTrigger>
            <TabsTrigger value="shortcuts" onClick={() => setActivePanel('shortcuts')}>
              快捷键
            </TabsTrigger>
            <TabsTrigger value="rss" onClick={() => setActivePanel('rss')}>
              RSS 源
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appearance">
            <AppearanceSettingsPanel draft={draft} onChange={updateDraft} />
          </TabsContent>
          <TabsContent value="ai">
            <AISettingsPanel draft={draft} onChange={updateDraft} errors={validationErrors} />
          </TabsContent>
          <TabsContent value="shortcuts">
            <ShortcutsSettingsPanel draft={draft} onChange={updateDraft} errors={validationErrors} />
          </TabsContent>
          <TabsContent value="rss">
            <RssSourcesSettingsPanel draft={draft} onChange={updateDraft} errors={validationErrors} />
          </TabsContent>
        </Tabs>
      ) : null}
    </AppDialog>
  );
}

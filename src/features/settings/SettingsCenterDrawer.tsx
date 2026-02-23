import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import AppDrawer from '../../components/common/AppDrawer';
import AppDialog from '../../components/common/AppDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useSettingsStore } from '../../store/settingsStore';
import AppearanceSettingsPanel from './panels/AppearanceSettingsPanel';
import AISettingsPanel from './panels/AISettingsPanel';
import ShortcutsSettingsPanel from './panels/ShortcutsSettingsPanel';
import RssSourcesSettingsPanel from './panels/RssSourcesSettingsPanel';
import { useSettingsAutosave } from './useSettingsAutosave';

interface SettingsCenterDrawerProps {
  onClose: () => void;
}

type PanelKey = 'appearance' | 'ai' | 'shortcuts' | 'rss';

const panelItems: Array<{ key: PanelKey; label: string }> = [
  { key: 'appearance', label: 'Appearance' },
  { key: 'ai', label: 'AI' },
  { key: 'shortcuts', label: 'Shortcuts' },
  { key: 'rss', label: 'RSS Sources' },
];

export default function SettingsCenterDrawer({ onClose }: SettingsCenterDrawerProps) {
  const [activePanel, setActivePanel] = useState<PanelKey>('appearance');
  const [draftVersion, setDraftVersion] = useState(0);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const draft = useSettingsStore((state) => state.draft);
  const loadDraft = useSettingsStore((state) => state.loadDraft);
  const updateDraft = useSettingsStore((state) => state.updateDraft);
  const saveDraft = useSettingsStore((state) => state.saveDraft);
  const discardDraft = useSettingsStore((state) => state.discardDraft);
  const validationErrors = useSettingsStore((state) => state.validationErrors);
  const hasErrors = Object.keys(validationErrors).length > 0;
  const autosave = useSettingsAutosave({
    draftVersion,
    saveDraft,
    hasErrors,
  });

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  const forceClose = () => {
    discardDraft();
    onClose();
  };

  const handleDraftChange = (updater: Parameters<typeof updateDraft>[0]) => {
    updateDraft(updater);
    setDraftVersion((value) => value + 1);
  };

  const statusLabel = {
    idle: '未修改',
    saving: 'Saving...',
    saved: 'Saved',
    error: 'Fix errors to save',
  }[autosave.status];
  const hasBlockingState = autosave.status === 'saving' || hasErrors;

  const requestClose = () => {
    if (hasBlockingState) {
      setCloseConfirmOpen(true);
      return;
    }

    forceClose();
  };

  return (
    <>
      <AppDrawer
        open
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            requestClose();
          }
        }}
        title="设置中心"
        description="管理阅读体验、AI、快捷键与 RSS"
        closeLabel="close-settings"
        testId="settings-center-modal"
        overlayTestId="settings-center-overlay"
        headerExtra={
          <>
            <span className="text-xs text-gray-500">{statusLabel}</span>
            <Button type="button" variant="secondary" onClick={requestClose}>
              取消
            </Button>
          </>
        }
      >
        {draft ? (
          <Tabs
            value={activePanel}
            onValueChange={(value) => setActivePanel(value as PanelKey)}
            orientation="vertical"
            className="grid h-full min-h-0 grid-cols-[15rem_minmax(0,1fr)] gap-6 bg-[linear-gradient(180deg,#f9fafb_0%,#f3f4f6_100%)] p-6"
          >
            <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-gray-500">Sections</p>
              <TabsList className="flex w-full flex-col items-stretch gap-2 bg-transparent p-0">
                {panelItems.map((panel) => (
                  <TabsTrigger
                    key={panel.key}
                    value={panel.key}
                    onClick={() => setActivePanel(panel.key)}
                    className="w-full justify-start rounded-lg border border-transparent px-3 py-2.5 text-left text-sm text-gray-600 data-[state=active]:border-gray-300 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
                  >
                    {panel.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <TabsContent value="appearance" className="mt-0">
                <AppearanceSettingsPanel draft={draft} onChange={handleDraftChange} />
              </TabsContent>
              <TabsContent value="ai" className="mt-0">
                <AISettingsPanel draft={draft} onChange={handleDraftChange} errors={validationErrors} />
              </TabsContent>
              <TabsContent value="shortcuts" className="mt-0">
                <ShortcutsSettingsPanel draft={draft} onChange={handleDraftChange} errors={validationErrors} />
              </TabsContent>
              <TabsContent value="rss" className="mt-0">
                <RssSourcesSettingsPanel draft={draft} onChange={handleDraftChange} errors={validationErrors} />
              </TabsContent>
            </div>
          </Tabs>
        ) : null}
      </AppDrawer>

      {closeConfirmOpen ? (
        <AppDialog
          open
          onOpenChange={setCloseConfirmOpen}
          title="确认关闭"
          description="关闭后会丢失未成功保存的修改"
          closeLabel="close-discard-confirm"
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setCloseConfirmOpen(false)}>
                继续编辑
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setCloseConfirmOpen(false);
                  forceClose();
                }}
              >
                确认关闭
              </Button>
            </>
          }
        >
          <p className="text-sm text-gray-600">请先修复错误，或确认放弃这些修改。</p>
        </AppDialog>
      ) : null}
    </>
  );
}

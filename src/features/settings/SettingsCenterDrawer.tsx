import { Bot, Palette, Rss, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import AppDrawer from '../../components/common/AppDrawer';
import AppDialog from '../../components/common/AppDialog';
import { useSettingsStore } from '../../store/settingsStore';
import AppearanceSettingsPanel from './panels/AppearanceSettingsPanel';
import AISettingsPanel from './panels/AISettingsPanel';
import RssSourcesSettingsPanel from './panels/RssSourcesSettingsPanel';
import { useSettingsAutosave } from './useSettingsAutosave';

interface SettingsCenterDrawerProps {
  onClose: () => void;
}

type SettingsSectionKey = 'appearance' | 'ai' | 'rss';

interface SettingsSectionItem {
  key: SettingsSectionKey;
  label: string;
  hint: string;
  icon: LucideIcon;
}

const sectionItems: SettingsSectionItem[] = [
  { key: 'appearance', label: '外观', hint: '阅读体验', icon: Palette },
  { key: 'ai', label: 'AI', hint: '模型与密钥', icon: Bot },
  { key: 'rss', label: 'RSS 源', hint: '订阅管理', icon: Rss },
];

export default function SettingsCenterDrawer({ onClose }: SettingsCenterDrawerProps) {
  const [draftVersion, setDraftVersion] = useState(0);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>('appearance');
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
  const secondaryButtonClass =
    'inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100';
  const primaryButtonClass =
    'inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700';

  useEffect(() => {
    loadDraft();
    setActiveSection('appearance');
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
    saving: '保存中...',
    saved: '已保存',
    error: '修复错误以保存',
  }[autosave.status];
  const statusToneClass = {
    idle: 'text-gray-500',
    saving: 'text-amber-600',
    saved: 'text-emerald-600',
    error: 'text-red-500',
  }[autosave.status];
  const hasBlockingState = autosave.status === 'saving' || hasErrors;
  const sectionErrors: Record<SettingsSectionKey, number> = {
    appearance: 0,
    ai: Object.keys(validationErrors).filter((field) => field.startsWith('ai.')).length,
    rss: Object.keys(validationErrors).filter((field) => field.startsWith('rss.')).length,
  };

  const requestClose = () => {
    if (hasBlockingState) {
      setCloseConfirmOpen(true);
      return;
    }

    forceClose();
  };

  const activePanel = (() => {
    if (!draft) {
      return null;
    }

    if (activeSection === 'appearance') {
      return <AppearanceSettingsPanel draft={draft} onChange={handleDraftChange} />;
    }

    if (activeSection === 'ai') {
      return <AISettingsPanel draft={draft} onChange={handleDraftChange} errors={validationErrors} />;
    }

    return <RssSourcesSettingsPanel draft={draft} onChange={handleDraftChange} errors={validationErrors} />;
  })();

  return (
    <>
      <AppDrawer
        open
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            requestClose();
          }
        }}
        title="设置"
        className="max-w-[940px]"
        closeLabel="close-settings"
        testId="settings-center-modal"
        overlayTestId="settings-center-overlay"
        headerExtra={
          <span className={`text-xs ${statusToneClass}`}>{statusLabel}</span>
        }
      >
        {draft ? (
          <div className="h-full bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#f8fafc_38%,#f8fafc_100%)] dark:bg-[radial-gradient(circle_at_top_left,#172554_0%,#020617_55%,#020617_100%)]">
            <div className="flex h-full min-h-0 flex-col md:flex-row">
              <aside className="border-b border-gray-200/80 bg-white/70 backdrop-blur md:w-52 md:border-b-0 md:border-r md:border-gray-200/80 dark:border-gray-700 dark:bg-gray-900/65">
                <nav aria-label="settings-sections" className="flex gap-2 overflow-x-auto px-3 py-4 md:flex-col md:overflow-visible">
                  {sectionItems.map(({ key, label, hint, icon: Icon }) => {
                    const selected = activeSection === key;
                    const errorCount = sectionErrors[key];

                    return (
                      <button
                        key={key}
                        type="button"
                        data-testid={`settings-section-tab-${key}`}
                        aria-pressed={selected}
                        onClick={() => setActiveSection(key)}
                        className={`min-w-[152px] rounded-xl border px-3 py-2.5 text-left transition-colors md:min-w-0 ${
                          selected
                            ? 'border-blue-500/60 bg-blue-50/95 shadow-sm shadow-blue-500/10 dark:border-blue-400/50 dark:bg-blue-500/15'
                            : 'border-transparent bg-white/60 hover:border-gray-200 hover:bg-white dark:bg-transparent dark:hover:border-gray-700 dark:hover:bg-gray-800/70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-start gap-2.5">
                            <Icon
                              size={16}
                              className={`mt-0.5 ${
                                selected ? 'text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'
                              }`}
                            />
                            <div>
                              <p className={`text-sm font-medium ${selected ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-200'}`}>
                                {label}
                              </p>
                              <p className={`text-xs ${selected ? 'text-blue-700/80 dark:text-blue-200/80' : 'text-gray-500 dark:text-gray-400'}`}>
                                {hint}
                              </p>
                            </div>
                          </div>
                          {errorCount > 0 ? (
                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
                              {errorCount}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </aside>
              <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
                <div className="w-full">{activePanel}</div>
              </div>
            </div>
          </div>
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
              <button type="button" className={secondaryButtonClass} onClick={() => setCloseConfirmOpen(false)}>
                继续编辑
              </button>
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => {
                  setCloseConfirmOpen(false);
                  forceClose();
                }}
              >
                确认关闭
              </button>
            </>
          }
        >
          <p className="text-sm text-gray-600">请先修复错误，或确认放弃这些修改。</p>
        </AppDialog>
      ) : null}
    </>
  );
}

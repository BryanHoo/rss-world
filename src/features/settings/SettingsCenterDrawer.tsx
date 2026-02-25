import { Bot, FolderTree, Palette, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSettingsStore } from '../../store/settingsStore';
import AppearanceSettingsPanel from './panels/AppearanceSettingsPanel';
import AISettingsPanel from './panels/AISettingsPanel';
import CategoriesSettingsPanel from './panels/CategoriesSettingsPanel';
import { useSettingsAutosave } from './useSettingsAutosave';

interface SettingsCenterDrawerProps {
  onClose: () => void;
}

type SettingsSectionKey = 'appearance' | 'ai' | 'categories';

interface SettingsSectionItem {
  key: SettingsSectionKey;
  label: string;
  hint: string;
  icon: LucideIcon;
}

const sectionItems: SettingsSectionItem[] = [
  { key: 'appearance', label: '外观', hint: '阅读体验', icon: Palette },
  { key: 'ai', label: 'AI', hint: '模型与密钥', icon: Bot },
  { key: 'categories', label: '分类', hint: '分类管理', icon: FolderTree },
];

const autosaveStatusMeta = {
  idle: {
    label: '未修改',
    toneClass: 'text-gray-500 dark:text-gray-400',
  },
  saving: {
    label: '保存中...',
    toneClass: 'text-amber-600 dark:text-amber-300',
  },
  saved: {
    label: '已保存',
    toneClass: 'text-emerald-600 dark:text-emerald-300',
  },
  error: {
    label: '修复错误以保存',
    toneClass: 'text-red-500 dark:text-red-300',
  },
} as const;

function getSectionTabClass(selected: boolean): string {
  if (selected) {
    return 'border-blue-200 bg-blue-100 text-blue-900 dark:border-blue-500/45 dark:bg-blue-900/28 dark:text-blue-200';
  }

  return 'border-transparent bg-transparent text-gray-700 hover:border-gray-200 hover:bg-white/80 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-700/60';
}

function getSectionIconClass(selected: boolean): string {
  if (selected) {
    return 'text-blue-700 dark:text-blue-300';
  }

  return 'text-gray-500 dark:text-gray-400';
}

function getSectionLabelClass(selected: boolean): string {
  if (selected) {
    return 'text-blue-900 dark:text-blue-100';
  }

  return 'text-gray-700 dark:text-gray-200';
}

function getSectionHintClass(selected: boolean): string {
  if (selected) {
    return 'text-blue-700/90 dark:text-blue-200/85';
  }

  return 'text-gray-500 dark:text-gray-400';
}

export default function SettingsCenterDrawer({ onClose }: SettingsCenterDrawerProps) {
  const [draftVersion, setDraftVersion] = useState(0);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>('appearance');
  const draft = useSettingsStore((state) => state.draft);
  const hydratePersistedSettings = useSettingsStore((state) => state.hydratePersistedSettings);
  const loadDraft = useSettingsStore((state) => state.loadDraft);
  const updateDraft = useSettingsStore((state) => state.updateDraft);
  const saveDraft = useSettingsStore((state) => state.saveDraft);
  const discardDraft = useSettingsStore((state) => state.discardDraft);
  const validationErrors = useSettingsStore((state) => state.validationErrors);
  const validationErrorKeys = Object.keys(validationErrors);
  const hasErrors = validationErrorKeys.length > 0;
  const autosave = useSettingsAutosave({
    draftVersion,
    saveDraft,
    hasErrors,
  });

  useEffect(() => {
    void (async () => {
      await hydratePersistedSettings();
      loadDraft();
    })();
  }, [hydratePersistedSettings, loadDraft]);

  const forceClose = () => {
    discardDraft();
    onClose();
  };

  const handleDraftChange = (updater: Parameters<typeof updateDraft>[0]) => {
    updateDraft(updater);
    setDraftVersion((value) => value + 1);
  };

  const currentStatusMeta = autosaveStatusMeta[autosave.status];
  const hasBlockingState = autosave.status === 'saving' || autosave.status === 'error' || hasErrors;
  const sectionErrors: Record<SettingsSectionKey, number> = {
    appearance: 0,
    ai: validationErrorKeys.filter((field) => field.startsWith('ai.')).length,
    categories: validationErrorKeys.filter((field) => field.startsWith('categories.')).length,
  };

  const requestClose = () => {
    if (hasBlockingState) {
      setCloseConfirmOpen(true);
      return;
    }

    forceClose();
  };

  return (
    <>
      <Sheet
        open
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            requestClose();
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full p-0 sm:max-w-[940px]"
          data-testid="settings-center-modal"
          closeLabel="close-settings"
          overlayProps={{ 'data-testid': 'settings-center-overlay' }}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-gray-200/80 bg-white/85 px-4 py-4 backdrop-blur md:px-6 dark:border-gray-700 dark:bg-gray-900/60">
              <div className="flex items-center gap-3">
                <SheetTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  设置
                </SheetTitle>
                <span className={`text-xs ${currentStatusMeta.toneClass}`}>{currentStatusMeta.label}</span>
              </div>
              <SheetDescription className="sr-only">FeedFuse 设置中心</SheetDescription>
            </div>

            {draft ? (
              <Tabs
                value={activeSection}
                onValueChange={(value) => setActiveSection(value as SettingsSectionKey)}
                className="min-h-0 flex-1"
              >
                <div className="flex h-full min-h-0 flex-col md:flex-row">
                  <aside className="border-b border-gray-200/80 bg-gray-100/85 backdrop-blur md:w-52 md:border-b-0 md:border-r md:border-gray-200/80 dark:border-gray-700 dark:bg-gray-800/78">
                    <TabsList
                      aria-label="settings-sections"
                      className="flex h-auto w-full gap-2 overflow-x-auto rounded-none bg-transparent px-3 py-4 text-muted-foreground md:flex-col md:overflow-visible"
                    >
                      {sectionItems.map(({ key, label, hint, icon: Icon }) => {
                        const selected = activeSection === key;
                        const errorCount = sectionErrors[key];

                        return (
                          <TabsTrigger
                            key={key}
                            value={key}
                            data-testid={`settings-section-tab-${key}`}
                            onClick={() => setActiveSection(key)}
                            className={`min-w-[152px] justify-start rounded-xl border px-3 py-2.5 text-left transition-colors md:min-w-0 ${
                              getSectionTabClass(selected)
                            }`}
                          >
                            <div className="flex w-full items-start justify-between gap-2.5">
                              <div className="flex items-start gap-2.5">
                                <Icon size={16} className={`mt-0.5 ${getSectionIconClass(selected)}`} />
                                <div>
                                  <p className={`text-sm font-medium ${getSectionLabelClass(selected)}`}>
                                    {label}
                                  </p>
                                  <p className={`text-xs ${getSectionHintClass(selected)}`}>
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
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>
                  </aside>

                  <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
                    <div className="w-full">
                      <TabsContent value="appearance" className="mt-0">
                        <AppearanceSettingsPanel draft={draft} onChange={handleDraftChange} />
                      </TabsContent>
                      <TabsContent value="ai" className="mt-0">
                        <AISettingsPanel draft={draft} onChange={handleDraftChange} errors={validationErrors} />
                      </TabsContent>
                      <TabsContent value="categories" className="mt-0">
                        <CategoriesSettingsPanel />
                      </TabsContent>
                    </div>
                  </div>
                </div>
              </Tabs>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认关闭</AlertDialogTitle>
            <AlertDialogDescription>关闭后会丢失未成功保存的修改</AlertDialogDescription>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">
            请先修复错误，或确认放弃这些修改。
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setCloseConfirmOpen(false);
                forceClose();
              }}
            >
              确认关闭
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

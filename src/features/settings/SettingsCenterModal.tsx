import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import AppearanceSettingsPanel from './panels/AppearanceSettingsPanel';

interface SettingsCenterModalProps {
  onClose: () => void;
}

export default function SettingsCenterModal({ onClose }: SettingsCenterModalProps) {
  const draft = useSettingsStore((state) => state.draft);
  const loadDraft = useSettingsStore((state) => state.loadDraft);
  const updateDraft = useSettingsStore((state) => state.updateDraft);
  const saveDraft = useSettingsStore((state) => state.saveDraft);
  const discardDraft = useSettingsStore((state) => state.discardDraft);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="settings-center-modal">
      <div className="flex h-[36rem] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800">
        <aside className="w-48 border-r border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/80">
          <button
            type="button"
            className="w-full rounded-md bg-blue-50 px-3 py-2 text-left text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          >
            外观
          </button>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">设置中心</h2>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
              aria-label="close-settings"
            >
              <X size={20} />
            </button>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto p-5">
            {draft ? <AppearanceSettingsPanel draft={draft} onChange={updateDraft} /> : null}
          </main>

          <footer className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              保存
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}

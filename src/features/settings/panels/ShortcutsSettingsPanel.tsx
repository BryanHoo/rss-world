import type { SettingsDraft } from '../../../store/settingsStore';

interface ShortcutsSettingsPanelProps {
  draft: SettingsDraft;
  onChange: (updater: (draft: SettingsDraft) => void) => void;
  errors: Record<string, string>;
}

export default function ShortcutsSettingsPanel({ draft, onChange, errors }: ShortcutsSettingsPanelProps) {
  const shortcuts = draft.persisted.shortcuts;

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={shortcuts.enabled}
          onChange={(event) =>
            onChange((nextDraft) => {
              nextDraft.persisted.shortcuts.enabled = event.target.checked;
            })
          }
        />
        启用快捷键
      </label>

      <div className="grid gap-3">
        <div className="grid gap-1">
          <label htmlFor="shortcut-next-article" className="text-sm text-gray-700 dark:text-gray-300">
            下一条
          </label>
          <input
            id="shortcut-next-article"
            value={shortcuts.bindings.nextArticle}
            onChange={(event) =>
              onChange((nextDraft) => {
                nextDraft.persisted.shortcuts.bindings.nextArticle = event.target.value;
              })
            }
            className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="grid gap-1">
          <label htmlFor="shortcut-prev-article" className="text-sm text-gray-700 dark:text-gray-300">
            上一条
          </label>
          <input
            id="shortcut-prev-article"
            value={shortcuts.bindings.prevArticle}
            onChange={(event) =>
              onChange((nextDraft) => {
                nextDraft.persisted.shortcuts.bindings.prevArticle = event.target.value;
              })
            }
            className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="grid gap-1">
          <label htmlFor="shortcut-toggle-star" className="text-sm text-gray-700 dark:text-gray-300">
            收藏
          </label>
          <input
            id="shortcut-toggle-star"
            value={shortcuts.bindings.toggleStar}
            onChange={(event) =>
              onChange((nextDraft) => {
                nextDraft.persisted.shortcuts.bindings.toggleStar = event.target.value;
              })
            }
            className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="grid gap-1">
          <label htmlFor="shortcut-mark-read" className="text-sm text-gray-700 dark:text-gray-300">
            标记已读
          </label>
          <input
            id="shortcut-mark-read"
            value={shortcuts.bindings.markRead}
            onChange={(event) =>
              onChange((nextDraft) => {
                nextDraft.persisted.shortcuts.bindings.markRead = event.target.value;
              })
            }
            className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="grid gap-1">
          <label htmlFor="shortcut-open-original" className="text-sm text-gray-700 dark:text-gray-300">
            打开原文
          </label>
          <input
            id="shortcut-open-original"
            value={shortcuts.bindings.openOriginal}
            onChange={(event) =>
              onChange((nextDraft) => {
                nextDraft.persisted.shortcuts.bindings.openOriginal = event.target.value;
              })
            }
            className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      {errors['shortcuts.bindings'] ? (
        <p className="text-sm text-red-600 dark:text-red-400">{errors['shortcuts.bindings']}</p>
      ) : null}
    </div>
  );
}

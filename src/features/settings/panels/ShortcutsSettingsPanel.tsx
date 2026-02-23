import type { SettingsDraft } from '../../../store/settingsStore';

interface ShortcutsSettingsPanelProps {
  draft: SettingsDraft;
  onChange: (updater: (draft: SettingsDraft) => void) => void;
  errors: Record<string, string>;
}

export default function ShortcutsSettingsPanel({ draft, onChange, errors }: ShortcutsSettingsPanelProps) {
  const shortcuts = draft.persisted.shortcuts;
  const inputClass =
    'h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-300';
  const labelClass = 'text-xs font-semibold uppercase tracking-[0.08em] text-gray-500';

  return (
    <div className="space-y-5">
      <label className="flex items-center gap-3 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">
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

      <div className="grid gap-4">
        <div className="grid gap-1">
          <label htmlFor="shortcut-next-article" className={labelClass}>
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
            className={inputClass}
          />
        </div>

        <div className="grid gap-1">
          <label htmlFor="shortcut-prev-article" className={labelClass}>
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
            className={inputClass}
          />
        </div>

        <div className="grid gap-1">
          <label htmlFor="shortcut-toggle-star" className={labelClass}>
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
            className={inputClass}
          />
        </div>

        <div className="grid gap-1">
          <label htmlFor="shortcut-mark-read" className={labelClass}>
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
            className={inputClass}
          />
        </div>

        <div className="grid gap-1">
          <label htmlFor="shortcut-open-original" className={labelClass}>
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
            className={inputClass}
          />
        </div>
      </div>

      {errors['shortcuts.bindings'] ? <p className="text-sm text-red-600">{errors['shortcuts.bindings']}</p> : null}
    </div>
  );
}

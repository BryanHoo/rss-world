import { Monitor, Moon, Sun } from 'lucide-react';
import type { SettingsDraft } from '../../../store/settingsStore';
import type { UserSettings } from '../../../types';

interface AppearanceSettingsPanelProps {
  draft: SettingsDraft;
  onChange: (updater: (draft: SettingsDraft) => void) => void;
}

export default function AppearanceSettingsPanel({ draft, onChange }: AppearanceSettingsPanelProps) {
  const appearance = draft.persisted.appearance;

  const themeOptions: Array<{ value: UserSettings['theme']; label: string; icon: typeof Sun }> = [
    { value: 'light', label: '浅色', icon: Sun },
    { value: 'dark', label: '深色', icon: Moon },
    { value: 'auto', label: '自动', icon: Monitor },
  ];

  const fontSizeOptions: Array<{ value: UserSettings['fontSize']; label: string }> = [
    { value: 'small', label: '小' },
    { value: 'medium', label: '中' },
    { value: 'large', label: '大' },
  ];

  const fontFamilyOptions: Array<{ value: UserSettings['fontFamily']; label: string }> = [
    { value: 'sans', label: '无衬线' },
    { value: 'serif', label: '衬线' },
  ];

  const lineHeightOptions: Array<{ value: UserSettings['lineHeight']; label: string }> = [
    { value: 'compact', label: '紧凑' },
    { value: 'normal', label: '标准' },
    { value: 'relaxed', label: '宽松' },
  ];

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">主题</h3>
        <div className="grid grid-cols-3 gap-2">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                onChange((nextDraft) => {
                  nextDraft.persisted.appearance.theme = value;
                })
              }
              aria-pressed={appearance.theme === value}
              className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 ${
                appearance.theme === value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <Icon size={20} />
              <span className="text-sm">{label}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">字号</h3>
        <div className="grid grid-cols-3 gap-2">
          {fontSizeOptions.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                onChange((nextDraft) => {
                  nextDraft.persisted.appearance.fontSize = value;
                })
              }
              aria-pressed={appearance.fontSize === value}
              className={`rounded-lg border-2 p-2 ${
                appearance.fontSize === value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">字体</h3>
        <div className="grid grid-cols-2 gap-2">
          {fontFamilyOptions.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                onChange((nextDraft) => {
                  nextDraft.persisted.appearance.fontFamily = value;
                })
              }
              aria-pressed={appearance.fontFamily === value}
              className={`rounded-lg border-2 p-2 ${
                appearance.fontFamily === value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">行距</h3>
        <div className="grid grid-cols-3 gap-2">
          {lineHeightOptions.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                onChange((nextDraft) => {
                  nextDraft.persisted.appearance.lineHeight = value;
                })
              }
              aria-pressed={appearance.lineHeight === value}
              className={`rounded-lg border-2 p-2 ${
                appearance.lineHeight === value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

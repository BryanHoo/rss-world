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
  const optionClass =
    'h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 transition ' +
    'hover:border-gray-500 aria-[pressed=true]:border-gray-900 aria-[pressed=true]:bg-gray-100';
  const themeOptionClass =
    'flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 transition ' +
    'hover:border-gray-500 aria-[pressed=true]:border-gray-900 aria-[pressed=true]:bg-gray-100';

  return (
    <div className="space-y-7">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Theme</h3>
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
              className={themeOptionClass}
            >
              <Icon size={16} />
              <span className="text-sm">{label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Font Size</h3>
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
              className={optionClass}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Font Family</h3>
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
              className={optionClass}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Line Height</h3>
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
              className={optionClass}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

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
    <section>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <div className="flex items-center justify-between px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">主题</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">选择界面配色方案</p>
            </div>
            <div className="flex gap-1.5">
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
                  className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all ${
                    appearance.theme === value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                  title={label}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">字体大小</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">调整文章阅读字号</p>
            </div>
            <div className="flex gap-1">
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
                  className={`h-8 w-12 rounded-lg text-xs font-medium transition-all ${
                    appearance.fontSize === value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">字体系列</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">选择文章字体风格</p>
            </div>
            <div className="flex gap-1">
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
                  className={`h-8 w-16 rounded-lg text-xs font-medium transition-all ${
                    appearance.fontFamily === value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">行高</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">调整文章行间距</p>
            </div>
            <div className="flex gap-1">
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
                  className={`h-8 w-14 rounded-lg text-xs font-medium transition-all ${
                    appearance.lineHeight === value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

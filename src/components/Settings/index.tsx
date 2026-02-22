import { Monitor, Moon, Sun, X } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import type { UserSettings } from '../../types';

interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  const { settings, updateSettings } = useSettingsStore();

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">设置</h2>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="close-settings"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6 p-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">主题</label>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => updateSettings({ theme: value })}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 ${
                    settings.theme === value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-sm">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">字号</label>
            <div className="grid grid-cols-3 gap-2">
              {fontSizeOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => updateSettings({ fontSize: value })}
                  className={`rounded-lg border-2 p-2 ${
                    settings.fontSize === value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">字体</label>
            <div className="grid grid-cols-2 gap-2">
              {fontFamilyOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => updateSettings({ fontFamily: value })}
                  className={`rounded-lg border-2 p-2 ${
                    settings.fontFamily === value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">行距</label>
            <div className="grid grid-cols-3 gap-2">
              {lineHeightOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => updateSettings({ lineHeight: value })}
                  className={`rounded-lg border-2 p-2 ${
                    settings.lineHeight === value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

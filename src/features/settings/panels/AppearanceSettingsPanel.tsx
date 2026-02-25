import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="flex flex-col divide-y divide-border">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-foreground">主题</p>
              <p className="text-xs text-muted-foreground">选择界面配色方案</p>
            </div>
            <div className="flex gap-1.5">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  type="button"
                  onClick={() =>
                    onChange((nextDraft) => {
                      nextDraft.persisted.appearance.theme = value;
                    })
                  }
                  aria-pressed={appearance.theme === value}
                  variant={appearance.theme === value ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 gap-1.5 rounded-lg px-2.5"
                  title={label}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-foreground">字体大小</p>
              <p className="text-xs text-muted-foreground">调整文章阅读字号</p>
            </div>
            <div className="flex gap-1">
              {fontSizeOptions.map(({ value, label }) => (
                <Button
                  key={value}
                  type="button"
                  onClick={() =>
                    onChange((nextDraft) => {
                      nextDraft.persisted.appearance.fontSize = value;
                    })
                  }
                  aria-pressed={appearance.fontSize === value}
                  variant={appearance.fontSize === value ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 w-12 rounded-lg px-0"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-foreground">字体系列</p>
              <p className="text-xs text-muted-foreground">选择文章字体风格</p>
            </div>
            <div className="flex gap-1">
              {fontFamilyOptions.map(({ value, label }) => (
                <Button
                  key={value}
                  type="button"
                  onClick={() =>
                    onChange((nextDraft) => {
                      nextDraft.persisted.appearance.fontFamily = value;
                    })
                  }
                  aria-pressed={appearance.fontFamily === value}
                  variant={appearance.fontFamily === value ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 w-16 rounded-lg px-0"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-foreground">行高</p>
              <p className="text-xs text-muted-foreground">调整文章行间距</p>
            </div>
            <div className="flex gap-1">
              {lineHeightOptions.map(({ value, label }) => (
                <Button
                  key={value}
                  type="button"
                  onClick={() =>
                    onChange((nextDraft) => {
                      nextDraft.persisted.appearance.lineHeight = value;
                    })
                  }
                  aria-pressed={appearance.lineHeight === value}
                  variant={appearance.lineHeight === value ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 w-14 rounded-lg px-0"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

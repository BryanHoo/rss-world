import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SettingsDraft } from '../../../store/settingsStore';
import type { GeneralSettings } from '../../../types';

interface GeneralSettingsPanelProps {
  draft: SettingsDraft;
  onChange: (updater: (draft: SettingsDraft) => void) => void;
}

export default function GeneralSettingsPanel({ draft, onChange }: GeneralSettingsPanelProps) {
  const general = draft.persisted.general;

  const themeOptions: Array<{ value: GeneralSettings['theme']; label: string; icon: typeof Sun }> = [
    { value: 'light', label: '浅色', icon: Sun },
    { value: 'dark', label: '深色', icon: Moon },
    { value: 'auto', label: '自动', icon: Monitor },
  ];

  const fontSizeOptions: Array<{ value: GeneralSettings['fontSize']; label: string }> = [
    { value: 'small', label: '小' },
    { value: 'medium', label: '中' },
    { value: 'large', label: '大' },
  ];

  const fontFamilyOptions: Array<{ value: GeneralSettings['fontFamily']; label: string }> = [
    { value: 'sans', label: '无衬线' },
    { value: 'serif', label: '衬线' },
  ];

  const lineHeightOptions: Array<{ value: GeneralSettings['lineHeight']; label: string }> = [
    { value: 'compact', label: '紧凑' },
    { value: 'normal', label: '标准' },
    { value: 'relaxed', label: '宽松' },
  ];

  const autoMarkReadDelayOptions: Array<{ value: GeneralSettings['autoMarkReadDelayMs']; label: string }> = [
    { value: 0, label: '立即' },
    { value: 2000, label: '2 秒' },
    { value: 5000, label: '5 秒' },
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
                      nextDraft.persisted.general.theme = value;
                    })
                  }
                  aria-pressed={general.theme === value}
                  variant={general.theme === value ? 'default' : 'outline'}
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
                      nextDraft.persisted.general.fontSize = value;
                    })
                  }
                  aria-pressed={general.fontSize === value}
                  variant={general.fontSize === value ? 'default' : 'outline'}
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
                      nextDraft.persisted.general.fontFamily = value;
                    })
                  }
                  aria-pressed={general.fontFamily === value}
                  variant={general.fontFamily === value ? 'default' : 'outline'}
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
                      nextDraft.persisted.general.lineHeight = value;
                    })
                  }
                  aria-pressed={general.lineHeight === value}
                  variant={general.lineHeight === value ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 w-14 rounded-lg px-0"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-foreground">自动标记已读</p>
              <p className="text-xs text-muted-foreground">打开文章后自动标记为已读</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex gap-1">
                <Button
                  type="button"
                  onClick={() =>
                    onChange((nextDraft) => {
                      nextDraft.persisted.general.autoMarkReadEnabled = false;
                    })
                  }
                  aria-pressed={!general.autoMarkReadEnabled}
                  variant={!general.autoMarkReadEnabled ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 w-14 rounded-lg px-0"
                >
                  关闭
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    onChange((nextDraft) => {
                      nextDraft.persisted.general.autoMarkReadEnabled = true;
                    })
                  }
                  aria-pressed={general.autoMarkReadEnabled}
                  variant={general.autoMarkReadEnabled ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 w-14 rounded-lg px-0"
                >
                  开启
                </Button>
              </div>

              <Select
                value={String(general.autoMarkReadDelayMs)}
                onValueChange={(value) => {
                  const next = Number(value);
                  if (next !== 0 && next !== 2000 && next !== 5000) return;
                  onChange((nextDraft) => {
                    nextDraft.persisted.general.autoMarkReadDelayMs = next;
                  });
                }}
                disabled={!general.autoMarkReadEnabled}
              >
                <SelectTrigger className="h-8 w-[110px] rounded-lg">
                  <SelectValue placeholder="延迟" />
                </SelectTrigger>
                <SelectContent>
                  {autoMarkReadDelayOptions.map(({ value, label }) => (
                    <SelectItem key={value} value={String(value)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-foreground">all 默认仅未读</p>
              <p className="text-xs text-muted-foreground">进入 all 视图时默认只显示未读文章</p>
            </div>
            <div className="flex gap-1">
              <Button
                type="button"
                onClick={() =>
                  onChange((nextDraft) => {
                    nextDraft.persisted.general.defaultUnreadOnlyInAll = false;
                  })
                }
                aria-pressed={!general.defaultUnreadOnlyInAll}
                variant={!general.defaultUnreadOnlyInAll ? 'default' : 'outline'}
                size="sm"
                className="h-8 w-14 rounded-lg px-0"
              >
                关闭
              </Button>
              <Button
                type="button"
                onClick={() =>
                  onChange((nextDraft) => {
                    nextDraft.persisted.general.defaultUnreadOnlyInAll = true;
                  })
                }
                aria-pressed={general.defaultUnreadOnlyInAll}
                variant={general.defaultUnreadOnlyInAll ? 'default' : 'outline'}
                size="sm"
                className="h-8 w-14 rounded-lg px-0"
              >
                开启
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-foreground">侧边栏默认折叠</p>
              <p className="text-xs text-muted-foreground">进入阅读器时默认折叠左侧栏</p>
            </div>
            <div className="flex gap-1">
              <Button
                type="button"
                onClick={() =>
                  onChange((nextDraft) => {
                    nextDraft.persisted.general.sidebarCollapsed = false;
                  })
                }
                aria-pressed={!general.sidebarCollapsed}
                variant={!general.sidebarCollapsed ? 'default' : 'outline'}
                size="sm"
                className="h-8 w-14 rounded-lg px-0"
              >
                关闭
              </Button>
              <Button
                type="button"
                onClick={() =>
                  onChange((nextDraft) => {
                    nextDraft.persisted.general.sidebarCollapsed = true;
                  })
                }
                aria-pressed={general.sidebarCollapsed}
                variant={general.sidebarCollapsed ? 'default' : 'outline'}
                size="sm"
                className="h-8 w-14 rounded-lg px-0"
              >
                开启
              </Button>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SettingsDraft } from '../../../store/settingsStore';

interface AISettingsPanelProps {
  draft: SettingsDraft;
  onChange: (updater: (draft: SettingsDraft) => void) => void;
  errors: Record<string, string>;
}

export default function AISettingsPanel({ draft, onChange, errors }: AISettingsPanelProps) {
  const ai = draft.persisted.ai;
  const apiKey = draft.session.ai.apiKey;

  return (
    <section>
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="flex flex-col divide-y divide-border">
          <div className="px-4 py-3.5">
            <Label htmlFor="ai-model" className="mb-2 block">
              Model
            </Label>
            <Input
              id="ai-model"
              value={ai.model}
              onChange={(event) =>
                onChange((nextDraft) => {
                  nextDraft.persisted.ai.model = event.target.value;
                })
              }
              placeholder="例如：gpt-4o-mini"
            />
          </div>

          <div className="px-4 py-3.5">
            <Label htmlFor="ai-api-base-url" className="mb-2 block">
              API Base URL
            </Label>
            <Input
              id="ai-api-base-url"
              value={ai.apiBaseUrl}
              onChange={(event) =>
                onChange((nextDraft) => {
                  nextDraft.persisted.ai.apiBaseUrl = event.target.value;
                })
              }
              placeholder="https://api.openai.com/v1"
            />
            {errors['ai.apiBaseUrl'] ? (
              <p className="mt-1.5 text-xs text-destructive">{errors['ai.apiBaseUrl']}</p>
            ) : null}
          </div>

          <div className="px-4 py-3.5">
            <Label htmlFor="ai-api-key" className="mb-2 block">
              API Key
            </Label>
            <Input
              id="ai-api-key"
              type="password"
              value={apiKey}
              onChange={(event) =>
                onChange((nextDraft) => {
                  nextDraft.session.ai.apiKey = event.target.value;
                })
              }
              placeholder="sk-..."
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              密钥仅保存在当前会话中，不会持久化
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

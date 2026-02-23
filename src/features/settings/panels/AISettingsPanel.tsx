import type { SettingsDraft } from '../../../store/settingsStore';

interface AISettingsPanelProps {
  draft: SettingsDraft;
  onChange: (updater: (draft: SettingsDraft) => void) => void;
  errors: Record<string, string>;
}

export default function AISettingsPanel({ draft, onChange, errors }: AISettingsPanelProps) {
  const ai = draft.persisted.ai;
  const apiKey = draft.session.ai.apiKey;
  const inputClass =
    'h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none ' +
    'focus:ring-2 focus:ring-gray-300';
  const labelClass = 'text-xs font-semibold uppercase tracking-[0.08em] text-gray-500';

  return (
    <div className="space-y-5">
      <div className="grid gap-2">
        <label htmlFor="ai-provider" className={labelClass}>
          Provider
        </label>
        <input
          id="ai-provider"
          value={ai.provider}
          onChange={(event) =>
            onChange((nextDraft) => {
              nextDraft.persisted.ai.provider = event.target.value;
            })
          }
          className={inputClass}
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="ai-model" className={labelClass}>
          Model
        </label>
        <input
          id="ai-model"
          value={ai.model}
          onChange={(event) =>
            onChange((nextDraft) => {
              nextDraft.persisted.ai.model = event.target.value;
            })
          }
          className={inputClass}
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="ai-api-base-url" className={labelClass}>
          API Base URL
        </label>
        <input
          id="ai-api-base-url"
          value={ai.apiBaseUrl}
          onChange={(event) =>
            onChange((nextDraft) => {
              nextDraft.persisted.ai.apiBaseUrl = event.target.value;
            })
          }
          className={inputClass}
        />
        {errors['ai.apiBaseUrl'] ? <p className="text-sm text-red-600">{errors['ai.apiBaseUrl']}</p> : null}
      </div>

      <div className="grid gap-2">
        <label htmlFor="ai-api-key" className={labelClass}>
          API Key
        </label>
        <input
          id="ai-api-key"
          value={apiKey}
          onChange={(event) =>
            onChange((nextDraft) => {
              nextDraft.session.ai.apiKey = event.target.value;
            })
          }
          className={inputClass}
        />
      </div>
    </div>
  );
}

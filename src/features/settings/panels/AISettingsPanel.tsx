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
    <div className="space-y-4">
      <div className="grid gap-2">
        <label htmlFor="ai-provider" className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="ai-model" className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="ai-api-base-url" className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
        {errors['ai.apiBaseUrl'] ? (
          <p className="text-sm text-red-600 dark:text-red-400">{errors['ai.apiBaseUrl']}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label htmlFor="ai-api-key" className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>
    </div>
  );
}

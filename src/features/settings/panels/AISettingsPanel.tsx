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
    'h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 outline-none transition-colors ' +
    'placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 ' +
    'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:bg-gray-700';

  return (
    <section>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <div className="px-4 py-3.5">
            <label htmlFor="ai-model" className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
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
              placeholder="例如：gpt-4o-mini"
              className={inputClass}
            />
          </div>

          <div className="px-4 py-3.5">
            <label htmlFor="ai-api-base-url" className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
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
              placeholder="https://api.openai.com/v1"
              className={inputClass}
            />
            {errors['ai.apiBaseUrl'] ? (
              <p className="mt-1.5 text-xs text-red-500">{errors['ai.apiBaseUrl']}</p>
            ) : null}
          </div>

          <div className="px-4 py-3.5">
            <label htmlFor="ai-api-key" className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
              API Key
            </label>
            <input
              id="ai-api-key"
              type="password"
              value={apiKey}
              onChange={(event) =>
                onChange((nextDraft) => {
                  nextDraft.session.ai.apiKey = event.target.value;
                })
              }
              placeholder="sk-..."
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">密钥仅保存在当前会话中，不会持久化</p>
          </div>
        </div>
      </div>
    </section>
  );
}

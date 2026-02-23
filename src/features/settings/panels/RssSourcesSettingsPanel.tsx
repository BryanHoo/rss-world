import type { RssSourceSetting } from '../../../types';
import type { SettingsDraft } from '../../../store/settingsStore';

interface RssSourcesSettingsPanelProps {
  draft: SettingsDraft;
  onChange: (updater: (draft: SettingsDraft) => void) => void;
  errors: Record<string, string>;
}

function createRssSource(): RssSourceSetting {
  return {
    id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}`,
    name: '',
    url: '',
    folder: null,
    enabled: true,
  };
}

export default function RssSourcesSettingsPanel({ draft, onChange, errors }: RssSourcesSettingsPanelProps) {
  const sources = draft.persisted.rss.sources;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() =>
          onChange((nextDraft) => {
            nextDraft.persisted.rss.sources.push(createRssSource());
          })
        }
        className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
      >
        新增 RSS 源
      </button>

      <div className="space-y-4">
        {sources.map((source, index) => (
          <section key={source.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">源 {index + 1}</h3>
              <button
                type="button"
                onClick={() =>
                  onChange((nextDraft) => {
                    nextDraft.persisted.rss.sources = nextDraft.persisted.rss.sources.filter((item) => item.id !== source.id);
                  })
                }
                aria-label={`删除-${index}`}
                className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-500/50 dark:text-red-300 dark:hover:bg-red-900/20"
              >
                删除
              </button>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-1">
                <label htmlFor={`rss-name-${index}`} className="text-sm text-gray-700 dark:text-gray-300">
                  名称-{index}
                </label>
                <input
                  id={`rss-name-${index}`}
                  aria-label={`名称-${index}`}
                  value={source.name}
                  onChange={(event) =>
                    onChange((nextDraft) => {
                      nextDraft.persisted.rss.sources[index].name = event.target.value;
                    })
                  }
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                />
                {errors[`rss.sources.${index}.name`] ? (
                  <p className="text-sm text-red-600 dark:text-red-400">{errors[`rss.sources.${index}.name`]}</p>
                ) : null}
              </div>

              <div className="grid gap-1">
                <label htmlFor={`rss-url-${index}`} className="text-sm text-gray-700 dark:text-gray-300">
                  URL-{index}
                </label>
                <input
                  id={`rss-url-${index}`}
                  aria-label={`URL-${index}`}
                  value={source.url}
                  onChange={(event) =>
                    onChange((nextDraft) => {
                      nextDraft.persisted.rss.sources[index].url = event.target.value;
                    })
                  }
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                />
                {errors[`rss.sources.${index}.url`] ? (
                  <p className="text-sm text-red-600 dark:text-red-400">{errors[`rss.sources.${index}.url`]}</p>
                ) : null}
              </div>

              <div className="grid gap-1">
                <label htmlFor={`rss-folder-${index}`} className="text-sm text-gray-700 dark:text-gray-300">
                  分组-{index}
                </label>
                <input
                  id={`rss-folder-${index}`}
                  aria-label={`分组-${index}`}
                  value={source.folder ?? ''}
                  onChange={(event) =>
                    onChange((nextDraft) => {
                      const value = event.target.value.trim();
                      nextDraft.persisted.rss.sources[index].folder = value ? value : null;
                    })
                  }
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  aria-label={`启用-${index}`}
                  checked={source.enabled}
                  onChange={(event) =>
                    onChange((nextDraft) => {
                      nextDraft.persisted.rss.sources[index].enabled = event.target.checked;
                    })
                  }
                />
                启用-{index}
              </label>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

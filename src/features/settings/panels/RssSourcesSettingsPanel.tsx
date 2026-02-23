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
  const inputClass =
    'h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-300';
  const labelClass = 'text-xs font-semibold uppercase tracking-[0.08em] text-gray-500';

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() =>
          onChange((nextDraft) => {
            nextDraft.persisted.rss.sources.push(createRssSource());
          })
        }
        className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 transition hover:border-gray-500"
      >
        新增 RSS 源
      </button>

      <div className="space-y-4">
        {sources.map((source, index) => (
          <section key={source.id} className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Source {index + 1}</h3>
              <button
                type="button"
                onClick={() =>
                  onChange((nextDraft) => {
                    nextDraft.persisted.rss.sources = nextDraft.persisted.rss.sources.filter((item) => item.id !== source.id);
                  })
                }
                aria-label={`删除-${index}`}
                className="h-8 rounded-lg border border-red-300 px-2 text-xs text-red-600 hover:bg-red-50"
              >
                删除
              </button>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-1">
                <label htmlFor={`rss-name-${index}`} className={labelClass}>
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
                  className={inputClass}
                />
                {errors[`rss.sources.${index}.name`] ? <p className="text-sm text-red-600">{errors[`rss.sources.${index}.name`]}</p> : null}
              </div>

              <div className="grid gap-1">
                <label htmlFor={`rss-url-${index}`} className={labelClass}>
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
                  className={inputClass}
                />
                {errors[`rss.sources.${index}.url`] ? <p className="text-sm text-red-600">{errors[`rss.sources.${index}.url`]}</p> : null}
              </div>

              <div className="grid gap-1">
                <label htmlFor={`rss-folder-${index}`} className={labelClass}>
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
                  className={inputClass}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
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

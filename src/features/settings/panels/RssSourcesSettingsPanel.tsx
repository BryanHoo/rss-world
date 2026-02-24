import { Plus, Trash2 } from 'lucide-react';
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
    'h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 outline-none transition-colors ' +
    'placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 ' +
    'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:bg-gray-700';

  return (
    <section>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-end border-b border-gray-100 px-4 py-3 dark:border-gray-700">
          <button
            type="button"
            onClick={() =>
              onChange((nextDraft) => {
                nextDraft.persisted.rss.sources.push(createRssSource());
              })
            }
            className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus size={16} />
            <span>添加源</span>
          </button>
        </div>

        <div className="space-y-4 p-4">
          {sources.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-4 py-12 text-center dark:border-gray-600 dark:bg-gray-800/50">
              <p className="text-sm text-gray-500 dark:text-gray-400">暂无 RSS 源，点击上方按钮添加</p>
            </div>
          ) : (
            sources.map((source, index) => (
              <div
                key={source.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800/50">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {source.name || `源 ${index + 1}`}
                  </h3>
                  <div className="flex items-center gap-2">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        aria-label={`启用-${index}`}
                        checked={source.enabled}
                        onChange={(event) =>
                          onChange((nextDraft) => {
                            nextDraft.persisted.rss.sources[index].enabled = event.target.checked;
                          })
                        }
                        className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20"
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">启用</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        onChange((nextDraft) => {
                          nextDraft.persisted.rss.sources = nextDraft.persisted.rss.sources.filter(
                            (item) => item.id !== source.id
                          );
                        })
                      }
                      aria-label={`删除-${index}`}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  <div>
                    <label htmlFor={`rss-name-${index}`} className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
                      名称
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
                      placeholder="例如：The Verge"
                      className={inputClass}
                    />
                    {errors[`rss.sources.${index}.name`] ? (
                      <p className="mt-1 text-xs text-red-500">{errors[`rss.sources.${index}.name`]}</p>
                    ) : null}
                  </div>

                  <div>
                    <label htmlFor={`rss-url-${index}`} className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
                      URL
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
                      placeholder="https://example.com/feed.xml"
                      className={inputClass}
                    />
                    {errors[`rss.sources.${index}.url`] ? (
                      <p className="mt-1 text-xs text-red-500">{errors[`rss.sources.${index}.url`]}</p>
                    ) : null}
                  </div>

                  <div>
                    <label htmlFor={`rss-folder-${index}`} className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
                      分组
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
                      placeholder="可选，例如：科技"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

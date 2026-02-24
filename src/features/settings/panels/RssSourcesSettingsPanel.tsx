import { Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import CategorySelectField from '../../../components/common/CategorySelectField';
import type { RssSourceSetting } from '../../../types';
import type { SettingsDraft } from '../../../store/settingsStore';
import { validateRssUrl } from '../../feeds/services/rssValidationService';

interface RssSourcesSettingsPanelProps {
  draft: SettingsDraft;
  onChange: (updater: (draft: SettingsDraft) => void) => void;
  errors: Record<string, string>;
}

type ValidationState = 'idle' | 'validating' | 'verified' | 'failed';

function createRssSource(): RssSourceSetting {
  return {
    id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}`,
    name: '',
    url: '',
    category: null,
    enabled: true,
  };
}

function setValidationState(draft: SettingsDraft, sourceId: string, status: ValidationState, verifiedUrl: string | null) {
  draft.session.rssValidation[sourceId] = {
    status,
    verifiedUrl,
  };
}

export default function RssSourcesSettingsPanel({ draft, onChange, errors }: RssSourcesSettingsPanelProps) {
  const sources = draft.persisted.rss.sources;

  const inputClass =
    'h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 outline-none transition-colors ' +
    'placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 ' +
    'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:bg-gray-700';

  const categoryOptions = useMemo(
    () => Array.from(new Set(sources.map((source) => source.category?.trim() ?? '').filter(Boolean))),
    [sources]
  );

  const handleValidateSource = async (sourceId: string, rawUrl: string) => {
    const trimmedUrl = rawUrl.trim();
    if (!trimmedUrl) {
      onChange((nextDraft) => {
        setValidationState(nextDraft, sourceId, 'failed', null);
      });
      return;
    }

    onChange((nextDraft) => {
      setValidationState(nextDraft, sourceId, 'validating', null);
    });

    const result = await validateRssUrl(trimmedUrl);

    onChange((nextDraft) => {
      const latestSource = nextDraft.persisted.rss.sources.find((source) => source.id === sourceId);
      if (!latestSource) {
        return;
      }

      if (latestSource.url.trim() !== trimmedUrl) {
        return;
      }

      if (result.ok) {
        setValidationState(nextDraft, sourceId, 'verified', trimmedUrl);
        return;
      }

      setValidationState(nextDraft, sourceId, 'failed', null);
    });
  };

  return (
    <section>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-end border-b border-gray-100 px-4 py-3 dark:border-gray-700">
          <button
            type="button"
            onClick={() =>
              onChange((nextDraft) => {
                const source = createRssSource();
                nextDraft.persisted.rss.sources.push(source);
                setValidationState(nextDraft, source.id, 'idle', null);
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
            sources.map((source, index) => {
              const validation = draft.session.rssValidation[source.id] ?? { status: 'idle' as const, verifiedUrl: null };
              const statusLabel = {
                idle: '未验证',
                validating: '验证中',
                verified: '已验证',
                failed: '验证失败',
              }[validation.status];
              const statusClass = {
                idle: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                validating: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                verified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
              }[validation.status];

              return (
                <div
                  key={source.id}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800/50">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {source.name || `源 ${index + 1}`}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span
                        data-testid={`rss-validation-status-${index}`}
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass}`}
                      >
                        {statusLabel}
                      </span>
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
                            delete nextDraft.session.rssValidation[source.id];
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
                            setValidationState(nextDraft, source.id, 'idle', null);
                          })
                        }
                        placeholder="https://example.com/feed.xml"
                        className={inputClass}
                      />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          aria-label={`验证链接-${index}`}
                          onClick={() => void handleValidateSource(source.id, source.url)}
                          disabled={validation.status === 'validating'}
                          className="inline-flex h-8 items-center rounded-lg border border-gray-300 bg-white px-3 text-xs text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {validation.status === 'validating' ? '验证中...' : '验证链接'}
                        </button>
                      </div>
                      {errors[`rss.sources.${index}.url`] ? (
                        <p className="mt-1 text-xs text-red-500">{errors[`rss.sources.${index}.url`]}</p>
                      ) : null}
                    </div>

                    <CategorySelectField
                      id={`rss-category-${index}`}
                      label={`分类-${index}`}
                      value={source.category}
                      options={categoryOptions}
                      onChange={(nextCategory) =>
                        onChange((nextDraft) => {
                          nextDraft.persisted.rss.sources[index].category = nextCategory;
                          setValidationState(nextDraft, source.id, 'idle', null);
                        })
                      }
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

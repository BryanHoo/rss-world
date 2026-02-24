import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { SettingsDraft } from '../../../store/settingsStore';

interface CategoriesSettingsPanelProps {
  draft: SettingsDraft;
  onChange: (updater: (draft: SettingsDraft) => void) => void;
  errors: Record<string, string>;
}

function createCategoryId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `cat-${Date.now()}`;
}

export default function CategoriesSettingsPanel({ draft, onChange, errors }: CategoriesSettingsPanelProps) {
  const [newName, setNewName] = useState('');
  const categories = draft.persisted.categories;
  const inputClass =
    'h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 outline-none transition-colors ' +
    'placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 ' +
    'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:bg-gray-700';

  return (
    <section>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-end gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
          <div className="flex-1">
            <label htmlFor="new-category-name" className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
              新分类名称
            </label>
            <input
              id="new-category-name"
              aria-label="新分类名称"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="例如：Tech"
              className={inputClass}
            />
          </div>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            onClick={() => {
              const trimmed = newName.trim();
              if (!trimmed) {
                return;
              }

              onChange((nextDraft) => {
                nextDraft.persisted.categories.push({
                  id: createCategoryId(),
                  name: trimmed,
                });
              });
              setNewName('');
            }}
          >
            <Plus size={16} />
            <span>添加分类</span>
          </button>
        </div>

        <div className="space-y-3 p-4">
          {categories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-4 py-12 text-center dark:border-gray-600 dark:bg-gray-800/50">
              <p className="text-sm text-gray-500 dark:text-gray-400">暂无分类，先创建一个分类</p>
            </div>
          ) : (
            categories.map((category, index) => (
              <div
                key={category.id}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <label
                      htmlFor={`category-name-${index}`}
                      className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300"
                    >
                      分类名称
                    </label>
                    <input
                      id={`category-name-${index}`}
                      aria-label={`分类名称-${index}`}
                      value={category.name}
                      onChange={(event) =>
                        onChange((nextDraft) => {
                          nextDraft.persisted.categories[index].name = event.target.value;
                        })
                      }
                      className={inputClass}
                    />
                    {errors[`categories.${index}.name`] ? (
                      <p className="mt-1 text-xs text-red-500">{errors[`categories.${index}.name`]}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label={`删除分类-${index}`}
                    className="mt-6 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                    onClick={() =>
                      onChange((nextDraft) => {
                        nextDraft.persisted.categories = nextDraft.persisted.categories.filter(
                          (item) => item.id !== category.id
                        );
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

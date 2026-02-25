import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ApiError, createCategory, deleteCategory, patchCategory } from '../../../lib/apiClient';
import { useAppStore } from '../../../store/appStore';

const uncategorizedName = '未分类';
const uncategorizedId = 'cat-uncategorized';

function getCategoryErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'conflict') {
      return '分类已存在。';
    }
    if (err.code === 'validation_error') {
      return '分类名称无效。';
    }
  }

  return '操作失败，请稍后重试。';
}

export default function CategoriesSettingsPanel() {
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftNamesById, setDraftNamesById] = useState<Record<string, string>>({});
  const [rowBusyById, setRowBusyById] = useState<Record<string, boolean>>({});
  const [rowErrorById, setRowErrorById] = useState<Record<string, string>>({});

  const appCategories = useAppStore((state) => state.categories);
  const categories = useMemo(
    () =>
      appCategories.filter(
        (item) => item.id !== uncategorizedId && item.name !== uncategorizedName,
      ),
    [appCategories],
  );

  const inputClass =
    'h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 outline-none transition-colors ' +
    'placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 ' +
    'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:bg-gray-700';

  const upsertCategoryInStore = (category: { id: string; name: string }) => {
    useAppStore.setState((state) => {
      const uncategorized = state.categories.find((item) => item.id === uncategorizedId) ?? {
        id: uncategorizedId,
        name: uncategorizedName,
        expanded: true,
      };

      const nextCategories = state.categories
        .filter((item) => item.id !== uncategorizedId && item.id !== category.id)
        .concat([{ id: category.id, name: category.name, expanded: true }]);

      return {
        categories: [...nextCategories, uncategorized],
        feeds: state.feeds.map((feed) =>
          feed.categoryId === category.id ? { ...feed, category: category.name } : feed,
        ),
      };
    });
  };

  const removeCategoryFromStore = (categoryId: string) => {
    useAppStore.setState((state) => ({
      categories: state.categories.filter((item) => item.id !== categoryId),
      feeds: state.feeds.map((feed) =>
        feed.categoryId === categoryId
          ? {
              ...feed,
              categoryId: null,
              category: null,
            }
          : feed,
      ),
    }));
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setCreateError('请输入分类名称。');
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const created = await createCategory({ name: trimmed });
      upsertCategoryInStore({ id: created.id, name: created.name });
      setNewName('');
    } catch (err) {
      setCreateError(getCategoryErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (categoryId: string, originalName: string) => {
    const value = draftNamesById[categoryId] ?? originalName;
    const trimmed = value.trim();

    if (!trimmed) {
      setRowErrorById((prev) => ({ ...prev, [categoryId]: '请输入分类名称。' }));
      return;
    }

    if (trimmed === originalName.trim()) {
      setRowErrorById((prev) => {
        if (!prev[categoryId]) return prev;
        const next = { ...prev };
        delete next[categoryId];
        return next;
      });
      return;
    }

    setRowBusyById((prev) => ({ ...prev, [categoryId]: true }));
    setRowErrorById((prev) => {
      if (!prev[categoryId]) return prev;
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });

    try {
      const saved = await patchCategory(categoryId, { name: trimmed });
      upsertCategoryInStore({ id: saved.id, name: saved.name });
      setDraftNamesById((prev) => {
        if (!prev[categoryId]) return prev;
        const next = { ...prev };
        delete next[categoryId];
        return next;
      });
    } catch (err) {
      setRowErrorById((prev) => ({ ...prev, [categoryId]: getCategoryErrorMessage(err) }));
    } finally {
      setRowBusyById((prev) => {
        if (!prev[categoryId]) return prev;
        const next = { ...prev };
        delete next[categoryId];
        return next;
      });
    }
  };

  const handleDelete = async (categoryId: string) => {
    setRowBusyById((prev) => ({ ...prev, [categoryId]: true }));
    setRowErrorById((prev) => {
      if (!prev[categoryId]) return prev;
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });

    try {
      await deleteCategory(categoryId);
      removeCategoryFromStore(categoryId);
      setDraftNamesById((prev) => {
        if (!prev[categoryId]) return prev;
        const next = { ...prev };
        delete next[categoryId];
        return next;
      });
    } catch (err) {
      setRowErrorById((prev) => ({ ...prev, [categoryId]: getCategoryErrorMessage(err) }));
    } finally {
      setRowBusyById((prev) => {
        if (!prev[categoryId]) return prev;
        const next = { ...prev };
        delete next[categoryId];
        return next;
      });
    }
  };

  return (
    <section>
      <div className="overflow-hidden border border-gray-200/80 bg-gray-50/70 dark:border-gray-700 dark:bg-gray-800/45">
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
            {createError ? <p className="mt-1 text-xs text-red-500">{createError}</p> : null}
          </div>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            onClick={handleCreate}
            disabled={creating}
          >
            <Plus size={16} />
            <span>添加分类</span>
          </button>
        </div>

        <div className="space-y-3 p-4">
          {categories.length === 0 ? (
            <div className="border border-dashed border-gray-300 bg-gray-50/50 px-4 py-12 text-center dark:border-gray-600 dark:bg-gray-800/50">
              <p className="text-sm text-gray-500 dark:text-gray-400">暂无分类，先创建一个分类</p>
            </div>
          ) : (
            categories.map((category, index) => (
              <div
                key={category.id}
                className="border-b border-gray-100 px-3 py-3 last:border-b-0 dark:border-gray-700"
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
                      value={draftNamesById[category.id] ?? category.name}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDraftNamesById((prev) => ({ ...prev, [category.id]: value }));
                      }}
                      onBlur={() => {
                        void handleRename(category.id, category.name);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void handleRename(category.id, category.name);
                        }
                      }}
                      className={inputClass}
                      disabled={Boolean(rowBusyById[category.id])}
                    />
                    {rowErrorById[category.id] ? (
                      <p className="mt-1 text-xs text-red-500">{rowErrorById[category.id]}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label={`删除分类-${index}`}
                    className="mt-6 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                    onClick={() => {
                      void handleDelete(category.id);
                    }}
                    disabled={Boolean(rowBusyById[category.id])}
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

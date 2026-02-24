import { useMemo, useState } from 'react';

interface CategorySelectFieldProps {
  id: string;
  label: string;
  value: string | null;
  options: string[];
  onChange: (value: string | null) => void;
}

export default function CategorySelectField({
  id,
  label,
  value,
  options,
  onChange,
}: CategorySelectFieldProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  const normalizedOptions = useMemo(
    () => Array.from(new Set(options.map((option) => option.trim()).filter(Boolean))),
    [options]
  );

  const currentValue = value?.trim() ? value.trim() : null;
  const hasCurrentValue = currentValue ? normalizedOptions.includes(currentValue) : false;
  const selectValue = isCreating ? '__create__' : currentValue && hasCurrentValue ? currentValue : currentValue ? '__current__' : '';

  const handleSelectChange = (nextValue: string) => {
    if (nextValue === '__create__') {
      setIsCreating(true);
      setNewCategory('');
      return;
    }

    setIsCreating(false);

    if (!nextValue) {
      onChange(null);
      return;
    }

    if (nextValue === '__current__' && currentValue) {
      onChange(currentValue);
      return;
    }

    onChange(nextValue);
  };

  const handleConfirmCreate = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) {
      return;
    }

    onChange(trimmed);
    setIsCreating(false);
    setNewCategory('');
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-xs font-medium text-gray-600 dark:text-gray-300">
        {label}
      </label>
      <select
        id={id}
        aria-label={label}
        value={selectValue}
        onChange={(event) => handleSelectChange(event.target.value)}
        className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400"
      >
        <option value="">未分类</option>
        {normalizedOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        {currentValue && !hasCurrentValue ? <option value="__current__">{currentValue}</option> : null}
        <option value="__create__">新建分类...</option>
      </select>

      {isCreating ? (
        <div className="flex items-center gap-2">
          <input
            aria-label="新分类"
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            className="h-9 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400"
          />
          <button
            type="button"
            onClick={handleConfirmCreate}
            className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            确认新分类
          </button>
        </div>
      ) : null}
    </div>
  );
}

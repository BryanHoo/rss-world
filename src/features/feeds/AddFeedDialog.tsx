import { useState } from 'react';
import AppDialog from '../../components/common/AppDialog';
import type { Folder } from '../../types';
import { validateRssUrl } from './services/rssValidationService';

interface AddFeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Folder[];
  onSubmit: (payload: { title: string; url: string; category: string | null }) => void;
}

export default function AddFeedDialog({ open, onOpenChange, categories, onSubmit }: AddFeedDialogProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const selectableCategories = categories.filter((item) => item.name !== '未分类');
  const [category, setCategory] = useState(() => selectableCategories[0]?.name ?? '');
  const [validationState, setValidationState] = useState<'idle' | 'validating' | 'verified' | 'failed'>('idle');
  const [lastVerifiedUrl, setLastVerifiedUrl] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const trimmedTitle = title.trim();
  const trimmedUrl = url.trim();
  const canSave = Boolean(trimmedTitle) && Boolean(trimmedUrl) && validationState === 'verified' && lastVerifiedUrl === trimmedUrl;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSave) return;

    onSubmit({
      title: trimmedTitle,
      url: trimmedUrl,
      category: category || null,
    });
    onOpenChange(false);
  };

  const handleValidate = async () => {
    if (!trimmedUrl) {
      setValidationState('failed');
      setLastVerifiedUrl(null);
      setValidationMessage('请输入链接后再验证。');
      return;
    }

    setValidationState('validating');
    setValidationMessage(null);

    const result = await validateRssUrl(trimmedUrl);
    if (result.ok) {
      setValidationState('verified');
      setLastVerifiedUrl(trimmedUrl);
      setValidationMessage('链接验证成功。');
      return;
    }

    setValidationState('failed');
    setLastVerifiedUrl(null);
    setValidationMessage(result.message ?? '链接验证失败。');
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="添加 RSS 源"
      description="填写标题与链接以创建订阅源"
      closeLabel="close-add-feed"
      className="max-w-sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-1.5">
          <label htmlFor="add-feed-title" className="text-xs font-medium text-gray-700">
            名称
          </label>
          <input
            id="add-feed-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：The Verge"
            className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
          />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="add-feed-url" className="text-xs font-medium text-gray-700">
            URL
          </label>
          <input
            id="add-feed-url"
            type="url"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setValidationState('idle');
              setLastVerifiedUrl(null);
              setValidationMessage(null);
            }}
            placeholder="https://example.com/feed.xml"
            className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleValidate}
              disabled={!trimmedUrl || validationState === 'validating'}
              className="inline-flex h-8 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-xs text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {validationState === 'validating' ? '验证中...' : '验证链接'}
            </button>
            {validationMessage ? <span className="text-xs text-gray-600 dark:text-gray-300">{validationMessage}</span> : null}
          </div>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="add-feed-category" className="text-xs font-medium text-gray-700">
            分类
          </label>
          <select
            id="add-feed-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            {selectableCategories.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
            <option value="">未分类</option>
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            添加
          </button>
        </div>
      </form>
    </AppDialog>
  );
}

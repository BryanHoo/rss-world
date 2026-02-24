import { useState } from 'react';
import AppDialog from '../../components/common/AppDialog';
import type { Folder } from '../../types';

interface AddFeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: Folder[];
  onSubmit: (payload: { title: string; url: string; folderId: string }) => void;
}

export default function AddFeedDialog({ open, onOpenChange, folders, onSubmit }: AddFeedDialogProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [folderId, setFolderId] = useState(() => folders[0]?.id ?? '');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextTitle = title.trim();
    const nextUrl = url.trim();
    if (!nextTitle || !nextUrl) return;

    onSubmit({
      title: nextTitle,
      url: nextUrl,
      folderId,
    });
    onOpenChange(false);
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
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/feed.xml"
            className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
          />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="add-feed-folder" className="text-xs font-medium text-gray-700">
            文件夹
          </label>
          <select
            id="add-feed-folder"
            value={folderId}
            onChange={(event) => setFolderId(event.target.value)}
            className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
            <option value="">不分组</option>
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
            disabled={!title.trim() || !url.trim()}
            className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            添加
          </button>
        </div>
      </form>
    </AppDialog>
  );
}

import { useEffect, useState } from 'react';
import AppDialog from '../../components/common/AppDialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
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
  const [folderId, setFolderId] = useState('');

  useEffect(() => {
    if (open) {
      setTitle('');
      setUrl('');
      setFolderId(folders[0]?.id ?? '');
    }
  }, [open, folders]);

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
          <Label htmlFor="add-feed-title" className="text-xs">
            名称
          </Label>
          <Input
            id="add-feed-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：The Verge"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="add-feed-url" className="text-xs">
            URL
          </Label>
          <Input
            id="add-feed-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/feed.xml"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="add-feed-folder" className="text-xs">
            文件夹
          </Label>
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
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="submit" disabled={!title.trim() || !url.trim()}>
            添加
          </Button>
        </div>
      </form>
    </AppDialog>
  );
}

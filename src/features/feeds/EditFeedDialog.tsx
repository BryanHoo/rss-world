import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { mapApiErrorToUserMessage } from '../notifications/mapApiErrorToUserMessage';
import { useNotify } from '../notifications/useNotify';
import type { Category, Feed } from '../../types';

interface EditFeedDialogProps {
  open: boolean;
  feed: Feed;
  categories: Category[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: {
    title: string;
    categoryId: string | null;
    enabled: boolean;
    fullTextOnOpenEnabled: boolean;
    aiSummaryOnOpenEnabled: boolean;
  }) => Promise<void>;
}

export default function EditFeedDialog({ open, feed, categories, onOpenChange, onSubmit }: EditFeedDialogProps) {
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const uncategorizedValue = '__uncategorized__';
  const selectableCategories = useMemo(() => categories.filter((item) => item.name !== '未分类'), [categories]);

  const [title, setTitle] = useState(feed.title);
  const [categoryId, setCategoryId] = useState(() => feed.categoryId ?? uncategorizedValue);
  const [enabled, setEnabled] = useState(() => (typeof feed.enabled === 'boolean' ? feed.enabled : true));
  const [fullTextOnOpenEnabledValue, setFullTextOnOpenEnabledValue] = useState<'enabled' | 'disabled'>(
    () => (feed.fullTextOnOpenEnabled ? 'enabled' : 'disabled'),
  );
  const [aiSummaryOnOpenEnabledValue, setAiSummaryOnOpenEnabledValue] = useState<'enabled' | 'disabled'>(
    () => (feed.aiSummaryOnOpenEnabled ? 'enabled' : 'disabled'),
  );
  const [saving, setSaving] = useState(false);
  const notify = useNotify();

  const trimmedTitle = title.trim();
  const canSave = Boolean(trimmedTitle) && !saving;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) return;

    void (async () => {
      setSaving(true);
      try {
        await onSubmit({
          title: trimmedTitle,
          categoryId: categoryId === uncategorizedValue ? null : categoryId,
          enabled,
          fullTextOnOpenEnabled: fullTextOnOpenEnabledValue === 'enabled',
          aiSummaryOnOpenEnabled: aiSummaryOnOpenEnabledValue === 'enabled',
        });
        notify.success('保存成功');
        onOpenChange(false);
      } catch (err) {
        notify.error(mapApiErrorToUserMessage(err, 'update-feed'));
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel="close-edit-feed"
        className="max-w-[34rem]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleInputRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>编辑 RSS 源</DialogTitle>
          <DialogDescription>修改名称、分类与启用状态。</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-feed-title" className="text-xs">
                名称
              </Label>
              <Input
                ref={titleInputRef}
                id="edit-feed-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="edit-feed-url" className="text-xs">
                URL
              </Label>
              <Input id="edit-feed-url" type="url" value={feed.url} readOnly />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="edit-feed-category" className="text-xs">
                分类
              </Label>
              <Select value={categoryId ?? uncategorizedValue} onValueChange={setCategoryId}>
                <SelectTrigger id="edit-feed-category" aria-label="分类">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectableCategories.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={uncategorizedValue}>未分类</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="edit-feed-enabled" className="text-xs">
                状态
              </Label>
              <Select value={enabled ? 'enabled' : 'disabled'} onValueChange={(v) => setEnabled(v === 'enabled')}>
                <SelectTrigger id="edit-feed-enabled" aria-label="状态">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">启用</SelectItem>
                  <SelectItem value="disabled">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="edit-feed-fulltext-on-open" className="text-xs">
                打开文章时抓取全文
              </Label>
              <Select
                value={fullTextOnOpenEnabledValue}
                onValueChange={(value) => {
                  if (value === 'enabled' || value === 'disabled') {
                    setFullTextOnOpenEnabledValue(value);
                  }
                }}
              >
                <SelectTrigger id="edit-feed-fulltext-on-open" aria-label="打开文章时抓取全文">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">关闭</SelectItem>
                  <SelectItem value="enabled">开启</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">开启后会访问原文链接并尝试抽取正文</p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="edit-feed-ai-summary-on-open" className="text-xs">
                打开文章时自动生成 AI 摘要
              </Label>
              <Select
                value={aiSummaryOnOpenEnabledValue}
                onValueChange={(value) => {
                  if (value === 'enabled' || value === 'disabled') {
                    setAiSummaryOnOpenEnabledValue(value);
                  }
                }}
              >
                <SelectTrigger id="edit-feed-ai-summary-on-open" aria-label="打开文章时自动生成 AI 摘要">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">关闭</SelectItem>
                  <SelectItem value="enabled">开启</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">开启后会在打开文章时自动生成摘要</p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              取消
            </Button>
            <Button type="submit" disabled={!canSave}>
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

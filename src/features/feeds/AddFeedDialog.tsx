import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import type { Category } from '../../types';
import { validateRssUrl } from './services/rssValidationService';

interface AddFeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onSubmit: (payload: {
    title: string;
    url: string;
    categoryId: string | null;
    fullTextOnOpenEnabled: boolean;
  }) => void;
}

type ValidationState = 'idle' | 'validating' | 'verified' | 'failed';

interface ValidationStateMeta {
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
  badgeText: string;
  messageTone: string;
  icon?: LucideIcon;
  iconClassName?: string;
}

const VALIDATION_STATE_META: Record<ValidationState, ValidationStateMeta> = {
  idle: {
    badgeVariant: 'secondary',
    badgeText: '待验证',
    messageTone: 'text-muted-foreground',
  },
  validating: {
    badgeVariant: 'outline',
    badgeText: '验证中',
    messageTone: 'text-muted-foreground',
    icon: Loader2,
    iconClassName: 'animate-spin',
  },
  verified: {
    badgeVariant: 'default',
    badgeText: '验证成功',
    messageTone: 'text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
  },
  failed: {
    badgeVariant: 'destructive',
    badgeText: '验证失败',
    messageTone: 'text-destructive',
    icon: AlertCircle,
  },
};

export default function AddFeedDialog({ open, onOpenChange, categories, onSubmit }: AddFeedDialogProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const uncategorizedValue = '__uncategorized__';
  const selectableCategories = categories.filter((item) => item.name !== '未分类');
  const [categoryId, setCategoryId] = useState(() => selectableCategories[0]?.id ?? uncategorizedValue);
  const [fullTextOnOpenEnabledValue, setFullTextOnOpenEnabledValue] = useState<'enabled' | 'disabled'>('disabled');
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [lastVerifiedUrl, setLastVerifiedUrl] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const validationRequestIdRef = useRef(0);

  const trimmedTitle = title.trim();
  const trimmedUrl = url.trim();
  const canSave = Boolean(trimmedTitle) && Boolean(trimmedUrl) && validationState === 'verified' && lastVerifiedUrl === trimmedUrl;
  const validationMeta = VALIDATION_STATE_META[validationState];
  const ValidationIcon = validationMeta.icon;

  const resetValidationState = () => {
    setValidationState('idle');
    setLastVerifiedUrl(null);
    setValidationMessage(null);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSave) return;

    onSubmit({
      title: trimmedTitle,
      url: trimmedUrl,
      categoryId: categoryId === uncategorizedValue ? null : categoryId,
      fullTextOnOpenEnabled: fullTextOnOpenEnabledValue === 'enabled',
    });
    onOpenChange(false);
  };

  const handleValidate = async (urlToValidate: string) => {
    if (!urlToValidate) {
      resetValidationState();
      return;
    }

    const requestId = validationRequestIdRef.current + 1;
    validationRequestIdRef.current = requestId;
    setValidationState('validating');
    setValidationMessage('正在验证链接...');

    const result = await validateRssUrl(urlToValidate);
    if (requestId !== validationRequestIdRef.current) {
      return;
    }

    if (result.ok) {
      setValidationState('verified');
      setLastVerifiedUrl(urlToValidate);
      setValidationMessage('链接验证成功。');
      return;
    }

    setValidationState('failed');
    setLastVerifiedUrl(null);
    setValidationMessage(result.message ?? '链接验证失败。');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel="close-add-feed"
        className="max-w-[34rem]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleInputRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>添加 RSS 源</DialogTitle>
          <DialogDescription>填写名称与链接，并选择分类。</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4 border-b border-border pb-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.12em] text-primary">新订阅源</p>
              </div>
              <Badge variant={validationMeta.badgeVariant} className="h-7 rounded-full px-2.5 text-xs font-medium">
                {validationMeta.badgeText}
              </Badge>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="add-feed-title" className="text-xs">
                  名称
                </Label>
                <Input
                  ref={titleInputRef}
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
                  onChange={(event) => {
                    validationRequestIdRef.current += 1;
                    setUrl(event.target.value);
                    resetValidationState();
                  }}
                  onBlur={(event) => {
                    const blurValue = event.currentTarget.value.trim();
                    if (validationState === 'verified' && lastVerifiedUrl === blurValue) {
                      return;
                    }
                    void handleValidate(blurValue);
                  }}
                  placeholder="https://example.com/feed.xml"
                />
                <p role="status" aria-live="polite" className={`mt-1 text-xs ${validationMeta.messageTone}`}>
                  {validationMessage ? (
                    <span className="inline-flex items-center gap-1">
                      {ValidationIcon ? <ValidationIcon size={13} className={validationMeta.iconClassName} /> : null}
                      {validationMessage}
                    </span>
                  ) : (
                    'URL 输入框失焦后会自动校验。'
                  )}
                </p>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="add-feed-category" className="text-xs">
                  分类
                </Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="add-feed-category" aria-label="分类">
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
                <Label htmlFor="add-feed-fulltext-on-open" className="text-xs">
                  打开文章时抓取全文
                </Label>
                <Select value={fullTextOnOpenEnabledValue} onValueChange={setFullTextOnOpenEnabledValue}>
                  <SelectTrigger id="add-feed-fulltext-on-open" aria-label="打开文章时抓取全文">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">关闭</SelectItem>
                    <SelectItem value="enabled">开启</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">开启后会访问原文链接并尝试抽取正文</p>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={!canSave}>
              添加
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

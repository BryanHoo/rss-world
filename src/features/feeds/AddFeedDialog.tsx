import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, type LucideIcon } from 'lucide-react';
import AppDialog from '../../components/common/AppDialog';
import type { Category } from '../../types';
import { validateRssUrl } from './services/rssValidationService';

interface AddFeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onSubmit: (payload: { title: string; url: string; categoryId: string | null }) => void;
}

type ValidationState = 'idle' | 'validating' | 'verified' | 'failed';

interface ValidationStateMeta {
  badgeTone: string;
  badgeText: string;
  messageTone: string;
  icon?: LucideIcon;
  iconClassName?: string;
}

const VALIDATION_STATE_META: Record<ValidationState, ValidationStateMeta> = {
  idle: {
    badgeTone: 'border-gray-200 bg-gray-100 text-gray-600 dark:border-gray-600/80 dark:bg-gray-800 dark:text-gray-300',
    badgeText: '待验证',
    messageTone: 'text-gray-500 dark:text-gray-400',
  },
  validating: {
    badgeTone: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-400/65 dark:bg-blue-400/15 dark:text-blue-200',
    badgeText: '验证中',
    messageTone: 'text-gray-500 dark:text-gray-400',
    icon: Loader2,
    iconClassName: 'animate-spin',
  },
  verified: {
    badgeTone: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/65 dark:bg-emerald-400/15 dark:text-emerald-200',
    badgeText: '验证成功',
    messageTone: 'text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
  },
  failed: {
    badgeTone: 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/65 dark:bg-rose-400/15 dark:text-rose-200',
    badgeText: '验证失败',
    messageTone: 'text-rose-600 dark:text-rose-300',
    icon: AlertCircle,
  },
};

export default function AddFeedDialog({ open, onOpenChange, categories, onSubmit }: AddFeedDialogProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const selectableCategories = categories.filter((item) => item.name !== '未分类');
  const [categoryId, setCategoryId] = useState(() => selectableCategories[0]?.id ?? '');
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
      categoryId: categoryId || null,
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
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="添加 RSS 源"
      description="填写标题与链接，完成验证后即可创建订阅源"
      closeLabel="close-add-feed"
      className="max-w-[34rem]"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-4 border-b border-gray-200/80 pb-4 dark:border-gray-700/80">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.12em] text-blue-700 dark:text-blue-300">新订阅源</p>
              <p className="text-xs text-gray-600 dark:text-gray-300">先验证链接再保存，避免无效源进入列表</p>
            </div>
            <span className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium ${validationMeta.badgeTone}`}>
              {validationMeta.badgeText}
            </span>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <label htmlFor="add-feed-title" className="text-xs font-medium text-gray-700 dark:text-gray-200">
                名称
              </label>
              <input
                id="add-feed-title"
                data-dialog-initial-focus="true"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="例如：The Verge"
                className="h-10 w-full rounded-md border border-gray-200/90 bg-white px-3.5 py-2.5 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/45 dark:border-gray-600/80 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="add-feed-url" className="text-xs font-medium text-gray-700 dark:text-gray-200">
                URL
              </label>
              <input
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
                className="h-10 w-full rounded-md border border-gray-200/90 bg-white px-3.5 py-2.5 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/45 dark:border-gray-600/80 dark:bg-gray-800 dark:text-gray-100"
              />
              <div className="mt-1 flex items-center gap-2">
                <p role="status" aria-live="polite" className={`text-xs ${validationMeta.messageTone}`}>
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
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="add-feed-category" className="text-xs font-medium text-gray-700 dark:text-gray-200">
                分类
              </label>
              <select
                id="add-feed-category"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="h-10 w-full rounded-md border border-gray-200/90 bg-white px-3.5 py-2.5 text-sm text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/45 dark:border-gray-600/80 dark:bg-gray-800 dark:text-gray-100"
              >
                {selectableCategories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
                <option value="">未分类</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            添加
          </button>
        </div>
      </form>
    </AppDialog>
  );
}

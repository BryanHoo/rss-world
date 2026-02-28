'use client';

import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useNotificationContext } from './NotificationProvider';
import { cn } from '@/lib/utils';
import type { NotificationType } from './types';

const toneClassByType: Record<NotificationType, string> = {
  success: 'border-emerald-200 bg-emerald-50/95 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/85 dark:text-emerald-100',
  error: 'border-red-200 bg-red-50/95 text-red-900 dark:border-red-900/60 dark:bg-red-950/85 dark:text-red-100',
  info: 'border-slate-200 bg-white/95 text-slate-800 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100',
};

function TypeIcon({ type }: { type: NotificationType }) {
  if (type === 'success') return <CheckCircle2 size={16} aria-hidden="true" />;
  if (type === 'error') return <AlertCircle size={16} aria-hidden="true" />;
  return <Info size={16} aria-hidden="true" />;
}

export default function NotificationViewport() {
  const { notifications, dismiss } = useNotificationContext();

  return (
    <div
      data-testid="notification-viewport"
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed right-3 top-3 z-[100] flex w-[min(26rem,calc(100vw-1.5rem))] flex-col gap-2 sm:right-4 sm:top-4"
    >
      {notifications.map((item) => (
        <div
          key={item.id}
          role={item.type === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 shadow-md backdrop-blur-sm transition-opacity motion-reduce:transition-none',
            toneClassByType[item.type],
          )}
        >
          <span className="mt-0.5 shrink-0">
            <TypeIcon type={item.type} />
          </span>
          <p className="min-w-0 flex-1 text-sm leading-5">{item.message}</p>
          <button
            type="button"
            onClick={() => dismiss(item.id)}
            aria-label="关闭提醒"
            className="-mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-current/70 transition-colors hover:bg-black/5 hover:text-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:hover:bg-white/10"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

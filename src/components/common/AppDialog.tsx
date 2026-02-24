'use client';

import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface AppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  closeLabel?: string;
  testId?: string;
  overlayTestId?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export default function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  closeLabel = 'close-dialog',
  testId,
  overlayTestId,
  children,
  footer,
  className,
}: AppDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    createPortal(
      <div className="fixed inset-0 z-50">
        <div
          data-testid={overlayTestId}
          className="fixed inset-0 bg-black/45"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onOpenChange(false);
            }
          }}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          data-testid={testId}
          className={`fixed left-1/2 top-1/2 z-[51] grid w-full max-h-[36rem] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-gray-200 bg-white p-0 shadow-xl ${
            className ?? ''
          }`}
        >
          <div className="flex min-h-0 flex-col">
            <header className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
              <div className="space-y-1">
                <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {title}
                </h2>
                {description ? (
                  <p id={descriptionId} className="text-sm text-gray-600 dark:text-gray-400">
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label={closeLabel}
                onClick={() => onOpenChange(false)}
                className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100"
              >
                <X size={18} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>

            {footer ? (
              <footer className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
                {footer}
              </footer>
            ) : null}
          </div>
        </div>
      </div>,
      document.body,
    )
  );
}

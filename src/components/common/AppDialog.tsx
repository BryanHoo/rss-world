'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '../ui/dialog';

export interface AppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  closeLabel?: string;
  testId?: string;
  overlayTestId?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay
          data-testid={overlayTestId}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onOpenChange(false);
            }
          }}
        />
        <DialogContent data-testid={testId} className={cn('max-h-[36rem] max-w-5xl overflow-hidden p-0', className)}>
          <div className="flex min-h-0 flex-col">
            <header className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
              <div className="space-y-1">
                <DialogTitle>{title}</DialogTitle>
                {description ? <DialogDescription>{description}</DialogDescription> : null}
              </div>
              <DialogClose asChild>
                <button
                  type="button"
                  aria-label={closeLabel}
                  className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                >
                  <X size={18} />
                </button>
              </DialogClose>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>

            {footer ? (
              <footer className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
                {footer}
              </footer>
            ) : null}
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

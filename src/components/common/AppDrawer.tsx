'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetOverlay, SheetPortal, SheetTitle } from '../ui/sheet';

export interface AppDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  closeLabel?: string;
  testId?: string;
  overlayTestId?: string;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
}

export default function AppDrawer({
  open,
  onOpenChange,
  title,
  description,
  closeLabel = 'close-drawer',
  testId,
  overlayTestId,
  children,
  headerExtra,
}: AppDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPortal>
        <SheetOverlay data-testid={overlayTestId} />
        <SheetContent data-testid={testId}>
          <header className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <SheetTitle>{title}</SheetTitle>
              {description ? <SheetDescription>{description}</SheetDescription> : null}
            </div>
            <div className="flex items-center gap-2">
              {headerExtra}
              <SheetClose asChild>
                <button type="button" aria-label={closeLabel}>
                  <X size={18} />
                </button>
              </SheetClose>
            </div>
          </header>
          <div className="h-[calc(100vh-73px)] overflow-hidden">{children}</div>
        </SheetContent>
      </SheetPortal>
    </Sheet>
  );
}

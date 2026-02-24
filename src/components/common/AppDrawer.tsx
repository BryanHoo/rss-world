'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import {
  floatingLayerBorderToneClass,
  floatingLayerCloseButtonClass,
  floatingLayerDescriptionClass,
  floatingLayerHeaderClass,
  floatingLayerHeaderExtraClass,
  floatingLayerOverlayClass,
  floatingLayerShellClass,
  floatingLayerTextureClass,
  floatingLayerTitleClass,
  floatingLayerTopAccentClass,
} from './floatingLayerStyles';

export interface AppDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  className?: string;
  closeLabel?: string;
  testId?: string;
  overlayTestId?: string;
  children: ReactNode;
  headerExtra?: ReactNode;
}

export default function AppDrawer({
  open,
  onOpenChange,
  title,
  description,
  className,
  closeLabel = 'close-drawer',
  testId,
  overlayTestId,
  children,
  headerExtra,
}: AppDrawerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      return undefined;
    }

    const overlayAnimation =
      typeof overlayRef.current?.animate === 'function'
        ? overlayRef.current.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 220,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'both',
          })
        : undefined;

    const panelAnimation =
      typeof panelRef.current?.animate === 'function'
        ? panelRef.current.animate(
            [
              { transform: 'translateX(1.25rem)', opacity: 0, filter: 'blur(3px)' },
              { transform: 'translateX(0)', opacity: 1, filter: 'blur(0)' },
            ],
            {
              duration: 260,
              easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
              fill: 'both',
            },
          )
        : undefined;

    return () => {
      overlayAnimation?.cancel();
      panelAnimation?.cancel();
    };
  }, [open]);

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

    previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusRafId = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusRafId);
      previouslyFocusedElementRef.current?.focus();
      previouslyFocusedElementRef.current = null;
    };
  }, [open]);

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
      <div className="pointer-events-none fixed inset-0 z-50">
        <div
          ref={overlayRef}
          data-testid={overlayTestId}
          className={floatingLayerOverlayClass}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onOpenChange(false);
            }
          }}
        />
        <div className="pointer-events-none fixed inset-0 right-0 z-[51] flex justify-end">
          <section
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            data-testid={testId}
            className={`pointer-events-auto relative right-0 flex h-dvh w-full max-w-[620px] flex-col border-l ${floatingLayerBorderToneClass} ${floatingLayerShellClass} ${className ?? ''}`}
          >
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className={floatingLayerTextureClass} />
              <div className={floatingLayerTopAccentClass} />
            </div>

            <header className={floatingLayerHeaderClass}>
              <div className="min-w-0 space-y-1">
                <h2 id={titleId} className={floatingLayerTitleClass}>
                  {title}
                </h2>
                {description ? (
                  <p id={descriptionId} className={floatingLayerDescriptionClass}>
                    {description}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2.5 pl-2">
                {headerExtra ? (
                  <div className={floatingLayerHeaderExtraClass}>
                    {headerExtra}
                  </div>
                ) : null}
                <button
                  ref={closeButtonRef}
                  type="button"
                  aria-label={closeLabel}
                  onClick={() => onOpenChange(false)}
                  className={floatingLayerCloseButtonClass}
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            <div className="relative z-10 min-h-0 flex-1 overflow-hidden">{children}</div>
          </section>
        </div>
      </div>,
      document.body,
    )
  );
}

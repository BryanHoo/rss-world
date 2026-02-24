'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import {
  floatingLayerBorderToneClass,
  floatingLayerCloseButtonClass,
  floatingLayerDescriptionClass,
  floatingLayerFooterClass,
  floatingLayerHeaderClass,
  floatingLayerOverlayClass,
  floatingLayerShellClass,
  floatingLayerTextureClass,
  floatingLayerTitleClass,
  floatingLayerTopAccentClass,
} from './floatingLayerStyles';

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

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

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
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
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
      typeof dialogRef.current?.animate === 'function'
        ? dialogRef.current.animate(
            [
              { transform: 'translateY(1rem) scale(0.975)', opacity: 0, filter: 'blur(3px)' },
              { transform: 'translateY(0) scale(1)', opacity: 1, filter: 'blur(0)' },
            ],
            {
              duration: 280,
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
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) {
        return;
      }

      const focusableElements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true' && element.tabIndex >= 0,
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (!event.shiftKey && activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }

      if (event.shiftKey && (activeElement === firstFocusable || !dialogRef.current.contains(activeElement))) {
        event.preventDefault();
        lastFocusable.focus();
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
      const preferredFocusTarget =
        dialogRef.current?.querySelector<HTMLElement>('[data-dialog-initial-focus="true"]') ??
        dialogRef.current?.querySelector<HTMLElement>('input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])');
      (preferredFocusTarget ?? closeButtonRef.current)?.focus();
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
        <div className="pointer-events-none fixed inset-0 z-[51] flex items-center justify-center p-3 sm:p-4">
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            data-testid={testId}
            className={`pointer-events-auto flex w-full max-h-[min(44rem,calc(100dvh-1.5rem))] max-w-[56rem] flex-col rounded-2xl border ${floatingLayerBorderToneClass} ${floatingLayerShellClass} ${
              className ?? ''
            }`}
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
              <button
                ref={closeButtonRef}
                type="button"
                aria-label={closeLabel}
                onClick={() => onOpenChange(false)}
                className={floatingLayerCloseButtonClass}
              >
                <X size={18} />
              </button>
            </header>

            <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-7">{children}</div>

            {footer ? (
              <footer className={floatingLayerFooterClass}>
                {footer}
              </footer>
            ) : null}
          </section>
        </div>
      </div>,
      document.body,
    )
  );
}

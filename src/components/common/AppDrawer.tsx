'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

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
              { transform: 'translateX(2rem)', opacity: 0, filter: 'blur(4px)' },
              { transform: 'translateX(0)', opacity: 1, filter: 'blur(0)' },
            ],
            {
              duration: 300,
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
          className="pointer-events-auto fixed inset-0 bg-slate-950/52 backdrop-blur-[2px]"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onOpenChange(false);
            }
          }}
        />
        <section
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          data-testid={testId}
          className={`pointer-events-auto fixed right-0 top-0 z-[51] flex h-dvh w-full max-w-[560px] flex-col overflow-hidden border-l border-slate-200/70 bg-white/92 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.75)] backdrop-blur-xl dark:border-slate-700/75 dark:bg-slate-950/90 sm:inset-y-3 sm:right-3 sm:h-[calc(100dvh-1.5rem)] sm:rounded-2xl sm:border ${className ?? ''}`}
        >
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 top-[-18%] h-64 w-64 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-500/20" />
            <div className="absolute left-0 top-0 h-full w-px bg-gradient-to-b from-sky-500/65 via-indigo-500/35 to-transparent dark:from-sky-300/60 dark:via-indigo-300/25" />
          </div>

          <header className="relative z-10 flex items-start justify-between gap-3 border-b border-slate-200/70 bg-white/70 px-6 pb-4 pt-5 backdrop-blur dark:border-slate-700/80 dark:bg-slate-950/60">
            <div className="min-w-0 space-y-1">
              <h2 id={titleId} className="font-brand text-[1.24rem] font-semibold leading-tight text-slate-900 dark:text-slate-50">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="text-sm text-slate-600 dark:text-slate-300">
                  {description}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2.5 pl-2">
              {headerExtra ? <div className="text-xs font-medium tracking-[0.02em]">{headerExtra}</div> : null}
              <button
                ref={closeButtonRef}
                type="button"
                aria-label={closeLabel}
                onClick={() => onOpenChange(false)}
                className="group inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/75 text-slate-500 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-900 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 dark:border-slate-600/70 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <div className="relative z-10 min-h-0 flex-1 overflow-hidden">{children}</div>
        </section>
      </div>,
      document.body,
    )
  );
}

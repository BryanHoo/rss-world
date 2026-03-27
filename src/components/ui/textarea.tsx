'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'min-h-24 w-full rounded-md border border-input/90 bg-[color-mix(in_oklab,var(--color-background)_88%,white_12%)] px-3 py-2 text-sm shadow-field transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-muted-foreground/80 focus-visible:outline-none focus-visible:border-primary/30 focus-visible:ring-2 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Textarea };

'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-[background-color,color,border-color,box-shadow] focus:outline-none focus:ring-2 focus:ring-ring/15 focus:ring-offset-1',
  {
    variants: {
      variant: {
        default:
          'border-primary/12 bg-[linear-gradient(135deg,var(--color-primary),color-mix(in_oklab,var(--color-primary)_74%,white_26%))] text-primary-foreground shadow-button hover:brightness-[1.02]',
        secondary:
          'border-border/70 bg-[color-mix(in_oklab,var(--color-secondary)_78%,white_22%)] text-secondary-foreground shadow-field hover:bg-accent/70',
        destructive:
          'border-destructive/15 bg-destructive text-destructive-foreground hover:bg-destructive/86',
        outline:
          'border-border/70 bg-background/85 text-foreground shadow-field',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof badgeVariants>) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

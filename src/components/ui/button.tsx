'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/92',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/92',
        outline:
          'border border-border/80 bg-background/85 hover:bg-accent/70 hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-accent/85',
        ghost: 'text-muted-foreground hover:bg-accent/80 hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:text-primary/88 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 rounded-md px-2 text-xs',
        compact: 'h-8 rounded-md px-3 text-sm',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<'button'> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
});
Button.displayName = 'Button';

export { Button, buttonVariants };

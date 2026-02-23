'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '../../lib/utils';

const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  return <LabelPrimitive.Root ref={ref} className={cn('text-sm font-medium text-gray-700 dark:text-gray-300', className)} {...props} />;
});

Label.displayName = LabelPrimitive.Root.displayName;

export { Label };

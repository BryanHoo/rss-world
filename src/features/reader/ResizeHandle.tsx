import type { PointerEventHandler } from 'react';
import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  testId: string;
  visible: boolean;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
  onPointerEnter?: PointerEventHandler<HTMLDivElement>;
  onPointerLeave?: PointerEventHandler<HTMLDivElement>;
}

export default function ResizeHandle({
  testId,
  visible,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
}: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      data-testid={testId}
      data-visible={visible ? 'true' : 'false'}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className={cn(
        'relative w-2 shrink-0 cursor-col-resize touch-none before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-border before:transition-opacity before:duration-150',
        visible ? 'before:opacity-100' : 'before:opacity-0',
      )}
    />
  );
}

import type { PointerEventHandler } from 'react';

interface ResizeHandleProps {
  testId: string;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
}

export default function ResizeHandle({ testId, onPointerDown }: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      data-testid={testId}
      onPointerDown={onPointerDown}
      className="relative w-2 shrink-0 cursor-col-resize before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-border"
    />
  );
}

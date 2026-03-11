import type { CSSProperties, PointerEventHandler } from 'react';

interface ResizeHandleProps {
  testId: string;
  active: boolean;
  dragging?: boolean;
  previewOffsetVariable?: string;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
  onPointerEnter?: PointerEventHandler<HTMLDivElement>;
  onPointerLeave?: PointerEventHandler<HTMLDivElement>;
}

export default function ResizeHandle({
  testId,
  active,
  dragging = false,
  previewOffsetVariable,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
}: ResizeHandleProps) {
  const previewTransform = previewOffsetVariable
    ? `translateX(calc(-50% + var(${previewOffsetVariable}, 0px)))`
    : 'translateX(-50%)';
  const separatorStyle: CSSProperties = {
    transform: previewTransform,
  };

  return (
    <div className="relative z-10 h-full w-0 shrink-0 overflow-visible">
      <div
        role="separator"
        aria-orientation="vertical"
        data-testid={testId}
        data-active={active ? 'true' : 'false'}
        onPointerDown={onPointerDown}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        className="absolute inset-y-0 left-1/2 w-3 cursor-col-resize touch-none"
        style={separatorStyle}
      >
        <div
          aria-hidden="true"
          className={[
            'absolute inset-y-0 left-1/2 w-px -translate-x-1/2 rounded-full transition-opacity duration-150',
            active || dragging ? 'opacity-100 bg-primary/70' : 'opacity-0 bg-border/70',
            dragging ? 'will-change-transform' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      </div>
    </div>
  );
}

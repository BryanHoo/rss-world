import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ResizeHandle from './ResizeHandle';

describe('ResizeHandle', () => {
  it('applies preview offset only on the draggable separator hit area', () => {
    render(
      <ResizeHandle
        testId="reader-resize-handle"
        active
        dragging
        previewOffsetVariable="--reader-left-resize-preview-offset"
      />,
    );

    const separator = screen.getByTestId('reader-resize-handle');
    const previewLine = separator.querySelector('[aria-hidden="true"]') as HTMLDivElement | null;

    expect(separator).toHaveStyle({
      transform: 'translateX(calc(-50% + var(--reader-left-resize-preview-offset, 0px)))',
    });
    expect(previewLine).not.toBeNull();
    expect(previewLine!.style.transform).toBe('');
  });
});

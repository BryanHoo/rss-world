import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSettingsAutosave } from './useSettingsAutosave';

describe('useSettingsAutosave', () => {
  it('debounces saveDraft and exposes saving/saved status', async () => {
    vi.useFakeTimers();
    try {
      const saveDraft = vi.fn(async () => ({ ok: true }));

      const { rerender, result } = renderHook(
        ({ tick }) =>
          useSettingsAutosave({
            draftVersion: tick,
            saveDraft,
            hasErrors: false,
          }),
        { initialProps: { tick: 0 } },
      );

      act(() => {
        rerender({ tick: 1 });
      });
      expect(result.current.status).toBe('saving');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
        await Promise.resolve();
      });
      expect(saveDraft).toHaveBeenCalledTimes(1);
      expect(result.current.status).toBe('saved');
    } finally {
      vi.useRealTimers();
    }
  });
});

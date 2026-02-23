import { useEffect, useMemo, useState } from 'react';

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useSettingsAutosave(input: {
  draftVersion: number;
  saveDraft: () => { ok: boolean };
  hasErrors: boolean;
  delayMs?: number;
}) {
  const { draftVersion, saveDraft, hasErrors, delayMs = 500 } = input;
  const [status, setStatus] = useState<AutosaveStatus>('idle');

  useEffect(() => {
    if (draftVersion === 0) {
      return;
    }

    if (hasErrors) {
      setStatus('error');
      return;
    }

    setStatus('saving');
    const timer = window.setTimeout(() => {
      const result = saveDraft();
      setStatus(result.ok ? 'saved' : 'error');
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [draftVersion, hasErrors, saveDraft, delayMs]);

  return useMemo(() => ({ status }), [status]);
}

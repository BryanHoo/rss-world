import { useEffect, useMemo, useState } from 'react';

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useSettingsAutosave(input: {
  draftVersion: number;
  saveDraft: () => { ok: boolean };
  hasErrors: boolean;
  delayMs?: number;
}) {
  const { draftVersion, saveDraft, hasErrors, delayMs = 500 } = input;
  const [lastSavedVersion, setLastSavedVersion] = useState(0);
  const [lastResult, setLastResult] = useState<AutosaveStatus>('idle');

  useEffect(() => {
    if (draftVersion === 0 || hasErrors) {
      return;
    }

    const targetVersion = draftVersion;
    const timer = window.setTimeout(() => {
      const result = saveDraft();
      setLastSavedVersion(targetVersion);
      setLastResult(result.ok ? 'saved' : 'error');
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [draftVersion, hasErrors, saveDraft, delayMs]);

  const status = useMemo<AutosaveStatus>(() => {
    if (draftVersion === 0) {
      return 'idle';
    }

    if (hasErrors) {
      return 'error';
    }

    if (draftVersion > lastSavedVersion) {
      return 'saving';
    }

    return lastResult;
  }, [draftVersion, hasErrors, lastResult, lastSavedVersion]);

  return useMemo(() => ({ status }), [status]);
}

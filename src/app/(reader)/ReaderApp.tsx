'use client';

import ReaderLayout from '../../features/reader/ReaderLayout';
import { ToastHost } from '../../features/toast/ToastHost';
import { useTheme } from '../../hooks/useTheme';
import { useEffect, useRef } from 'react';
import { useAppStore } from '../../store/appStore';
import { useSettingsStore } from '../../store/settingsStore';
import { shouldUseDefaultUnreadOnly } from '../../lib/view';
import type { ViewType } from '../../types';

const AUTO_SNAPSHOT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

interface ReaderAppProps {
  renderedAt?: string;
  initialSelectedView?: ViewType;
}

export default function ReaderApp({ renderedAt, initialSelectedView }: ReaderAppProps) {
  useTheme();
  const selectedView = useAppStore((state) => state.selectedView);
  const loadSnapshot = useAppStore((state) => state.loadSnapshot);
  const hydratePersistedSettings = useSettingsStore((state) => state.hydratePersistedSettings);
  const defaultUnreadOnlyInAll = useSettingsStore((state) => state.persistedSettings.general.defaultUnreadOnlyInAll);
  const lastAutoSnapshotAtRef = useRef<number | null>(null);

  useEffect(() => {
    void loadSnapshot({ view: selectedView });
  }, [loadSnapshot, selectedView]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      const now = Date.now();
      if (
        lastAutoSnapshotAtRef.current !== null &&
        now - lastAutoSnapshotAtRef.current < AUTO_SNAPSHOT_REFRESH_INTERVAL_MS
      ) {
        return;
      }

      lastAutoSnapshotAtRef.current = now;
      const { selectedView: currentView, loadSnapshot: reloadSnapshot } = useAppStore.getState();
      void reloadSnapshot({ view: currentView });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    void hydratePersistedSettings();
  }, [hydratePersistedSettings]);

  useEffect(() => {
    useAppStore.setState({
      showUnreadOnly: shouldUseDefaultUnreadOnly(selectedView) ? defaultUnreadOnlyInAll : false,
    });
  }, [defaultUnreadOnlyInAll, selectedView]);

  return (
    <>
      <ReaderLayout renderedAt={renderedAt} initialSelectedView={initialSelectedView} />
      <ToastHost />
    </>
  );
}

'use client';

import ReaderLayout from '../../features/reader/ReaderLayout';
import { useTheme } from '../../hooks/useTheme';
import { useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { useSettingsStore } from '../../store/settingsStore';

export default function ReaderApp() {
  useTheme();
  const selectedView = useAppStore((state) => state.selectedView);
  const loadSnapshot = useAppStore((state) => state.loadSnapshot);
  const hydratePersistedSettings = useSettingsStore((state) => state.hydratePersistedSettings);
  const sidebarCollapsed = useSettingsStore((state) => state.persistedSettings.general.sidebarCollapsed);

  useEffect(() => {
    void loadSnapshot({ view: selectedView });
  }, [loadSnapshot, selectedView]);

  useEffect(() => {
    void hydratePersistedSettings();
  }, [hydratePersistedSettings]);

  useEffect(() => {
    useAppStore.setState({ sidebarCollapsed });
  }, [sidebarCollapsed]);

  return <ReaderLayout />;
}

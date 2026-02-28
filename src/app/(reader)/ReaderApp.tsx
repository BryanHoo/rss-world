'use client';

import ReaderLayout from '../../features/reader/ReaderLayout';
import { NotificationProvider } from '../../features/notifications/NotificationProvider';
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
  const defaultUnreadOnlyInAll = useSettingsStore((state) => state.persistedSettings.general.defaultUnreadOnlyInAll);

  useEffect(() => {
    void loadSnapshot({ view: selectedView });
  }, [loadSnapshot, selectedView]);

  useEffect(() => {
    void hydratePersistedSettings();
  }, [hydratePersistedSettings]);

  useEffect(() => {
    useAppStore.setState({ sidebarCollapsed });
  }, [sidebarCollapsed]);

  useEffect(() => {
    useAppStore.setState({
      showUnreadOnly: selectedView !== 'unread' && selectedView !== 'starred' ? defaultUnreadOnlyInAll : false,
    });
  }, [defaultUnreadOnlyInAll, selectedView]);

  return (
    <NotificationProvider>
      <ReaderLayout />
    </NotificationProvider>
  );
}

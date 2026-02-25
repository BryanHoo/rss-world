'use client';

import ReaderLayout from '../../features/reader/ReaderLayout';
import { useTheme } from '../../hooks/useTheme';
import { useEffect } from 'react';
import { useAppStore } from '../../store/appStore';

export default function ReaderApp() {
  useTheme();
  const selectedView = useAppStore((state) => state.selectedView);
  const loadSnapshot = useAppStore((state) => state.loadSnapshot);

  useEffect(() => {
    void loadSnapshot({ view: selectedView });
  }, [loadSnapshot, selectedView]);

  return <ReaderLayout />;
}

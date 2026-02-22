'use client';

import ReaderLayout from '../../features/reader/ReaderLayout';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useTheme } from '../../hooks/useTheme';

export default function ReaderApp() {
  useTheme();
  useKeyboardShortcuts();
  return <ReaderLayout />;
}

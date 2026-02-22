'use client';

import Layout from '../../components/Layout';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useTheme } from '../../hooks/useTheme';

export default function ReaderApp() {
  useTheme();
  useKeyboardShortcuts();
  return <Layout />;
}

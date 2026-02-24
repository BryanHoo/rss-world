'use client';

import ReaderLayout from '../../features/reader/ReaderLayout';
import { useTheme } from '../../hooks/useTheme';

export default function ReaderApp() {
  useTheme();
  return <ReaderLayout />;
}

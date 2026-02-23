import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FeedFuse',
  description: 'Modern RSS reader',
  icons: {
    icon: [
      { url: '/feedfuse-icon-16.svg', sizes: '16x16', type: 'image/svg+xml' },
      { url: '/feedfuse-icon-32.svg', sizes: '32x32', type: 'image/svg+xml' },
      { url: '/feedfuse-icon-64.svg', sizes: '64x64', type: 'image/svg+xml' },
      { url: '/feedfuse-icon-128.svg', sizes: '128x128', type: 'image/svg+xml' }
    ],
    shortcut: '/feedfuse-icon-32.svg',
    apple: '/feedfuse-icon-128.svg'
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

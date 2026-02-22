import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'rss-world',
  description: 'Modern RSS reader',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

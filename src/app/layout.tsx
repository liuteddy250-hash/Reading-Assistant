import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Nav } from '@/components/Nav';

export const metadata: Metadata = {
  title: 'ReadEasy · 英语阅读辅助',
  description: '上传 PDF 英文书，先预习长难句与难词，再进入带高亮与划词翻译的沉浸阅读。',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Nav />
        <main className="app-main">{children}</main>
      </body>
    </html>
  );
}

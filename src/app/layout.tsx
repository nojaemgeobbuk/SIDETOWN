import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SideTown — 사이드 프로젝트 마을',
  description: '현실의 프로젝트를 퀘스트로 나누고, 완료할 때마다 마을이 자라는 웹앱 (단계 0 검증 빌드)',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0E111B',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* 런타임 로드: 빌드 환경의 네트워크와 무관하게 동작 */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Silkscreen&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import './globals.css';
import { adsenseClient } from '@/lib/adsense';

export const metadata: Metadata = {
  title: 'SideTown — 사이드 프로젝트 마을',
  description: '현실의 프로젝트를 퀘스트로 나누고, 완료할 때마다 마을이 자라는 웹앱',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0E111B',
};

/** AdSense 게시자 ID(ca-pub-…). 넣으면 AdSense 자동 광고(앵커 등 플로팅 광고)가 켜진다 */
const ADSENSE_CLIENT = adsenseClient();

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
        {ADSENSE_CLIENT && (
          // AdSense가 사이트 확인·자동 광고에 쓰는 코드. 어떤 광고를 어디에 띄울지는 AdSense ‘자동 광고’ 설정에서 정한다
          <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`} crossOrigin="anonymous" />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}

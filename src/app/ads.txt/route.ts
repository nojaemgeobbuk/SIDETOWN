import { adsenseClient } from '@/lib/adsense';

/** AdSense가 요구하는 /ads.txt. NEXT_PUBLIC_ADSENSE_CLIENT로 만든다(값을 바꾸면 다시 배포) */
export function GET() {
  const client = adsenseClient();
  const body = client ? `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n` : '# 광고 미설정\n';
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

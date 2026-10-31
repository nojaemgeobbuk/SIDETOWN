/** AdSense가 요구하는 /ads.txt. NEXT_PUBLIC_ADSENSE_CLIENT(ca-pub-…)로 만든다 */
export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() ?? '';
  const ok = /^ca-pub-\d{10,20}$/.test(client);
  const body = ok ? `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n` : '# 광고 미설정\n';
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

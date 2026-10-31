/**
 * AdSense 게시자 ID. Vercel에 어떤 형태로 넣어도 받아 준다:
 * "ca-pub-123…", "pub-123…", "123…"(숫자만), 따옴표·공백이 섞여도 됨 → 항상 "ca-pub-123…"
 * NEXT_PUBLIC_ 변수는 빌드할 때 코드에 박히므로, 값을 바꾼 뒤에는 꼭 다시 배포해야 한다.
 */
export function adsenseClient(raw = process.env.NEXT_PUBLIC_ADSENSE_CLIENT): string | null {
  const digits = (raw ?? '').replace(/["'\s]/g, '').match(/^(?:ca-)?(?:pub-)?(\d{10,20})$/i)?.[1];
  return digits ? `ca-pub-${digits}` : null;
}

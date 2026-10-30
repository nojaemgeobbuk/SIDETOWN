/**
 * 집중 모드 날씨 — 기획서 6.6(v1.4).
 * 영상 장면을 없애고, 마을 지도 위에 실시간 날씨 층(AmbientLayer)만 얹는다.
 * SceneId 이름은 날씨 층 내부에서 쓰는 값이다(evening = 맑음: 낙엽·새 떼·반딧불).
 */
export type SceneId = 'evening' | 'rain' | 'snow';

export const WEATHERS: { id: SceneId; label: string; ambience: Partial<Record<'rain' | 'fire' | 'cafe' | 'wave', number>> }[] = [
  { id: 'evening', label: '맑음', ambience: { rain: 0, cafe: 25, wave: 30 } },
  { id: 'rain', label: '비', ambience: { rain: 70, cafe: 15, wave: 20 } },
  { id: 'snow', label: '눈', ambience: { rain: 0, fire: 45, cafe: 15, wave: 10 } },
];

/**
 * 바람 세기(0~1). 느린 사인 합으로 잔잔하게 변하다가 가끔 돌풍이 분다.
 * 같은 시각이면 같은 값이 나오도록 순수 함수로 둔다(테스트 가능).
 */
export function windAt(tMs: number): number {
  const t = tMs / 1000;
  const base = 0.35 + 0.18 * Math.sin(t / 23) + 0.1 * Math.sin(t / 7.3 + 1.7);
  // 약 47초마다 6초짜리 돌풍
  const phase = (t % 47) / 6;
  const gust = phase < 1 ? Math.sin(phase * Math.PI) * 0.45 : 0;
  return Math.max(0, Math.min(1, base + gust));
}

export function windLabel(w: number): string {
  if (w < 0.3) return '바람 잔잔';
  if (w < 0.6) return '바람 조금';
  return '돌풍';
}

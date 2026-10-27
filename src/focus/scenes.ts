/**
 * 집중 모드 장면 — 기획서 6.6.
 * 영상: Higgsfield(Kling 3.0)로 만든 10초 루프. 시작·끝 프레임을 같은 그림으로 지정하고
 * 끝 0.6초를 처음과 겹쳐(크로스페이드) 이음새 없이 반복된다.
 * 사람·고양이·우산·커피·물결·바람의 기본 움직임은 영상에, 바람 세기 변화·새 떼·반딧불·낙엽은
 * AmbientLayer가 실시간으로 얹는다.
 * 영상은 Higgsfield CDN에 있다. 단계 1에서 서비스 저장소(Supabase Storage)로 옮긴다.
 */
export type SceneId = 'evening' | 'rain' | 'snow';

export interface Scene {
  id: SceneId;
  label: string;
  alt: string;
  poster: string;
  video: string;
  /** 세로 화면용 */
  posterPortrait: string;
  videoPortrait: string;
}

const CDN = 'https://d2ol7oe51mr4n9.cloudfront.net/user_34SA7ZeBXVtWFded4tpPq5vJcH1';
const PORTRAIT_VIDEO = `${CDN}/6432b30d-76d1-4e51-8c15-5fd6c8d1755a.mp4`;

export const SCENES: Scene[] = [
  {
    id: 'evening',
    label: '맑은 저녁',
    alt: '바람이 부는 저녁 마을. 사람들이 광장을 걷고 카페에서 커피를 마신다',
    poster: '/assets/scenes/town-night.jpg',
    video: `${CDN}/3f372131-b131-42c5-adbe-341d1497d1ba.mp4`,
    posterPortrait: '/assets/scenes/town-portrait.jpg',
    videoPortrait: PORTRAIT_VIDEO,
  },
  {
    id: 'rain',
    label: '비 오는 밤',
    alt: '비 오는 밤의 마을. 우산을 쓴 사람들이 지나가고 물웅덩이에 불빛이 비친다',
    poster: '/assets/scenes/town-rain.jpg',
    video: `${CDN}/9bf3b255-d38e-493a-a7a0-7803784d1787.mp4`,
    posterPortrait: '/assets/scenes/town-portrait.jpg',
    videoPortrait: PORTRAIT_VIDEO,
  },
  {
    id: 'snow',
    label: '눈 오는 밤',
    alt: '눈 오는 밤의 마을. 벤치에서 따뜻한 음료를 마시는 사람과 작은 새',
    poster: '/assets/scenes/town-snow.jpg',
    video: `${CDN}/b4ea1cea-a803-4c89-9bdd-4f072c2b27db.mp4`,
    posterPortrait: '/assets/scenes/town-portrait.jpg',
    videoPortrait: PORTRAIT_VIDEO,
  },
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

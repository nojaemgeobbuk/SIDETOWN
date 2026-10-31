import type { BuildingType } from '@/lib/types';

/**
 * 마을 섬. v1.6부터 땅 넓히기 대신 처음부터 32×32로 넓혔다.
 * 기본 구역(0~23) 동쪽·남쪽에 띠 모양 땅이 붙어 있고, 프로젝트 부지는 모두 9칸이다.
 */
export const MAP_W = 32;
export const MAP_H = 32;

export type Ground = 'grass' | 'paving' | 'water' | 'void';

export interface Plot {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 문 앞 도착 칸(건물 바깥) */
  entrance: { x: number; y: number };
}

export interface StaticBuilding {
  id: string;
  kind: 'cafe' | 'home' | 'hall';
  label: string;
  plot: Plot;
}

/** 그림 파일로 그리는 소품 */
export type SpriteProp = 'tree' | 'lamp' | 'bench' | 'planter' | 'tree-autumn' | 'tree-blossom' | 'bush';
/** 코드로 그리는 꾸밈 요소(복셀) */
export type DecorKind =
  | 'flowers' | 'rock' | 'fence' | 'crates' | 'haybale' | 'well' | 'campfire' | 'signpost'
  | 'mailbox' | 'boat' | 'dock' | 'lily' | 'stall' | 'picnic' | 'pumpkins';

export interface Prop {
  kind: SpriteProp | DecorKind;
  /** 색 조합 등 변형 번호 */
  v?: number;
  x: number;
  y: number;
  w?: number;
  h?: number;
}

/** 프로젝트 부지. 비어 있으면 공사 표지가 보이고 누르면 착공할 수 있다.
 *  (단계 0에서는 a~c가 예시 프로젝트 고정 자리였지만, 실제 마을은 처음에 모두 비어 있다) */
export const EMPTY_PLOTS: Plot[] = [
  { id: 'plot-a', x: 3, y: 2, w: 4, h: 4, entrance: { x: 7, y: 4 } },
  { id: 'plot-b', x: 3, y: 10, w: 4, h: 4, entrance: { x: 7, y: 12 } },
  { id: 'plot-c', x: 12, y: 2, w: 4, h: 4, entrance: { x: 16, y: 4 } },
  { id: 'plot-d', x: 3, y: 17, w: 4, h: 4, entrance: { x: 7, y: 19 } },
  { id: 'plot-e', x: 18, y: 2, w: 4, h: 4, entrance: { x: 17, y: 6 } },
  // 동쪽 언덕(예전 땅 넓히기 1구역과 같은 id라 이미 지은 건물이 그대로 남는다)
  { id: 'plot-e1a', x: 25, y: 2, w: 4, h: 4, entrance: { x: 27, y: 6 } },
  { id: 'plot-e1b', x: 25, y: 10, w: 4, h: 4, entrance: { x: 27, y: 9 } },
  // 남쪽 들판
  { id: 'plot-s1a', x: 2, y: 26, w: 4, h: 4, entrance: { x: 6, y: 28 } },
  { id: 'plot-s1b', x: 10, y: 26, w: 4, h: 4, entrance: { x: 9, y: 28 } },
];

/** 고정 프로젝트 부지(지금은 없음) */
export const PROJECT_PLOTS: Plot[] = [];

export const STATIC_BUILDINGS: StaticBuilding[] = [
  { id: 'cafe', kind: 'cafe', label: '공용 카페', plot: { id: 'cafe', x: 16, y: 10, w: 4, h: 4, entrance: { x: 15, y: 12 } } },
  { id: 'home', kind: 'home', label: '내 집', plot: { id: 'home', x: 11, y: 17, w: 3, h: 3, entrance: { x: 14, y: 18 } } },
  { id: 'hall', kind: 'hall', label: '명예의 전당', plot: { id: 'hall', x: 20, y: 9, w: 3, h: 3, entrance: { x: 21, y: 12 } } },
];

export const PROPS: Prop[] = [
  // ── 광장·기본 구역 ──
  { kind: 'planter', x: 11, y: 10, w: 2, h: 2 },
  { kind: 'lamp', x: 9, y: 9 },
  { kind: 'lamp', x: 14, y: 9 },
  { kind: 'lamp', x: 9, y: 13 },
  { kind: 'lamp', x: 14, y: 13 },
  { kind: 'bench', x: 10, y: 14 },
  { kind: 'tree', x: 1, y: 1 },
  { kind: 'tree', x: 9, y: 2 },
  { kind: 'tree', x: 1, y: 9 },
  { kind: 'tree', x: 10, y: 5 },
  { kind: 'tree-blossom', x: 23, y: 4 },
  { kind: 'tree', x: 1, y: 15 },
  { kind: 'tree', x: 9, y: 19 },
  { kind: 'tree-autumn', x: 16, y: 19 },
  { kind: 'tree', x: 22, y: 14 },
  { kind: 'tree-autumn', x: 6, y: 22 },
  { kind: 'flowers', x: 11, y: 4, v: 0 },
  { kind: 'flowers', x: 1, y: 4, v: 1 },
  { kind: 'flowers', x: 18, y: 14, v: 2 },
  { kind: 'flowers', x: 17, y: 9, v: 3 },
  { kind: 'signpost', x: 7, y: 9 },
  { kind: 'mailbox', x: 10, y: 17 },
  { kind: 'well', x: 4, y: 15 },
  { kind: 'crates', x: 2, y: 6 },
  { kind: 'pumpkins', x: 14, y: 20 },
  { kind: 'pumpkins', x: 7, y: 16, v: 1 },
  { kind: 'bush', x: 17, y: 15 },
  { kind: 'bush', x: 2, y: 22 },
  { kind: 'rock', x: 1, y: 12 },
  { kind: 'rock', x: 0, y: 20, v: 1 },
  { kind: 'lily', x: 21, y: 19 },
  { kind: 'lily', x: 19, y: 24, v: 1 },
  { kind: 'lily', x: 24, y: 25 },
  // ── 동쪽 언덕 ──
  { kind: 'tree', x: 30, y: 1 },
  { kind: 'tree-blossom', x: 30, y: 12 },
  { kind: 'lamp', x: 29, y: 6 },
  { kind: 'tree', x: 24, y: 12 },
  { kind: 'flowers', x: 30, y: 4, v: 4 },
  { kind: 'pumpkins', x: 31, y: 10 },
  { kind: 'tree-autumn', x: 30, y: 15 },
  { kind: 'tree-autumn', x: 31, y: 18 },
  { kind: 'tree-autumn', x: 28, y: 15 },
  { kind: 'haybale', x: 28, y: 18 },
  { kind: 'crates', x: 30, y: 20 },
  { kind: 'lamp', x: 30, y: 22 },
  { kind: 'dock', x: 25, y: 21, w: 2, h: 1 },
  { kind: 'boat', x: 23, y: 22 },
  { kind: 'rock', x: 29, y: 25 },
  { kind: 'bush', x: 31, y: 26 },
  // ── 남쪽 들판 ──
  { kind: 'tree', x: 1, y: 30 },
  { kind: 'tree', x: 12, y: 31 },
  { kind: 'lamp', x: 7, y: 25 },
  { kind: 'bench', x: 9, y: 30 },
  { kind: 'stall', x: 15, y: 24, w: 2, h: 1 },
  { kind: 'campfire', x: 15, y: 28 },
  { kind: 'picnic', x: 17, y: 30 },
  { kind: 'fence', x: 1, y: 31, w: 6, h: 1 },
  { kind: 'flowers', x: 6, y: 24, v: 2 },
  { kind: 'flowers', x: 20, y: 29, v: 0 },
  { kind: 'flowers', x: 22, y: 30, v: 3 },
  { kind: 'flowers', x: 24, y: 29, v: 1 },
  { kind: 'haybale', x: 28, y: 29, v: 1 },
  { kind: 'tree-autumn', x: 30, y: 28 },
  { kind: 'tree-blossom', x: 26, y: 31 },
  { kind: 'pumpkins', x: 1, y: 25, v: 1 },
  { kind: 'bush', x: 0, y: 27 },
  { kind: 'rock', x: 14, y: 31, v: 1 },
];

/** 물 위에 떠 있는 꾸밈(지면 층에 그리고 길 막기와 무관) */
export const FLAT_DECOR: Prop['kind'][] = ['lily', 'dock', 'boat', 'picnic'];

const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) =>
  x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

const ALL_PLOTS = [...PROJECT_PLOTS, ...EMPTY_PLOTS, ...STATIC_BUILDINGS.map((s) => s.plot)];

/** 호수: 기본 구역 오른쪽 아래에서 동·남쪽 땅 사이까지 */
const isLake = (x: number, y: number) => (x >= 18 && x <= 26 && y >= 17 && y <= 27 && !(x === 26 && (y === 17 || y === 27)) && !(x === 18 && y === 27)) || (x >= 20 && x <= 25 && y >= 15 && y <= 16);

export function groundAt(x: number, y: number): Ground {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return 'void';
  if (isLake(x, y)) return 'water';
  const plaza = x >= 8 && x <= 15 && y >= 7 && y <= 15;
  const mainRoad = y === 7 || y === 8 || x === 8 || (x === 15 && y <= 23) || (y >= 11 && y <= 12 && x >= 7 && x <= 16);
  const toHome = x >= 11 && x <= 14 && y >= 15 && y <= 18;
  // 동쪽 언덕에서 호숫가 선착장으로 내려가는 길
  const toDock = (x === 29 && y >= 9 && y <= 21) || (y === 21 && x >= 27 && x <= 29);
  const entrance = ALL_PLOTS.some((p) => p.entrance.x === x && p.entrance.y === y);
  const plot = ALL_PLOTS.some((p) => inRect(x, y, p));
  if (plaza || mainRoad || toHome || toDock || entrance || plot) return 'paving';
  return 'grass';
}

/** 새 프로젝트가 들어선 빈 부지는 막힌 칸이 된다 */
const occupiedEmpty = new Set<string>();
export function setOccupiedPlots(ids: string[]) {
  occupiedEmpty.clear();
  for (const id of ids) if (EMPTY_PLOTS.some((p) => p.id === id)) occupiedEmpty.add(id);
}
export function isPlotFree(id: string) {
  return EMPTY_PLOTS.some((p) => p.id === id) && !occupiedEmpty.has(id);
}

function blockedByObject(x: number, y: number): boolean {
  if ([...PROJECT_PLOTS, ...STATIC_BUILDINGS.map((s) => s.plot)].some((p) => inRect(x, y, p))) return true;
  if (EMPTY_PLOTS.some((p) => occupiedEmpty.has(p.id) && inRect(x, y, p))) return true;
  return PROPS.some((p) => inRect(x, y, { x: p.x, y: p.y, w: p.w ?? 1, h: p.h ?? 1 }));
}

export function isWalkable(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false;
  const g = groundAt(x, y);
  if (g === 'water' || g === 'void') return false;
  return !blockedByObject(x, y);
}

export function plotById(id: string): Plot | undefined {
  return ALL_PLOTS.find((p) => p.id === id);
}

export type SpriteKey = `${BuildingType}-s${0 | 1 | 2 | 3}` | 'workshop-decayed' | 'workshop-repairing' | 'cafe' | 'home' | SpriteProp;

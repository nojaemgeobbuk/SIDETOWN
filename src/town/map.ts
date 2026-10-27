import type { BuildingType } from '@/lib/types';

/** 단계 0 검증 맵. 기획서 7.2의 64×64는 확장 시안, 여기서는 24×24 한 구역으로 검증한다. */
export const MAP_W = 24;
export const MAP_H = 24;

export type Ground = 'grass' | 'paving' | 'water';

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
  kind: 'cafe' | 'home';
  label: string;
  plot: Plot;
}

export interface Prop {
  kind: 'tree' | 'lamp' | 'bench' | 'planter';
  x: number;
  y: number;
  w?: number;
  h?: number;
}

export const PROJECT_PLOTS: Plot[] = [
  { id: 'plot-a', x: 3, y: 2, w: 4, h: 4, entrance: { x: 7, y: 4 } },
  { id: 'plot-b', x: 3, y: 10, w: 4, h: 4, entrance: { x: 7, y: 12 } },
  { id: 'plot-c', x: 12, y: 2, w: 4, h: 4, entrance: { x: 16, y: 4 } },
];

/** 빈 프로젝트 부지(새 프로젝트를 놓을 자리) */
export const EMPTY_PLOTS: Plot[] = [
  { id: 'plot-d', x: 3, y: 17, w: 4, h: 4, entrance: { x: 7, y: 19 } },
  { id: 'plot-e', x: 18, y: 2, w: 4, h: 4, entrance: { x: 17, y: 6 } },
];

export const STATIC_BUILDINGS: StaticBuilding[] = [
  { id: 'cafe', kind: 'cafe', label: '공용 카페', plot: { id: 'cafe', x: 16, y: 10, w: 4, h: 4, entrance: { x: 15, y: 12 } } },
  { id: 'home', kind: 'home', label: '내 집', plot: { id: 'home', x: 11, y: 17, w: 3, h: 3, entrance: { x: 14, y: 18 } } },
];

export const PROPS: Prop[] = [
  { kind: 'planter', x: 11, y: 10, w: 2, h: 2 },
  { kind: 'lamp', x: 9, y: 9 },
  { kind: 'lamp', x: 14, y: 9 },
  { kind: 'lamp', x: 9, y: 13 },
  { kind: 'lamp', x: 14, y: 13 },
  { kind: 'bench', x: 10, y: 14 },
  { kind: 'tree', x: 1, y: 1 },
  { kind: 'tree', x: 9, y: 2 },
  { kind: 'tree', x: 1, y: 7 },
  { kind: 'tree', x: 10, y: 5 },
  { kind: 'tree', x: 21, y: 8 },
  { kind: 'tree', x: 1, y: 15 },
  { kind: 'tree', x: 9, y: 19 },
  { kind: 'tree', x: 16, y: 19 },
  { kind: 'tree', x: 22, y: 14 },
  { kind: 'tree', x: 8, y: 22 },
];

const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) =>
  x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

const ALL_PLOTS = [...PROJECT_PLOTS, ...EMPTY_PLOTS, ...STATIC_BUILDINGS.map((s) => s.plot)];

export function groundAt(x: number, y: number): Ground {
  if (x >= 18 && y >= 17) return 'water';
  if (x >= 20 && y >= 15) return 'water';
  const plaza = x >= 8 && x <= 15 && y >= 7 && y <= 15;
  const mainRoad = y === 7 || y === 8 || x === 8 || x === 15 || (y >= 11 && y <= 12 && x >= 7 && x <= 16);
  const toHome = x >= 11 && x <= 14 && y >= 15 && y <= 18;
  const entrance = ALL_PLOTS.some((p) => p.entrance.x === x && p.entrance.y === y);
  const plot = ALL_PLOTS.some((p) => inRect(x, y, p));
  if (plaza || mainRoad || toHome || entrance || plot) return 'paving';
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
  if (groundAt(x, y) === 'water') return false;
  return !blockedByObject(x, y);
}

export function plotById(id: string): Plot | undefined {
  return ALL_PLOTS.find((p) => p.id === id);
}

export type SpriteKey = `${BuildingType}-s${0 | 1 | 2 | 3}` | 'workshop-decayed' | 'workshop-repairing' | 'cafe' | 'home' | Prop['kind'];

import type { BuildingType } from '@/lib/types';

/** 단계 0 검증 맵. 기획서 7.2의 64×64는 확장 시안, 여기서는 24×24 한 구역으로 검증한다. */
export const MAP_W = 24;
export const MAP_H = 24;

export type Ground = 'grass' | 'paving' | 'water' | 'void';

/**
 * 땅 넓히기(v1.5): 기본 섬 24×24 옆에 프로젝트 부지 2칸짜리 구역을 정해진 순서로 붙인다.
 * 동쪽(e)은 가로 큰길(y 7·8)을, 남쪽(s)은 세로 큰길(x 8)을 이어 받는다. 세계는 최대 40×40.
 */
export const WORLD_W = 40;
export const WORLD_H = 40;

export interface District {
  id: 'e1' | 's1' | 'e2' | 's2';
  label: string;
  area: { x: number; y: number; w: number; h: number };
  road: 'h' | 'v';
  plots: Plot[];
  /** 섬 가장자리의 ‘+’ 버튼 자리(아직 열리지 않은 땅 쪽) */
  anchor: { x: number; y: number };
}

const eastDistrict = (id: 'e1' | 'e2', x0: number, label: string): District => ({
  id,
  label,
  area: { x: x0, y: 0, w: 8, h: 14 },
  road: 'h',
  plots: [
    { id: `plot-${id}a`, x: x0 + 1, y: 2, w: 4, h: 4, entrance: { x: x0 + 3, y: 6 } },
    { id: `plot-${id}b`, x: x0 + 1, y: 10, w: 4, h: 4, entrance: { x: x0 + 3, y: 9 } },
  ],
  anchor: { x: x0 + 1, y: 7.5 },
});
const southDistrict = (id: 's1' | 's2', y0: number, label: string): District => ({
  id,
  label,
  area: { x: 0, y: y0, w: 14, h: 8 },
  road: 'v',
  plots: [
    { id: `plot-${id}a`, x: 2, y: y0 + 2, w: 4, h: 4, entrance: { x: 6, y: y0 + 4 } },
    { id: `plot-${id}b`, x: 10, y: y0 + 2, w: 4, h: 4, entrance: { x: 9, y: y0 + 4 } },
  ],
  anchor: { x: 8.5, y: y0 + 1 },
});

/** 열리는 순서 */
export const DISTRICTS: District[] = [
  eastDistrict('e1', 24, '동쪽 언덕'),
  southDistrict('s1', 24, '남쪽 들판'),
  eastDistrict('e2', 32, '먼 동쪽'),
  southDistrict('s2', 32, '먼 남쪽'),
];

let unlockedDistricts: District[] = [];
const BASE_PLOT_IDS = ['plot-a', 'plot-b', 'plot-c', 'plot-d', 'plot-e'];

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

export interface Prop {
  kind: 'tree' | 'lamp' | 'bench' | 'planter';
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
];
/** 열린 구역의 부지까지 포함하도록 setExpansions가 이 배열을 바꾼다 */
export function setExpansions(ids: string[]) {
  unlockedDistricts = DISTRICTS.filter((d) => ids.includes(d.id));
  const keep = EMPTY_PLOTS.filter((p) => BASE_PLOT_IDS.includes(p.id));
  EMPTY_PLOTS.length = 0;
  EMPTY_PLOTS.push(...keep, ...unlockedDistricts.flatMap((d) => d.plots));
}
export function unlockedIds(): string[] {
  return unlockedDistricts.map((d) => d.id);
}
/** 다음에 열 수 있는 구역(없으면 다 열림) */
export function nextDistrict(): District | undefined {
  return DISTRICTS.find((d) => !unlockedDistricts.includes(d));
}
/** 땅이 있는 범위(카메라 맞춤용) */
export function landBounds() {
  let w = MAP_W;
  let h = MAP_H;
  for (const d of unlockedDistricts) {
    w = Math.max(w, d.area.x + d.area.w);
    h = Math.max(h, d.area.y + d.area.h);
  }
  return { w, h };
}

/** 고정 프로젝트 부지(지금은 없음) */
export const PROJECT_PLOTS: Plot[] = [];

export const STATIC_BUILDINGS: StaticBuilding[] = [
  { id: 'cafe', kind: 'cafe', label: '공용 카페', plot: { id: 'cafe', x: 16, y: 10, w: 4, h: 4, entrance: { x: 15, y: 12 } } },
  { id: 'home', kind: 'home', label: '내 집', plot: { id: 'home', x: 11, y: 17, w: 3, h: 3, entrance: { x: 14, y: 18 } } },
  { id: 'hall', kind: 'hall', label: '명예의 전당', plot: { id: 'hall', x: 20, y: 9, w: 3, h: 3, entrance: { x: 21, y: 12 } } },
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
  { kind: 'tree', x: 22, y: 7 },
  { kind: 'tree', x: 1, y: 15 },
  { kind: 'tree', x: 9, y: 19 },
  { kind: 'tree', x: 16, y: 19 },
  { kind: 'tree', x: 22, y: 14 },
  { kind: 'tree', x: 8, y: 22 },
];

/** 구역에만 있는 소품(열렸을 때만 그린다) */
export const DISTRICT_PROPS: Record<District['id'], Prop[]> = {
  e1: [{ kind: 'tree', x: 30, y: 1 }, { kind: 'tree', x: 30, y: 12 }, { kind: 'lamp', x: 29, y: 6 }, { kind: 'tree', x: 24, y: 12 }],
  s1: [{ kind: 'tree', x: 1, y: 30 }, { kind: 'tree', x: 12, y: 30 }, { kind: 'lamp', x: 7, y: 25 }, { kind: 'bench', x: 9, y: 30 }],
  e2: [{ kind: 'tree', x: 38, y: 1 }, { kind: 'tree', x: 38, y: 12 }, { kind: 'lamp', x: 37, y: 6 }],
  s2: [{ kind: 'tree', x: 1, y: 38 }, { kind: 'tree', x: 12, y: 38 }, { kind: 'lamp', x: 7, y: 33 }],
};

const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) =>
  x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

const ALL_PLOTS = [...PROJECT_PLOTS, ...EMPTY_PLOTS, ...STATIC_BUILDINGS.map((s) => s.plot), ...DISTRICTS.flatMap((d) => d.plots)];

export function groundAt(x: number, y: number): Ground {
  if (x < 0 || y < 0) return 'void';
  if (x >= MAP_W || y >= MAP_H) {
    const d = unlockedDistricts.find((z) => inRect(x, y, z.area));
    if (!d) return 'void';
    const road = d.road === 'h' ? y === 7 || y === 8 : x === 8;
    const onPlot = d.plots.some((p) => inRect(x, y, p) || (p.entrance.x === x && p.entrance.y === y));
    return road || onPlot ? 'paving' : 'grass';
  }
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
  return [...PROPS, ...unlockedDistricts.flatMap((d) => DISTRICT_PROPS[d.id])].some((p) => inRect(x, y, { x: p.x, y: p.y, w: p.w ?? 1, h: p.h ?? 1 }));
}

export function isWalkable(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return false;
  const g = groundAt(x, y);
  if (g === 'water' || g === 'void') return false;
  return !blockedByObject(x, y);
}

export function plotById(id: string): Plot | undefined {
  return ALL_PLOTS.find((p) => p.id === id);
}

export type SpriteKey = `${BuildingType}-s${0 | 1 | 2 | 3}` | 'workshop-decayed' | 'workshop-repairing' | 'cafe' | 'home' | Prop['kind'];

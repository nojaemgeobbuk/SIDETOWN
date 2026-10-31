import { describe, expect, it } from 'vitest';
import { findPath } from './astar';
import { DEFAULT_LAYOUT, EMPTY_PLOTS, firstFreeLot, FLAT_DECOR, groundAt, isPlotFree, isWalkable, MAP_H, MAP_W, placeAt, PROPS, setLayout, setOccupiedPlots, STATIC_BUILDINGS } from './map';

const WATER_DECOR = ['lily', 'dock', 'boat'];

describe('넓힌 마을 지도(v1.6)', () => {
  it('부지는 12칸(프로젝트 9 + 공용 건물 처음 자리 3)', () => {
    expect(EMPTY_PLOTS).toHaveLength(12);
    expect(EMPTY_PLOTS.filter((p) => p.id.startsWith('plot-'))).toHaveLength(9);
    expect(new Set(EMPTY_PLOTS.map((p) => p.id)).size).toBe(12);
  });

  it('광장에서 모든 부지·건물 입구까지 걸어갈 수 있다', () => {
    const start = { x: 12, y: 12 };
    for (const p of [...EMPTY_PLOTS, ...STATIC_BUILDINGS.map((s) => s.plot)]) {
      expect(isWalkable(p.entrance.x, p.entrance.y), p.id).toBe(true);
      expect(findPath(start, p.entrance, isWalkable, MAP_W, MAP_H), p.id).not.toBeNull();
    }
  });

  it('부지끼리·건물과 겹치지 않는다', () => {
    const cells = new Map<string, string>();
    for (const p of EMPTY_PLOTS) {
      for (let x = p.x; x < p.x + p.w; x++)
        for (let y = p.y; y < p.y + p.h; y++) {
          const k = `${x},${y}`;
          expect(cells.get(k), `${p.id} ↔ ${cells.get(k)}`).toBeUndefined();
          cells.set(k, p.id);
        }
    }
  });

  it('꾸밈 요소는 섬 안에 있고, 길·부지·입구를 막지 않으며 물 위 요소만 물에 있다', () => {
    const entrances = new Set([...EMPTY_PLOTS, ...STATIC_BUILDINGS.map((s) => s.plot)].map((p) => `${p.entrance.x},${p.entrance.y}`));
    for (const p of PROPS) {
      for (let x = p.x; x < p.x + (p.w ?? 1); x++)
        for (let y = p.y; y < p.y + (p.h ?? 1); y++) {
          const g = groundAt(x, y);
          const tag = `${p.kind}@${x},${y}`;
          expect(g, tag).not.toBe('void');
          if (WATER_DECOR.includes(p.kind)) expect(g, tag).toBe('water');
          else if (p.kind !== 'planter' && p.kind !== 'lamp' && p.kind !== 'bench') expect(g, tag).toBe('grass');
          expect(entrances.has(`${x},${y}`), tag).toBe(false);
        }
    }
    expect(FLAT_DECOR).toContain('lily');
  });

  it('호수와 바깥은 걸을 수 없다', () => {
    expect(groundAt(22, 20)).toBe('water');
    expect(isWalkable(22, 20)).toBe(false);
    expect(isWalkable(MAP_W, 3)).toBe(false);
    expect(groundAt(-1, 0)).toBe('void');
  });
});

describe('건물 옮기기 배치(v1.7)', () => {
  it('공용 건물을 옮기면 원래 자리가 빈 부지가 되고 새 자리는 막힌다', () => {
    setOccupiedPlots([]);
    expect(isPlotFree('lot-cafe')).toBe(false);
    setLayout({ ...DEFAULT_LAYOUT, cafe: 'plot-e1a' });
    expect(placeAt('plot-e1a')).toBe('cafe');
    expect(isPlotFree('lot-cafe')).toBe(true);
    expect(isPlotFree('plot-e1a')).toBe(false);
    expect(STATIC_BUILDINGS.find((s) => s.kind === 'cafe')!.plot.id).toBe('plot-e1a');
    // 옮긴 카페 입구까지 걸어갈 수 있다
    const cafe = STATIC_BUILDINGS.find((s) => s.kind === 'cafe')!.plot;
    expect(findPath({ x: 12, y: 12 }, cafe.entrance, isWalkable, MAP_W, MAP_H)).not.toBeNull();
    setLayout(DEFAULT_LAYOUT);
  });

  it('겹치거나 없는 자리는 처음 자리로 되돌린다', () => {
    setLayout({ cafe: 'plot-a', home: 'plot-a', hall: 'nowhere' });
    expect(placeAt('plot-a')).toBe('cafe');
    expect(STATIC_BUILDINGS.find((s) => s.kind === 'home')!.plot.id).toBe('lot-home');
    expect(STATIC_BUILDINGS.find((s) => s.kind === 'hall')!.plot.id).toBe('lot-hall');
    setLayout(DEFAULT_LAYOUT);
  });

  it('첫 빈 부지는 프로젝트 부지부터, 공용 건물 자리는 건너뛴다', () => {
    const all9 = EMPTY_PLOTS.filter((p) => p.id.startsWith('plot-')).map((p) => p.id);
    expect(firstFreeLot([])).toBe('plot-a');
    expect(firstFreeLot(all9)).toBeNull();
    // 카페가 plot-a로 가면 카페 원래 자리가 빈다
    expect(firstFreeLot(all9, { ...DEFAULT_LAYOUT, cafe: 'plot-a' })).toBe('lot-cafe');
    // 프로젝트 부지가 남아 있으면 그쪽이 먼저
    expect(firstFreeLot(all9.filter((x) => x !== 'plot-b'), { ...DEFAULT_LAYOUT, cafe: 'plot-a' })).toBe('plot-b');
  });
});

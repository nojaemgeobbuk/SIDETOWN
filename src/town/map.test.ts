import { describe, expect, it } from 'vitest';
import { findPath } from './astar';
import { EMPTY_PLOTS, FLAT_DECOR, groundAt, isWalkable, MAP_H, MAP_W, PROPS, STATIC_BUILDINGS } from './map';

const WATER_DECOR = ['lily', 'dock', 'boat'];

describe('넓힌 마을 지도(v1.6)', () => {
  it('처음부터 프로젝트 부지가 9칸이다', () => {
    expect(EMPTY_PLOTS).toHaveLength(9);
    expect(new Set(EMPTY_PLOTS.map((p) => p.id)).size).toBe(9);
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
    for (const p of [...EMPTY_PLOTS, ...STATIC_BUILDINGS.map((s) => s.plot)]) {
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

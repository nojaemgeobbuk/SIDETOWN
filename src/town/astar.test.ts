import { describe, expect, it } from 'vitest';
import { findPath, nearestWalkable } from './astar';
import { EMPTY_PLOTS, isWalkable, MAP_H, MAP_W, PROJECT_PLOTS, STATIC_BUILDINGS } from './map';
import { facingFor, isoToScreen, screenToCell } from './iso';

describe('아이소메트릭 변환', () => {
  it('셀 중심을 다시 같은 셀로', () => {
    for (const [x, y] of [[0, 0], [5, 9], [23, 1]]) {
      const p = isoToScreen(x + 0.5, y + 0.5);
      expect(screenToCell(p.x, p.y)).toEqual({ x, y });
    }
  });
  it('이동 방향 프레임', () => {
    expect(facingFor(1, 0, 'front-left')).toBe('front-right');
    expect(facingFor(0, 1, 'front-right')).toBe('front-left');
    expect(facingFor(-1, 0, 'front-left')).toBe('back-left');
    expect(facingFor(0, -1, 'front-left')).toBe('back-right');
  });
});

describe('맵과 경로', () => {
  it('모든 건물 입구에 걸어서 갈 수 있다', () => {
    const start = { x: 11, y: 13 };
    expect(isWalkable(start.x, start.y)).toBe(true);
    for (const p of [...PROJECT_PLOTS, ...EMPTY_PLOTS, ...STATIC_BUILDINGS.map((s) => s.plot)]) {
      expect(isWalkable(p.entrance.x, p.entrance.y), p.id).toBe(true);
      expect(findPath(start, p.entrance, isWalkable, MAP_W, MAP_H), p.id).not.toBeNull();
    }
  });
  it('막힌 칸을 지나지 않는다', () => {
    const path = findPath({ x: 2, y: 8 }, { x: 8, y: 1 }, isWalkable, MAP_W, MAP_H)!;
    expect(path.every((c) => isWalkable(c.x, c.y))).toBe(true);
  });
  it('건물 칸을 누르면 가장 가까운 유효 칸', () => {
    const n = nearestWalkable({ x: 4, y: 3 }, isWalkable, MAP_W, MAP_H)!;
    expect(isWalkable(n.x, n.y)).toBe(true);
  });
});

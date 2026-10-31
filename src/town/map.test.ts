import { afterAll, describe, expect, it } from 'vitest';
import { findPath } from './astar';
import { DISTRICTS, EMPTY_PLOTS, groundAt, isWalkable, landBounds, nextDistrict, setExpansions, WORLD_H, WORLD_W } from './map';

afterAll(() => setExpansions([]));

describe('땅 넓히기 지도', () => {
  it('열기 전에는 바깥이 빈 땅이고 걸을 수 없다', () => {
    setExpansions([]);
    expect(groundAt(27, 7)).toBe('void');
    expect(isWalkable(27, 7)).toBe(false);
    expect(EMPTY_PLOTS).toHaveLength(5);
    expect(nextDistrict()?.id).toBe('e1');
  });

  it('구역을 열면 부지 2칸이 늘고 큰길에서 입구까지 걸어갈 수 있다', () => {
    setExpansions(['e1', 's1']);
    expect(EMPTY_PLOTS).toHaveLength(9);
    expect(nextDistrict()?.id).toBe('e2');
    expect(landBounds()).toEqual({ w: 32, h: 32 });
    const start = { x: 12, y: 12 }; // 광장
    for (const d of DISTRICTS.slice(0, 2)) {
      for (const p of d.plots) {
        expect(findPath(start, p.entrance, isWalkable, WORLD_W, WORLD_H), p.id).not.toBeNull();
      }
    }
    // 부지 안은 길이 아니다(빈 부지는 걸을 수 있지만 지면은 포장)
    expect(groundAt(27, 7)).toBe('paving');
  });

  it('다 열면 다음 구역이 없다', () => {
    setExpansions(['e1', 's1', 'e2', 's2']);
    expect(nextDistrict()).toBeUndefined();
    expect(EMPTY_PLOTS).toHaveLength(13);
    const far = DISTRICTS[3].plots[1];
    expect(findPath({ x: 12, y: 12 }, far.entrance, isWalkable, WORLD_W, WORLD_H)).not.toBeNull();
  });
});

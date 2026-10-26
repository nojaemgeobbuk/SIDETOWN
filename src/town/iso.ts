/** 아이소메트릭 좌표 변환. 논리 좌표는 정수 그리드(gx, gy), 화면 좌표는 월드 픽셀. */
export const TILE_W = 64;
export const TILE_H = 32;

export interface Pt {
  x: number;
  y: number;
}

/** 그리드 꼭짓점(gx, gy)의 월드 좌표 */
export function isoToScreen(gx: number, gy: number): Pt {
  return { x: (gx - gy) * (TILE_W / 2), y: (gx + gy) * (TILE_H / 2) };
}

/** 셀 중심의 월드 좌표 */
export function cellCenter(cx: number, cy: number): Pt {
  return isoToScreen(cx + 0.5, cy + 0.5);
}

/** 월드 좌표 → 셀 (소수점 버림) */
export function screenToCell(sx: number, sy: number): Pt {
  const a = sx / (TILE_W / 2);
  const b = sy / (TILE_H / 2);
  return { x: Math.floor((a + b) / 2), y: Math.floor((b - a) / 2) };
}

/** 이동 방향 → 캐릭터 프레임. 화면 x ∝ dx−dy, 화면 y ∝ dx+dy */
export type Facing = 'front-left' | 'front-right' | 'back-left' | 'back-right';
export function facingFor(dx: number, dy: number, prev: Facing): Facing {
  if (dx === 0 && dy === 0) return prev;
  const down = dx + dy > 0 || (dx + dy === 0 && prev.startsWith('front'));
  const right = dx - dy > 0 || (dx - dy === 0 && prev.endsWith('right'));
  return `${down ? 'front' : 'back'}-${right ? 'right' : 'left'}` as Facing;
}

export interface Cell {
  x: number;
  y: number;
}

/**
 * 그리드 A*. 8방향 이동, 막힌 칸 모서리 대각선 통과 금지.
 * 목적지가 막혀 있으면 null을 돌려준다(호출부에서 가장 가까운 유효 칸으로 바꿈).
 */
export function findPath(
  start: Cell,
  goal: Cell,
  walkable: (x: number, y: number) => boolean,
  width: number,
  height: number,
): Cell[] | null {
  if (!walkable(goal.x, goal.y)) return null;
  if (start.x === goal.x && start.y === goal.y) return [start];
  const key = (x: number, y: number) => y * width + x;
  const g = new Map<number, number>();
  const f = new Map<number, number>();
  const came = new Map<number, number>();
  const open: number[] = [];
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - goal.x);
    const dy = Math.abs(y - goal.y);
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
  };
  const s = key(start.x, start.y);
  g.set(s, 0);
  f.set(s, h(start.x, start.y));
  open.push(s);
  const closed = new Set<number>();
  const dirs = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
  ];
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if ((f.get(open[i]) ?? Infinity) < (f.get(open[bi]) ?? Infinity)) bi = i;
    const cur = open.splice(bi, 1)[0];
    const cx = cur % width;
    const cy = Math.floor(cur / width);
    if (cx === goal.x && cy === goal.y) {
      const path: Cell[] = [{ x: cx, y: cy }];
      let k = cur;
      while (came.has(k)) {
        k = came.get(k)!;
        path.unshift({ x: k % width, y: Math.floor(k / width) });
      }
      return path;
    }
    closed.add(cur);
    for (const [dx, dy, cost] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || !walkable(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!walkable(cx + dx, cy) || !walkable(cx, cy + dy))) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const ng = (g.get(cur) ?? Infinity) + cost;
      if (ng < (g.get(nk) ?? Infinity)) {
        came.set(nk, cur);
        g.set(nk, ng);
        f.set(nk, ng + h(nx, ny));
        if (!open.includes(nk)) open.push(nk);
      }
    }
  }
  return null;
}

/** 막힌 칸을 눌렀을 때 가장 가까운 걸을 수 있는 칸 */
export function nearestWalkable(
  target: Cell,
  walkable: (x: number, y: number) => boolean,
  width: number,
  height: number,
  maxRadius = 6,
): Cell | null {
  for (let r = 0; r <= maxRadius; r++) {
    let best: Cell | null = null;
    let bestD = Infinity;
    for (let y = target.y - r; y <= target.y + r; y++) {
      for (let x = target.x - r; x <= target.x + r; x++) {
        if (x < 0 || y < 0 || x >= width || y >= height || !walkable(x, y)) continue;
        const d = Math.hypot(x - target.x, y - target.y);
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

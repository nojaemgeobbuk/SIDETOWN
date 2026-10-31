import { Container, Graphics } from 'pixi.js';
import { isoToScreen } from './iso';
import type { DecorKind, Prop } from './map';

/**
 * 코드로 그리는 마을 꾸밈 요소(복셀 상자 조합).
 * 그림 파일 없이 골든아워 색감에 맞춰 그리고, 모닥불·배처럼 움직이는 것은 tick으로 갱신한다.
 * 좌표는 그리드 단위(gx, gy), 높이 z는 화면 픽셀.
 */

export interface DecorNode {
  node: Container;
  tick?: (t: number) => void;
}

const shade = (c: number, k: number) => {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * k));
  const b = Math.min(255, Math.round((c & 255) * k));
  return (r << 16) | (g << 8) | b;
};

const P = (gx: number, gy: number, z: number) => {
  const p = isoToScreen(gx, gy);
  return [p.x, p.y - z];
};

/** 윗면·오른쪽(+x)면·왼쪽(+y)면만 보이는 상자. 빛은 오른쪽(노을)에서 온다 */
function box(g: Graphics, x: number, y: number, z: number, w: number, d: number, h: number, color: number) {
  const t = z + h;
  g.poly([...P(x, y + d, t), ...P(x + w, y + d, t), ...P(x + w, y + d, z), ...P(x, y + d, z)]).fill({ color: shade(color, 0.7) });
  g.poly([...P(x + w, y, t), ...P(x + w, y + d, t), ...P(x + w, y + d, z), ...P(x + w, y, z)]).fill({ color: shade(color, 0.92) });
  g.poly([...P(x, y, t), ...P(x + w, y, t), ...P(x + w, y + d, t), ...P(x, y + d, t)]).fill({ color: shade(color, 1.18) });
}

/** 바닥에 붙은 평평한 마름모 */
function flat(g: Graphics, x: number, y: number, w: number, d: number, color: number, z = 0.5, alpha = 1) {
  g.poly([...P(x, y, z), ...P(x + w, y, z), ...P(x + w, y + d, z), ...P(x, y + d, z)]).fill({ color, alpha });
}

function rnd(x: number, y: number, i: number) {
  const s = Math.sin(x * 91.7 + y * 47.3 + i * 13.1) * 43758.5453;
  return s - Math.floor(s);
}

const WOOD = 0x8b6340;
const WOOD_DARK = 0x6b4a2e;
const STONE = 0x8a8580;
const FLOWER_SETS = [
  [0xe8775a, 0xf4b03e],
  [0xf2e6d0, 0xd77fa1],
  [0xf4b03e, 0xf2e6d0],
  [0x9b7fd1, 0xe8775a],
  [0xd77fa1, 0xf4b03e],
];

export function makeDecor(p: Prop & { kind: DecorKind }): DecorNode {
  const node = new Container();
  const g = new Graphics();
  node.addChild(g);
  const { x, y } = p;
  const v = p.v ?? 0;
  let tick: DecorNode['tick'];

  switch (p.kind) {
    case 'flowers': {
      box(g, x + 0.08, y + 0.08, 0, 0.84, 0.84, 3, 0x4a3322);
      const set = FLOWER_SETS[v % FLOWER_SETS.length];
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
          const fx = x + 0.17 + i * 0.25 + (rnd(x, y, i * 3 + j) - 0.5) * 0.08;
          const fy = y + 0.17 + j * 0.25 + (rnd(y, x, i * 3 + j) - 0.5) * 0.08;
          const hgt = 5 + rnd(x, y, i + j * 7) * 4;
          box(g, fx + 0.04, fy + 0.04, 3, 0.05, 0.05, hgt, 0x3f6b2e);
          box(g, fx, fy, 3 + hgt, 0.13, 0.13, 3.5, set[(i + j) % 2]);
        }
      break;
    }
    case 'rock': {
      if (v === 1) {
        box(g, x + 0.15, y + 0.3, 0, 0.4, 0.35, 7, 0x75716b);
        box(g, x + 0.5, y + 0.15, 0, 0.35, 0.4, 11, 0x837e77);
        box(g, x + 0.55, y + 0.6, 0, 0.25, 0.25, 5, 0x6d6a66);
      } else {
        box(g, x + 0.2, y + 0.2, 0, 0.55, 0.5, 12, 0x7b7772);
        box(g, x + 0.3, y + 0.28, 12, 0.3, 0.28, 4, 0x8c8780);
        box(g, x + 0.62, y + 0.62, 0, 0.26, 0.26, 6, 0x6d6a66);
      }
      // 이끼
      flat(g, x + 0.22, y + 0.22, 0.2, 0.2, 0x4f6b35, 12.2, 0.8);
      break;
    }
    case 'fence': {
      const alongX = (p.w ?? 1) >= (p.h ?? 1);
      const len = alongX ? p.w ?? 1 : p.h ?? 1;
      const n = Math.round(len * 2);
      const yy = y + 0.45;
      const xx = x + 0.45;
      for (let i = 0; i <= n; i++) {
        const t = i * 0.5;
        if (alongX) box(g, x + t - 0.05, yy, 0, 0.1, 0.1, 17, WOOD_DARK);
        else box(g, xx, y + t - 0.05, 0, 0.1, 0.1, 17, WOOD_DARK);
        if (i < n) {
          for (const z of [6, 12]) {
            if (alongX) box(g, x + t + 0.05, yy + 0.02, z, 0.4, 0.06, 3, WOOD);
            else box(g, xx + 0.02, y + t + 0.05, z, 0.06, 0.4, 3, WOOD);
          }
        }
      }
      break;
    }
    case 'crates': {
      box(g, x + 0.12, y + 0.12, 0, 0.42, 0.42, 16, 0x9a6b3c);
      box(g, x + 0.15, y + 0.15, 16, 0.36, 0.36, 13, 0xa77a48);
      box(g, x + 0.58, y + 0.45, 0, 0.3, 0.3, 11, 0x8a5e35);
      // 통(barrel)
      box(g, x + 0.55, y + 0.1, 0, 0.3, 0.3, 18, 0x7a5232);
      box(g, x + 0.54, y + 0.09, 4, 0.32, 0.32, 2, 0x4a4440);
      box(g, x + 0.54, y + 0.09, 13, 0.32, 0.32, 2, 0x4a4440);
      break;
    }
    case 'haybale': {
      box(g, x + 0.12, y + 0.2, 0, 0.7, 0.5, 13, 0xd9b25a);
      box(g, x + 0.43, y + 0.19, 0, 0.05, 0.52, 13.5, 0xa9853a);
      if (v !== 1) {
        box(g, x + 0.22, y + 0.28, 13, 0.5, 0.36, 10, 0xe2bd66);
        box(g, x + 0.45, y + 0.27, 13, 0.04, 0.38, 10.5, 0xa9853a);
      }
      break;
    }
    case 'well': {
      box(g, x + 0.15, y + 0.15, 0, 0.7, 0.7, 13, STONE);
      flat(g, x + 0.27, y + 0.27, 0.46, 0.46, 0x163446, 13.3);
      box(g, x + 0.18, y + 0.46, 13, 0.08, 0.08, 22, WOOD_DARK);
      box(g, x + 0.74, y + 0.46, 13, 0.08, 0.08, 22, WOOD_DARK);
      box(g, x + 0.18, y + 0.47, 32, 0.64, 0.06, 2, WOOD);
      box(g, x + 0.08, y + 0.3, 35, 0.84, 0.4, 5, 0xb5523b);
      box(g, x + 0.45, y + 0.45, 18, 0.12, 0.12, 6, 0x7a5232);
      break;
    }
    case 'campfire': {
      const glow = new Graphics();
      const c = isoToScreen(x + 0.5, y + 0.5);
      glow.blendMode = 'add';
      node.addChildAt(glow, 0);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        box(g, x + 0.45 + Math.cos(a) * 0.3, y + 0.45 + Math.sin(a) * 0.3, 0, 0.12, 0.12, 4, i % 2 ? 0x77726c : 0x8a8580);
      }
      box(g, x + 0.3, y + 0.46, 2, 0.4, 0.08, 4, WOOD_DARK);
      box(g, x + 0.46, y + 0.3, 2, 0.08, 0.4, 4, 0x5b3f28);
      // 통나무 의자
      box(g, x - 0.05, y + 0.85, 0, 0.5, 0.18, 6, 0x7a5232);
      const fire = new Graphics();
      node.addChild(fire);
      const draw = (t: number) => {
        fire.clear();
        glow.clear();
        const f = 1 + Math.sin(t / 90) * 0.12 + Math.sin(t / 37) * 0.06;
        for (let r = 4; r >= 1; r--) glow.ellipse(c.x, c.y, r * 20 * f, r * 10 * f).fill({ color: 0xf4b03e, alpha: 0.045 });
        const base = c.y - 4;
        const flame = (dx: number, h: number, w: number, col: number) =>
          fire.poly([c.x + dx - w, base, c.x + dx + w, base, c.x + dx + Math.sin(t / 120 + dx) * 2, base - h]).fill({ color: col });
        flame(-4, 14 * f, 5, 0xe8775a);
        flame(4, 12 * (2 - f), 5, 0xe8775a);
        flame(0, 18 * f, 5, 0xf4b03e);
        flame(0, 9 * f, 3, 0xfff1c8);
      };
      draw(0);
      tick = draw;
      break;
    }
    case 'signpost': {
      box(g, x + 0.45, y + 0.45, 0, 0.1, 0.1, 30, WOOD_DARK);
      box(g, x + 0.18, y + 0.47, 20, 0.62, 0.06, 7, 0xa3784a);
      box(g, x + 0.47, y + 0.14, 11, 0.06, 0.6, 6, 0x9a6e42);
      flat(g, x + 0.3, y + 0.53, 0.3, 0.02, 0xf4b03e, 23.5);
      break;
    }
    case 'mailbox': {
      box(g, x + 0.46, y + 0.46, 0, 0.08, 0.08, 15, 0x5b3f28);
      box(g, x + 0.3, y + 0.38, 15, 0.42, 0.24, 9, 0xc0473a);
      box(g, x + 0.72, y + 0.4, 18, 0.03, 0.06, 9, 0xf4b03e);
      break;
    }
    case 'boat': {
      const b = new Graphics();
      box(b, x + 0.05, y + 0.3, -2, 0.9, 0.4, 6, 0x7a4f2c);
      box(b, x + 0.12, y + 0.36, 3.5, 0.76, 0.28, 0.6, 0x4e321c);
      box(b, x + 0.45, y + 0.34, 3, 0.1, 0.32, 3, WOOD);
      box(b, x + 0.6, y + 0.45, 4, 0.5, 0.04, 1.5, 0xa3784a); // 노
      node.addChild(b);
      tick = (t) => {
        b.y = Math.sin(t / 900) * 1.6;
        b.x = Math.sin(t / 2300) * 2;
      };
      break;
    }
    case 'dock': {
      const w = p.w ?? 2;
      box(g, x - 0.02, y + 0.12, -8, 0.08, 0.08, 10, WOOD_DARK);
      box(g, x - 0.02, y + 0.8, -8, 0.08, 0.08, 10, WOOD_DARK);
      for (let i = 0; i < w * 3; i++) box(g, x + i * 0.333, y + 0.12, 0, 0.31, 0.76, 3, i % 2 ? WOOD : 0x957048);
      break;
    }
    case 'lily': {
      const pads = v === 1 ? [[0.3, 0.4], [0.62, 0.65]] : [[0.25, 0.3], [0.6, 0.35], [0.42, 0.7]];
      for (const [px, py] of pads) {
        const c = isoToScreen(x + px, y + py);
        g.ellipse(c.x, c.y, 8, 4).fill({ color: 0x3f6b2e });
        g.moveTo(c.x, c.y).lineTo(c.x + 6, c.y - 2).stroke({ width: 1, color: 0x163446 });
      }
      const c = isoToScreen(x + pads[0][0], y + pads[0][1]);
      g.circle(c.x - 1, c.y - 2, 2.2).fill({ color: 0xd77fa1 });
      break;
    }
    case 'stall': {
      const w = p.w ?? 2;
      box(g, x + 0.1, y + 0.3, 0, w - 0.2, 0.5, 14, WOOD);
      box(g, x + 0.1, y + 0.3, 14, w - 0.2, 0.5, 1.5, 0xa3784a);
      // 과일·채소·호박
      const goods = [0xe0782c, 0xc0473a, 0xf4b03e, 0x6d9a3a];
      for (let i = 0; i < 6; i++) box(g, x + 0.2 + i * ((w - 0.45) / 6), y + 0.42 + (i % 2) * 0.16, 15.5, 0.14, 0.14, 5, goods[i % goods.length]);
      for (const [px, py] of [[0.12, 0.2], [w - 0.2, 0.2], [0.12, 0.78], [w - 0.2, 0.78]]) box(g, x + px, y + py, 0, 0.07, 0.07, 32, WOOD_DARK);
      const stripes = Math.round(w * 3);
      for (let i = 0; i < stripes; i++) box(g, x + 0.05 + i * ((w - 0.1) / stripes), y + 0.1, 32, (w - 0.1) / stripes, 0.82, 4, i % 2 ? 0xf2e6d0 : 0xe8775a);
      break;
    }
    case 'picnic': {
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) flat(g, x + 0.1 + i * 0.2, y + 0.1 + j * 0.2, 0.2, 0.2, (i + j) % 2 ? 0xf2e6d0 : 0xc0473a, 0.6);
      box(g, x + 0.55, y + 0.2, 0.6, 0.24, 0.18, 7, 0xb08850);
      box(g, x + 0.25, y + 0.55, 0.6, 0.1, 0.1, 6, 0x5a7a9a); // 컵
      break;
    }
    case 'pumpkins': {
      const set = v === 1 ? [[0.2, 0.25, 0.32, 10], [0.58, 0.5, 0.24, 8]] : [[0.15, 0.2, 0.3, 10], [0.55, 0.25, 0.22, 7], [0.35, 0.58, 0.26, 9]];
      for (const [px, py, s, h] of set) {
        box(g, x + px, y + py, 0, s, s, h, 0xe0782c);
        box(g, x + px + s / 2 - 0.03, y + py + s / 2 - 0.03, h, 0.06, 0.06, 4, 0x4f6b35);
      }
      // 첫 호박은 할로윈 등불: 얼굴에서 빛이 샌다
      const [px, py, s, h] = set[0];
      const face = isoToScreen(x + px + s, y + py + s * 0.5);
      g.rect(face.x - 3, face.y - h + 2, 2, 2).fill({ color: 0xfff1c8 });
      g.rect(face.x + 1, face.y - h + 3, 2, 2).fill({ color: 0xfff1c8 });
      g.rect(face.x - 2, face.y - h + 6, 5, 1.5).fill({ color: 0xfff1c8 });
      const glow = new Graphics();
      glow.blendMode = 'add';
      for (let r = 3; r >= 1; r--) glow.ellipse(face.x, face.y - 4, r * 9, r * 5).fill({ color: 0xf4b03e, alpha: 0.05 });
      node.addChildAt(glow, 0);
      break;
    }
  }
  return { node, tick };
}

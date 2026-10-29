/**
 * 캐릭터 외형 바꾸기. 캐릭터 그림은 한 벌(4방향)뿐이라, 픽셀을 부위(머리·겉옷·바지·신발)로 나눠
 * 색상·채도를 바꾸고 원래 명암을 살린다. 브라우저(캔버스)와 테스트가 같은 함수를 쓴다.
 */
import type { Avatar } from './types';

export type Part = 'hair' | 'top' | 'bottom' | 'shoes';

/** h(0~360)·s(0~1)·mul/add: 새 밝기 = 원래 밝기 × mul + add */
export interface Tone {
  label: string;
  swatch: string;
  h: number;
  s: number;
  mul: number;
  add: number;
}

/** null = 원래 색 */
export const PALETTE: Record<Part, Record<string, Tone | null>> = {
  hair: {
    brown: null,
    black: { label: '검정', swatch: '#1d1b1f', h: 0, s: 0, mul: 0.5, add: 0 },
    blond: { label: '금발', swatch: '#e6c65a', h: 45, s: 0.75, mul: 0.9, add: 0.3 },
    red: { label: '빨강', swatch: '#c2412f', h: 5, s: 0.65, mul: 1.1, add: 0.05 },
    pink: { label: '분홍', swatch: '#e58fb7', h: 330, s: 0.6, mul: 1, add: 0.2 },
    silver: { label: '은발', swatch: '#cfd2d8', h: 0, s: 0, mul: 0.6, add: 0.45 },
    blue: { label: '파랑', swatch: '#3c5fa8', h: 220, s: 0.5, mul: 1, add: 0.08 },
  },
  top: {
    teal: null,
    burgundy: { label: '버건디', swatch: '#7e1f33', h: 350, s: 0.55, mul: 1.05, add: 0 },
    mustard: { label: '머스터드', swatch: '#b8942a', h: 42, s: 0.7, mul: 1.1, add: 0.08 },
    green: { label: '숲', swatch: '#3d6b2b', h: 95, s: 0.35, mul: 1.1, add: 0 },
    navy: { label: '남색', swatch: '#24357a', h: 225, s: 0.45, mul: 1, add: 0 },
    purple: { label: '보라', swatch: '#5b3a85', h: 275, s: 0.35, mul: 1.05, add: 0.03 },
    charcoal: { label: '먹색', swatch: '#33363c', h: 0, s: 0, mul: 0.9, add: 0.02 },
    cream: { label: '크림', swatch: '#d9cfb2', h: 40, s: 0.35, mul: 0.8, add: 0.35 },
  },
  bottom: {
    brown: null,
    denim: { label: '청바지', swatch: '#3f6aa8', h: 215, s: 0.45, mul: 1.3, add: 0.05 },
    black: { label: '검정', swatch: '#1c1c20', h: 0, s: 0, mul: 0.8, add: 0 },
    beige: { label: '베이지', swatch: '#b9a98c', h: 30, s: 0.25, mul: 1.2, add: 0.25 },
    gray: { label: '회색', swatch: '#7c7f86', h: 0, s: 0, mul: 1.4, add: 0.12 },
  },
  shoes: {
    brown: null,
    black: { label: '검정', swatch: '#151518', h: 0, s: 0, mul: 0.5, add: 0 },
    white: { label: '흰색', swatch: '#e9e9ea', h: 0, s: 0, mul: 0.6, add: 0.55 },
    red: { label: '빨강', swatch: '#b23a2e', h: 0, s: 0.6, mul: 1, add: 0.05 },
  },
};

export const ORIGINAL_LABEL: Record<Part, { label: string; swatch: string }> = {
  hair: { label: '갈색', swatch: '#7a4a2a' },
  top: { label: '청록', swatch: '#1f4f5e' },
  bottom: { label: '짙은 갈색', swatch: '#3a2c2b' },
  shoes: { label: '갈색', swatch: '#7c4a2c' },
};

export const PARTS: { key: Part; label: string; field: keyof Avatar }[] = [
  { key: 'hair', label: '머리', field: 'hair' },
  { key: 'top', label: '겉옷', field: 'top' },
  { key: 'bottom', label: '바지', field: 'bottom' },
  { key: 'shoes', label: '신발', field: 'skin' }, // DB 키 'skin' 자리를 신발에 쓴다(피부는 손·셔츠와 색이 같아 바꾸지 않음)
];

export const PRESETS: { name: string; avatar: Avatar }[] = [
  { name: '기본', avatar: {} },
  { name: '밤 작업자', avatar: { hair: 'black', top: 'charcoal', bottom: 'black', skin: 'white' } },
  { name: '가을 산책', avatar: { hair: 'red', top: 'mustard', bottom: 'beige', skin: 'brown' } },
  { name: '도서관', avatar: { hair: 'brown', top: 'burgundy', bottom: 'denim', skin: 'black' } },
  { name: '새벽 바다', avatar: { hair: 'silver', top: 'navy', bottom: 'gray', skin: 'white' } },
];

export function avatarKey(a?: Avatar): string {
  return `${a?.hair ?? '-'}.${a?.top ?? '-'}.${a?.bottom ?? '-'}.${a?.skin ?? '-'}`;
}

export function isDefault(a?: Avatar) {
  return avatarKey(a) === avatarKey({}) || PARTS.every((p) => !a?.[p.field] || PALETTE[p.key][a[p.field]!] == null);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    t = ((t % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const hh = h / 360;
  return [Math.round(f(hh + 1 / 3) * 255), Math.round(f(hh) * 255), Math.round(f(hh - 1 / 3) * 255)];
}

/** 픽셀 하나가 어느 부위인가. yr·xr: 그림 안 세로·가로 위치(0~1) */
export function classify(r: number, g: number, b: number, yr: number, xr: number): Part | 'skin' | null {
  const [h, s, l] = rgbToHsl(r, g, b);
  if (l < 0.05) return null;
  if (h >= 10 && h <= 50 && s > 0.3 && l > 0.6 && yr > 0.12) return 'skin';
  // 눈(무채색에 아주 어두움)은 머리색에 물들지 않게
  if (yr < 0.37 && !(s < 0.15 && l < 0.12) && (h <= 50 || h >= 260)) return 'hair';
  if (h >= 100 && h <= 250 && s > 0.05 && yr > 0.3 && yr < 0.86) return 'top';
  if (yr > 0.84 && (h <= 50 || h >= 330) && s > 0.1 && l > 0.1) return 'shoes';
  if (yr > 0.7 && yr < 0.92 && xr > 0.18 && xr < 0.85 && l < 0.38 && s < 0.35) return 'bottom';
  return null;
}

/** RGBA 픽셀 배열을 제자리에서 바꾼다 */
export function recolorPixels(data: Uint8ClampedArray, width: number, height: number, a: Avatar | undefined): void {
  const tones: Partial<Record<Part, Tone>> = {};
  for (const p of PARTS) {
    const key = a?.[p.field];
    const t = key ? PALETTE[p.key][key] : null;
    if (t) tones[p.key] = t;
  }
  if (!Object.keys(tones).length) return;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 10) continue;
      const part = classify(data[i], data[i + 1], data[i + 2], y / height, x / width);
      if (!part || part === 'skin') continue;
      const t = tones[part];
      if (!t) continue;
      const l = rgbToHsl(data[i], data[i + 1], data[i + 2])[2];
      const [nr, ng, nb] = hslToRgb(t.h, t.s, Math.max(0, Math.min(0.96, l * t.mul + t.add)));
      data[i] = nr;
      data[i + 1] = ng;
      data[i + 2] = nb;
    }
  }
}

'use client';

import { avatarKey, isDefault, recolorPixels } from './avatar';
import type { Avatar } from './types';

export type Facing = 'front-left' | 'front-right' | 'back-left' | 'back-right';

const images = new Map<string, Promise<HTMLImageElement>>();
const canvases = new Map<string, Promise<HTMLCanvasElement>>();

function loadImage(src: string) {
  let p = images.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    images.set(src, p);
  }
  return p;
}

export const characterSrc = (f: Facing) => `/assets/character/${f}.png`;

/** 외형을 입힌 캐릭터 캔버스(외형·방향별로 한 번만 만든다) */
export function avatarCanvas(a: Avatar | undefined, f: Facing): Promise<HTMLCanvasElement> {
  const k = `${avatarKey(a)}:${f}`;
  let p = canvases.get(k);
  if (!p) {
    p = loadImage(characterSrc(f)).then((img) => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      if (!isDefault(a)) {
        const d = ctx.getImageData(0, 0, c.width, c.height);
        recolorPixels(d.data, c.width, c.height, a);
        ctx.putImageData(d, 0, 0);
      }
      return c;
    });
    canvases.set(k, p);
  }
  return p;
}

const urls = new Map<string, string>();
export async function avatarUrl(a: Avatar | undefined, f: Facing): Promise<string> {
  if (isDefault(a)) return characterSrc(f);
  const k = `${avatarKey(a)}:${f}`;
  const hit = urls.get(k);
  if (hit) return hit;
  const c = await avatarCanvas(a, f);
  const u = c.toDataURL('image/png');
  urls.set(k, u);
  return u;
}

import { describe, expect, it } from 'vitest';
import { avatarKey, classify, isDefault, recolorPixels } from './avatar';

describe('캐릭터 외형', () => {
  it('부위 판별: 위쪽 갈색=머리, 청록=겉옷, 아래 갈색=신발, 얼굴색은 그대로', () => {
    expect(classify(96, 48, 32, 0.1, 0.5)).toBe('hair');
    expect(classify(16, 48, 64, 0.5, 0.5)).toBe('top');
    expect(classify(128, 80, 64, 0.9, 0.5)).toBe('shoes');
    expect(classify(240, 192, 128, 0.25, 0.5)).toBe('skin');
    expect(classify(16, 16, 16, 0.25, 0.5)).toBeNull(); // 눈
  });
  it('기본값이면 픽셀을 건드리지 않고, 고르면 바꾼다', () => {
    const px = new Uint8ClampedArray([16, 48, 64, 255]);
    recolorPixels(px, 1, 1, {});
    expect([...px]).toEqual([16, 48, 64, 255]);
    // 1×1 그림의 y=0은 머리 자리 → 겉옷 색 대신 머리 색을 시험
    const hair = new Uint8ClampedArray([96, 48, 32, 255]);
    recolorPixels(hair, 1, 1, { hair: 'black' });
    expect(hair[0]).toBe(hair[1]);
    expect(hair[3]).toBe(255);
  });
  it('알 수 없는 값은 기본으로 본다', () => {
    expect(isDefault({ hair: 'brown', top: 'teal' })).toBe(true);
    expect(isDefault({ hair: 'black' })).toBe(false);
    expect(avatarKey({ hair: 'black' })).not.toBe(avatarKey({}));
  });
});

import { describe, expect, it } from 'vitest';
import { adsenseClient } from './adsense';

describe('AdSense 게시자 ID', () => {
  it('여러 형태를 ca-pub-로 맞춘다', () => {
    for (const v of ['ca-pub-1234567890123456', 'pub-1234567890123456', '1234567890123456', ' "ca-pub-1234567890123456" ']) {
      expect(adsenseClient(v)).toBe('ca-pub-1234567890123456');
    }
  });
  it('잘못된 값·빈 값은 끈다', () => {
    expect(adsenseClient('')).toBeNull();
    expect(adsenseClient(undefined)).toBeNull();
    expect(adsenseClient('ca-pub-abc')).toBeNull();
  });
});

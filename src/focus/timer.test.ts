import { describe, expect, it } from 'vitest';
import { advance, format, initial, LENGTHS, pause, remaining, setMode, start } from './timer';

describe('뽀모도로 타이머 (AC-26)', () => {
  it('끝나는 시각 기준이라 오래 멈춘 탭에서도 정확', () => {
    const t0 = 1_000_000;
    const s = start(initial(), t0);
    // 탭이 30분 동안 틱을 못 받아도 남은 시간은 0
    expect(remaining(s, t0 + 30 * 60_000)).toBe(0);
    expect(remaining(s, t0 + 10 * 60_000)).toBe(LENGTHS.focus - 10 * 60_000);
  });
  it('일시정지 후 재개하면 남은 시간이 이어진다', () => {
    const t0 = 0;
    let s = start(initial(), t0);
    s = pause(s, t0 + 60_000);
    expect(remaining(s, t0 + 10 * 60_000)).toBe(LENGTHS.focus - 60_000);
    s = start(s, t0 + 10 * 60_000);
    expect(remaining(s, t0 + 11 * 60_000)).toBe(LENGTHS.focus - 2 * 60_000);
  });
  it('집중 4회마다 긴 휴식', () => {
    let s = initial();
    const modes: string[] = [];
    for (let i = 0; i < 8; i++) {
      s = advance(s, 0).state;
      modes.push(s.mode);
    }
    expect(modes).toEqual(['short', 'focus', 'short', 'focus', 'short', 'focus', 'long', 'focus']);
    expect(s.done).toBe(4);
  });
  it('모드 바꾸기·표시', () => {
    expect(setMode(initial(), 'short').remaining).toBe(LENGTHS.short);
    expect(format(LENGTHS.focus)).toBe('25:00');
    expect(format(61_001)).toBe('01:02');
  });
});

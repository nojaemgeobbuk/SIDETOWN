/**
 * 뽀모도로 타이머 — 기획서 6.6.
 * 남은 시간을 매 틱 깎지 않고 ‘끝나는 시각’으로 계산해 백그라운드 탭에서도 오차가 쌓이지 않게 한다(AC-26).
 */
export type Mode = 'focus' | 'short' | 'long';

export const LENGTHS: Record<Mode, number> = { focus: 25 * 60_000, short: 5 * 60_000, long: 15 * 60_000 };

export interface TimerState {
  mode: Mode;
  /** 실행 중이면 끝나는 시각(ms), 멈춤이면 null */
  endsAt: number | null;
  /** 멈춤 상태에서 남은 시간 */
  remaining: number;
  /** 오늘 끝낸 집중 구간 수 */
  done: number;
}

export function initial(done = 0): TimerState {
  return { mode: 'focus', endsAt: null, remaining: LENGTHS.focus, done };
}

export function remaining(s: TimerState, now: number): number {
  return s.endsAt === null ? s.remaining : Math.max(0, s.endsAt - now);
}

export function start(s: TimerState, now: number): TimerState {
  return s.endsAt !== null ? s : { ...s, endsAt: now + s.remaining };
}

export function pause(s: TimerState, now: number): TimerState {
  return s.endsAt === null ? s : { ...s, endsAt: null, remaining: Math.max(0, s.endsAt - now) };
}

export function setMode(s: TimerState, mode: Mode): TimerState {
  return { ...s, mode, endsAt: null, remaining: LENGTHS[mode] };
}

/** 구간이 끝났을 때(또는 건너뛰기) 다음 구간. 집중 4회마다 긴 휴식 */
export function advance(s: TimerState, now: number, autoStart = true): { state: TimerState; finished: Mode } {
  const finished = s.mode;
  let next: TimerState;
  if (s.mode === 'focus') {
    const done = s.done + 1;
    const mode: Mode = done % 4 === 0 ? 'long' : 'short';
    next = { mode, endsAt: null, remaining: LENGTHS[mode], done };
  } else {
    next = { ...s, mode: 'focus', endsAt: null, remaining: LENGTHS.focus };
  }
  return { state: autoStart ? start(next, now) : next, finished };
}

export function format(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

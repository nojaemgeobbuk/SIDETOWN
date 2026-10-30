'use client';

/**
 * 집중 모드 상태(기획서 6.6 v1.4). 타이머·소리는 화면과 떨어져 앱 전체에 하나만 있다.
 * 그래서 집중 화면을 닫거나 계획 화면으로 가도 타이머·BGM이 계속되고, 다시 열면 그대로 이어진다.
 * 타이머는 ‘끝나는 시각’으로 저장해 새로고침·백그라운드 탭에서도 어긋나지 않는다.
 */
import { create } from 'zustand';
import { AudioEngine, TRACKS, type Layer, type Volumes } from './audioEngine';
import { advance, initial, LENGTHS, pause, remaining, setMode as setTimerMode, start, type Mode, type TimerState } from './timer';
import { WEATHERS, type SceneId } from './scenes';

const KEY = 'sidetown-focus-v1';

interface Saved {
  timer: TimerState;
  day: string;
  vol: Volumes;
  bgmOn: boolean;
  track: number;
  weather: SceneId;
  projectId?: string;
  questId?: string;
}

interface FocusState extends Saved {
  /** 집중 화면(마을 전체 화면)이 열려 있는가 */
  open: boolean;
  hydrated: boolean;
  audioOn: boolean;
  uiHidden: boolean;
  /** 집중 구간이 끝났을 때 ‘퀘스트 끝났나요?’ */
  askDone: { projectId: string; questId: string } | null;
  /** 방금 끝난 구간(연출·알림용) */
  lastFinished: { mode: Mode; at: number } | null;

  hydrate: () => void;
  enter: (target?: { projectId?: string; questId?: string }) => void;
  exit: () => void;
  setTarget: (projectId?: string, questId?: string) => void;
  toggleRun: () => void;
  skip: () => void;
  setMode: (m: Mode) => void;
  tick: (now?: number) => void;
  enableAudio: () => boolean;
  toggleBgm: () => void;
  nextTrack: () => void;
  setVol: (k: Layer, v: number) => void;
  setWeather: (w: SceneId) => void;
  setUiHidden: (v: boolean) => void;
  dismissAsk: () => void;
}

let engine: AudioEngine | null = null;
const getEngine = () => (engine ??= new AudioEngine());

const today = () => new Date().toLocaleDateString('en-CA');

function save(s: FocusState) {
  try {
    const out: Saved = { timer: s.timer, day: s.day, vol: s.vol, bgmOn: s.bgmOn, track: s.track, weather: s.weather, projectId: s.projectId, questId: s.questId };
    localStorage.setItem(KEY, JSON.stringify(out));
  } catch {
    /* 저장소를 쓸 수 없으면 메모리에서만 */
  }
}

export const useFocus = create<FocusState>((set, get) => {
  const persist = () => save(get());
  return {
    timer: initial(0),
    day: '',
    vol: { bgm: 55, rain: 0, fire: 0, cafe: 25, wave: 30 },
    bgmOn: true,
    track: 0,
    weather: 'evening',
    open: false,
    hydrated: false,
    audioOn: false,
    uiHidden: false,
    askDone: null,
    lastFinished: null,

    hydrate: () => {
      if (get().hydrated) return;
      let saved: Partial<Saved> = {};
      try {
        saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      } catch {
        saved = {};
      }
      const t = today();
      // 날이 바뀌면 ‘오늘 n회’를 0으로
      const timer = saved.timer && saved.day === t ? saved.timer : saved.timer ? { ...saved.timer, done: 0 } : initial(0);
      set({ ...saved, timer, day: t, hydrated: true } as Partial<FocusState>);
      // 저장된 동안 구간이 끝났으면 다음 구간으로(새로고침 뒤 0초에 멈춰 있지 않게)
      get().tick();
    },

    enter: (target) => {
      if (target?.projectId) set({ projectId: target.projectId, questId: target.questId });
      set({ open: true, uiHidden: false });
      persist();
    },
    exit: () => set({ open: false }),
    setTarget: (projectId, questId) => {
      set({ projectId, questId });
      persist();
    },

    toggleRun: () => {
      const { timer } = get();
      const now = Date.now();
      if (timer.endsAt === null) get().enableAudio();
      set({ timer: timer.endsAt === null ? start(timer, now) : pause(timer, now) });
      persist();
    },
    skip: () => {
      set({ timer: advance(get().timer, Date.now(), false).state });
      persist();
    },
    setMode: (m) => {
      set({ timer: setTimerMode(get().timer, m) });
      persist();
    },

    tick: (now = Date.now()) => {
      const { timer, projectId, questId } = get();
      if (timer.endsAt === null || remaining(timer, now) > 0) return;
      const { state, finished } = advance(timer, now);
      set({
        timer: state,
        lastFinished: { mode: finished, at: now },
        askDone: finished === 'focus' && projectId && questId ? { projectId, questId } : get().askDone,
      });
      if (get().audioOn) getEngine().chime();
      persist();
    },

    enableAudio: () => {
      const e = getEngine();
      const ok = e.ensure();
      if (ok) {
        const { vol, bgmOn, track } = get();
        e.vol = vol;
        e.bgmOn = bgmOn;
        while (e.track !== track) e.nextTrack();
        e.apply();
        set({ audioOn: true });
      }
      return ok;
    },
    toggleBgm: () => {
      if (!get().audioOn) {
        get().enableAudio();
        return;
      }
      const on = !get().bgmOn;
      getEngine().setBgm(on);
      set({ bgmOn: on });
      persist();
    },
    nextTrack: () => {
      getEngine().nextTrack();
      set({ track: (get().track + 1) % TRACKS.length });
      persist();
    },
    setVol: (k, v) => {
      set({ vol: { ...get().vol, [k]: v } });
      getEngine().setVolume(k, v);
      persist();
    },
    setWeather: (w) => {
      // 날씨에 맞춰 환경음도 바꾼다(BGM은 그대로)
      const amb = WEATHERS.find((x) => x.id === w)?.ambience ?? {};
      const vol = { ...get().vol, rain: 0, fire: 0, ...amb };
      set({ weather: w, vol });
      if (get().audioOn) {
        const e = getEngine();
        e.vol = vol;
        e.apply();
      }
      persist();
    },
    setUiHidden: (v) => set({ uiHidden: v }),
    dismissAsk: () => set({ askDone: null }),
  };
});

/** 친구에게 보이는 상태: 집중 구간이 돌아가는 동안만 ‘집중 중’ */
export function focusPresence(s: Pick<FocusState, 'timer' | 'projectId'>, plotOf: (projectId?: string) => string | undefined) {
  const running = s.timer.mode === 'focus' && s.timer.endsAt !== null;
  return running
    ? { status: 'focus' as const, plotId: plotOf(s.projectId), since: s.timer.endsAt! - LENGTHS.focus }
    : { status: 'online' as const };
}

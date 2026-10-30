'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { TRACKS, type Layer } from '@/focus/audioEngine';
import { format, LENGTHS, remaining, type Mode } from '@/focus/timer';
import { WEATHERS, windLabel } from '@/focus/scenes';
import { useFocus } from '@/focus/useFocus';
import { editable } from '@/lib/edit';
import { useApp } from '@/store/useApp';
import AmbientLayer from './AmbientLayer';
import { IconExpand, IconPause, IconPlay, IconSkip } from './icons';

const LAYERS: [Layer, string][] = [['bgm', 'BGM'], ['rain', '빗소리'], ['fire', '모닥불'], ['cafe', '카페 소음'], ['wave', '물결']];
const MODES: [Mode, string][] = [['focus', '집중 25'], ['short', '짧은 휴식 5'], ['long', '긴 휴식 15']];

/** 집중 모드에 들어간다: 마을 화면을 전체 화면으로(브라우저 전체 화면은 누른 순간에만 요청할 수 있다) */
export function enterFocus(target?: { projectId?: string; questId?: string }) {
  useFocus.getState().enter(target);
  useApp.getState().select(null);
  useApp.getState().openView(null);
  useApp.getState().setListMode(false);
  try {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
  } catch {
    /* 전체 화면을 지원하지 않으면 창 안에서만 */
  }
}

export function exitFocus() {
  useFocus.getState().exit();
  try {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  } catch {
    /* 무시 */
  }
}

function useNow(ms = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/**
 * 집중 모드 화면: 마을 지도 위에 얹는 타이머·소리·날씨. 지도는 그대로 살아 있고
 * 내 캐릭터는 집중 중에 작업 중인 건물 앞, 쉬는 시간엔 카페·광장에 있다(TownRenderer).
 */
export default function FocusOverlay() {
  const f = useFocus();
  const projects = useApp((s) => s.projects);
  const friends = useApp((s) => s.friends);
  const townName = useApp((s) => s.townName);
  const now = useNow();
  const [wind, setWind] = useState(0.3);
  const [full, setFull] = useState(false);

  const mine = useMemo(() => projects.filter((p) => editable(p) && !p.hallAt), [projects]);
  const project = mine.find((p) => p.id === f.projectId);
  const quest = project?.quests.find((q) => q.id === f.questId);
  const openQuests = useMemo(
    () => mine.flatMap((p) => p.quests.filter((q) => q.status !== 'done').map((q) => ({ p, q }))),
    [mine],
  );

  // 할 일을 고르지 않았으면 진행 중이거나 첫 남은 퀘스트로
  useEffect(() => {
    if (quest && quest.status !== 'done') return;
    // 프로젝트를 정해서 들어왔으면 그 프로젝트의 퀘스트부터
    const inProject = openQuests.filter((x) => x.p.id === f.projectId);
    const pool = inProject.length ? inProject : openQuests;
    const pick = pool.find((x) => x.q.status === 'doing') ?? pool[0];
    if (pick) f.setTarget(pick.p.id, pick.q.id);
  }, [quest?.id, quest?.status, openQuests.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement);
    onFs();
    document.addEventListener('fullscreenchange', onFs);
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape' && !document.fullscreenElement) exitFocus();
      if (e.key === ' ') {
        e.preventDefault();
        useFocus.getState().toggleRun();
      }
      if (e.key.toLowerCase() === 'h') useFocus.getState().setUiHidden(!useFocus.getState().uiHidden);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const running = f.timer.endsAt !== null;
  const left = remaining(f.timer, now);
  const total = LENGTHS[f.timer.mode];
  const isFocus = f.timer.mode === 'focus';
  const accent = isFocus ? 'var(--amber)' : 'var(--mint)';
  const focusingFriends = friends.filter((x) => x.status === 'focus');
  const ask = f.askDone && projects.find((p) => p.id === f.askDone!.projectId)?.quests.find((q) => q.id === f.askDone!.questId);

  useEffect(() => {
    document.title = running ? `${format(left)} · ${isFocus ? '집중' : '휴식'} — SideTown` : 'SideTown — 사이드 프로젝트 마을';
  }, [Math.ceil(left / 1000), running, isFocus]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => {
    document.title = 'SideTown — 사이드 프로젝트 마을';
  }, []);

  return (
    <div className="focus-layer">
      <AmbientLayer scene={f.weather} onWind={setWind} />
      <div className="focus-vignette" aria-hidden />
      <div className="focus-progress" style={{ width: `${((total - left) / total) * 100}%`, background: accent }} />

      {f.uiHidden ? (
        <button className="hud-card focus-pill" onClick={() => f.setUiHidden(false)} aria-label="집중 화면 도구 보기">
          <span className="mono" style={{ fontSize: 22, color: running ? 'var(--text)' : 'var(--muted)' }}>{format(left)}</span>
          <span className="muted" style={{ fontSize: 11 }}>{isFocus ? '집중' : '휴식'} · 도구 보기 (H)</span>
        </button>
      ) : (
        <>
          <header className="focus-top">
            <span className="pixel" style={{ color: 'var(--amber)', fontSize: 16 }}>SIDETOWN</span>
            <span className="muted focus-sub" style={{ fontSize: 13 }}>집중 모드 · {townName}</span>
            <div style={{ flex: 1 }} />
            {focusingFriends.length > 0 && (
              <span className="hud-card focus-chip">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--coral)' }} />
                {focusingFriends.map((x) => x.name).join(', ')}도 집중 중
              </span>
            )}
            <div className="seg focus-weather" role="radiogroup" aria-label={`날씨 · ${windLabel(wind)}`}>
              {WEATHERS.map((w) => (
                <button key={w.id} role="radio" aria-checked={f.weather === w.id} onClick={() => f.setWeather(w.id)}>{w.label}</button>
              ))}
            </div>
            <button className="btn btn-sm" onClick={() => f.setUiHidden(true)}>UI 숨기기</button>
            <button
              className="btn btn-sm"
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
                else void document.documentElement.requestFullscreen?.().catch(() => undefined);
              }}
            >
              <IconExpand /> {full ? '창으로' : '전체 화면'}
            </button>
            <button className="btn btn-sm" onClick={exitFocus}>나가기 · Esc</button>
          </header>

          {!isFocus && running && <div className="hud-card focus-banner">쉬는 시간이에요 · 화면에서 잠시 눈을 떼 보세요</div>}

          {ask && f.askDone && (
            <div className="hud-card focus-ask" role="dialog" aria-label="퀘스트 완료 확인">
              <span style={{ fontSize: 15, fontWeight: 600 }}>‘{ask.title}’ 끝났나요?</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => { useApp.getState().toggleQuest(f.askDone!.projectId, f.askDone!.questId); f.dismissAsk(); }}>네, 완료 · +10 XP</button>
                <button className="btn btn-sm" onClick={f.dismissAsk}>아직, 다음 구간에 이어서</button>
              </div>
            </div>
          )}

          <section aria-label="뽀모도로 타이머" className="hud-card focus-timer">
            <div role="tablist" aria-label="타이머 종류" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {MODES.map(([m, label]) => {
                const on = m === f.timer.mode;
                const c = m === 'focus' ? 'var(--amber)' : 'var(--mint)';
                return (
                  <button key={m} role="tab" aria-selected={on} className="btn btn-sm" style={{ height: 30, borderColor: on ? c : 'var(--border)', color: on ? c : 'var(--muted)', background: 'transparent' }} onClick={() => f.setMode(m)}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
              <span className="mono focus-clock" aria-live="off" style={{ color: running ? 'var(--text)' : 'var(--muted)' }}>{format(left)}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 6 }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} style={{ width: 10, height: 10, borderRadius: 2, background: i < f.timer.done % 4 ? 'var(--amber)' : 'transparent', border: `1px solid ${i < f.timer.done % 4 || (i === f.timer.done % 4 && isFocus) ? 'var(--amber)' : '#4A5366'}` }} />
                  ))}
                </div>
                <span className="muted" style={{ fontSize: 11 }}>오늘 {f.timer.done}회 · {f.timer.done * 25}분</span>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: project?.color ?? 'var(--border)', flexShrink: 0 }} />
              <select
                className="input focus-quest"
                value={quest ? `${project!.id}|${quest.id}` : ''}
                aria-label="지금 할 퀘스트"
                onChange={(e) => {
                  const [pid, qid] = e.target.value.split('|');
                  f.setTarget(pid, qid);
                }}
              >
                {!quest && <option value="">할 퀘스트를 고르세요</option>}
                {mine.map((p) => (
                  <optgroup key={p.id} label={p.title}>
                    {p.quests.filter((q) => q.status !== 'done').map((q) => (
                      <option key={q.id} value={`${p.id}|${q.id}`}>{q.title} · {q.estimatedMinutes}분</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="focus-bgm-mini">
              <button className="btn btn-sm" aria-label={f.audioOn && f.bgmOn ? 'BGM 일시정지' : 'BGM 재생'} style={{ width: 32, height: 32, borderRadius: '50%', padding: 0, borderColor: 'var(--amber)', color: 'var(--amber)' }} onClick={f.toggleBgm}>
                {f.audioOn && f.bgmOn ? <IconPause /> : <IconPlay />}
              </button>
              <span style={{ flex: 1, fontSize: 12 }}>{TRACKS[f.track].name} · {f.audioOn ? (f.bgmOn ? '재생 중' : '멈춤') : '소리 꺼짐'}</span>
              <button className="btn btn-ghost btn-sm" aria-label="다음 곡" onClick={f.nextTrack}><IconSkip /></button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1, height: 48, background: accent }} onClick={f.toggleRun}>
                {running ? '일시정지' : isFocus ? '집중 시작' : '휴식 시작'} <span className="muted" style={{ fontSize: 11, color: 'inherit', opacity: 0.7 }}>Space</span>
              </button>
              <button className="btn" aria-label="다음 구간으로 건너뛰기" style={{ width: 48, height: 48 }} onClick={f.skip}><IconSkip /></button>
            </div>
          </section>

          <section aria-label="소리" className="hud-card focus-sound">
            {!f.audioOn && (
              <button className="btn btn-sm" style={{ height: 40, borderStyle: 'dashed', borderColor: 'var(--amber)', color: 'var(--amber)' }} onClick={f.enableAudio}>
                소리 켜기 · 브라우저에서 한 번 눌러야 재생돼요
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="btn btn-sm" aria-label={f.audioOn && f.bgmOn ? 'BGM 일시정지' : 'BGM 재생'} style={{ width: 36, height: 36, borderRadius: '50%', borderColor: 'var(--amber)', color: 'var(--amber)', padding: 0 }} onClick={f.toggleBgm}>
                {f.audioOn && f.bgmOn ? <IconPause /> : <IconPlay />}
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{TRACKS[f.track].name} · lo-fi</span>
                <span className="muted" style={{ fontSize: 11 }}>{f.track + 1}/{TRACKS.length} · {TRACKS[f.track].bpm} BPM · {f.audioOn ? (f.bgmOn ? '재생 중' : '멈춤') : '소리 꺼짐'}</span>
              </div>
              <button className="btn btn-ghost btn-sm" aria-label="다음 곡" onClick={f.nextTrack}><IconSkip /></button>
            </div>
            {LAYERS.map(([k, label]) => (
              <label key={k} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 30px', alignItems: 'center', gap: 10, fontSize: 12, color: f.vol[k] > 0 ? 'var(--text)' : 'var(--muted)' }}>
                <span>{label}</span>
                <input type="range" min={0} max={100} value={f.vol[k]} aria-label={`${label} 볼륨`} style={{ accentColor: '#F4B03E' }} onChange={(e) => f.setVol(k, Number(e.target.value))} />
                <span className="mono muted" style={{ fontSize: 11, textAlign: 'right' }}>{f.vol[k]}</span>
              </label>
            ))}
            <span style={{ fontSize: 11, color: 'var(--faint)' }}>타이머와 음악은 집중 화면을 닫아도 계속돼요</span>
          </section>
        </>
      )}
    </div>
  );
}

/** 집중 화면 밖에서 보이는 작은 타이머(상단 바·마을). 누르면 집중 화면으로 */
export function FocusMini() {
  const timer = useFocus((s) => s.timer);
  const open = useFocus((s) => s.open);
  const now = useNow(1000);
  const router = useRouter();
  const path = usePathname();
  const left = remaining(timer, now);
  const active = timer.endsAt !== null || left < LENGTHS[timer.mode];
  if (open || !active) return null;
  const isFocus = timer.mode === 'focus';
  return (
    <button className="focus-mini" onClick={() => { enterFocus(); if (path !== '/') router.push('/'); }} aria-label={`집중 화면 열기, ${isFocus ? '집중' : '휴식'} ${format(left)} 남음`} style={{ borderColor: isFocus ? 'var(--amber)' : 'var(--mint)' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: timer.endsAt === null ? 'var(--muted)' : isFocus ? 'var(--amber)' : 'var(--mint)' }} />
      <span className="mono">{format(left)}</span>
      <span className="focus-mini-label">{timer.endsAt === null ? '멈춤' : isFocus ? '집중' : '휴식'}</span>
    </button>
  );
}

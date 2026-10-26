'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AudioEngine, TRACKS, type Layer } from '@/focus/audioEngine';
import { advance, format, initial, LENGTHS, pause, remaining, setMode, start, type Mode, type TimerState } from '@/focus/timer';
import { useApp } from '@/store/useApp';
import { IconPause, IconPlay, IconSkip } from './icons';

const SCENES = [
  { id: 'night', label: '밤', src: '/assets/scenes/town-night.jpg', alt: '해 진 뒤의 마을' },
  { id: 'rain', label: '비 오는 밤', src: '/assets/scenes/town-rain.jpg', alt: '비 오는 밤의 마을' },
  { id: 'snow', label: '눈 오는 밤', src: '/assets/scenes/town-snow.jpg', alt: '눈 오는 밤의 마을' },
] as const;

const LAYERS: [Layer, string][] = [['bgm', 'BGM'], ['rain', '빗소리'], ['fire', '모닥불'], ['cafe', '카페 소음'], ['wave', '물결']];
const MODES: [Mode, string][] = [['focus', '집중 25'], ['short', '짧은 휴식 5'], ['long', '긴 휴식 15']];

export default function FocusScreen() {
  const params = useSearchParams();
  const projects = useApp((s) => s.projects);
  const toggleQuest = useApp((s) => s.toggleQuest);
  const project = projects.find((p) => p.id === params.get('project')) ?? projects[0];
  const quest = project?.quests.find((q) => q.id === params.get('quest')) ?? project?.quests.find((q) => q.status !== 'done');

  const [timer, setTimer] = useState<TimerState>(() => initial(2));
  const [now, setNow] = useState(() => Date.now());
  const [scene, setScene] = useState<(typeof SCENES)[number]['id']>('rain');
  const [ui, setUi] = useState(true);
  const [askDone, setAskDone] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const [bgmOn, setBgmOn] = useState(true);
  const [track, setTrack] = useState(0);
  const [vol, setVol] = useState({ bgm: 55, rain: 70, fire: 0, cafe: 25, wave: 30 });
  const engine = useRef<AudioEngine | null>(null);

  useEffect(() => {
    engine.current = new AudioEngine();
    return () => engine.current?.close();
  }, []);

  // 250ms마다 화면만 갱신. 시간 계산은 끝나는 시각 기준
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (timer.endsAt !== null && remaining(timer, now) <= 0) {
      const { state, finished } = advance(timer, now);
      setTimer(state);
      engine.current?.chime();
      if (finished === 'focus' && quest && quest.status !== 'done') setAskDone(true);
    }
  }, [now, timer, quest]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.location.assign('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const enableAudio = () => {
    const e = engine.current;
    if (!e) return false;
    const ok = e.ensure();
    if (ok) {
      e.vol = vol;
      e.bgmOn = bgmOn;
      e.track = track;
      e.apply();
      setAudioOn(true);
    }
    return ok;
  };

  const running = timer.endsAt !== null;
  const left = remaining(timer, now);
  const total = LENGTHS[timer.mode];
  const isFocus = timer.mode === 'focus';
  const accent = isFocus ? 'var(--amber)' : 'var(--mint)';
  const s = SCENES.find((x) => x.id === scene)!;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', overflow: 'hidden' }}>
      <img src={s.src} alt={s.alt} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: isFocus ? 'none' : 'brightness(0.8) saturate(0.9)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 320, background: 'linear-gradient(to bottom, rgba(14,17,27,0), rgba(14,17,27,0.78))' }} />
      <div style={{ position: 'absolute', left: 0, top: 0, height: 3, width: `${((total - left) / total) * 100}%`, background: accent }} />

      {ui ? (
        <>
          <div style={{ position: 'absolute', left: 20, right: 20, top: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/" className="pixel" style={{ color: 'var(--amber)', fontSize: 16, textDecoration: 'none' }}>SIDETOWN</Link>
            <span className="muted" style={{ fontSize: 13 }}>집중 모드</span>
            <div style={{ flex: 1 }} />
            <span className="hud-card" style={{ padding: '5px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--coral)' }} />지우도 집중 중
            </span>
            <button className="btn btn-sm" onClick={() => setUi(false)}>UI 숨기기</button>
            <Link href="/" className="btn btn-sm" style={{ textDecoration: 'none' }}>나가기 · Esc</Link>
          </div>

          {!isFocus && (
            <div className="hud-card" style={{ position: 'absolute', left: '50%', top: 70, transform: 'translateX(-50%)', borderColor: 'rgba(108,195,160,0.6)', fontSize: 14 }}>
              쉬는 시간이에요 · 화면에서 잠시 눈을 떼 보세요
            </div>
          )}

          {askDone && quest && (
            <div className="hud-card" role="dialog" aria-label="퀘스트 완료 확인" style={{ position: 'absolute', left: '50%', top: 120, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: 10, width: 'min(420px, calc(100vw - 32px))' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>‘{quest.title}’ 끝났나요?</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => { toggleQuest(project.id, quest.id); setAskDone(false); }}>네, 완료 · +10 XP</button>
                <button className="btn btn-sm" onClick={() => setAskDone(false)}>아직, 다음 구간에 이어서</button>
              </div>
            </div>
          )}

          <section aria-label="뽀모도로 타이머" className="hud-card" style={{ position: 'absolute', left: 20, bottom: 20, width: 'min(440px, calc(100vw - 40px))', display: 'flex', flexDirection: 'column', gap: 12, borderRadius: 14, padding: '18px 20px' }}>
            <div role="tablist" aria-label="타이머 종류" style={{ display: 'flex', gap: 6 }}>
              {MODES.map(([m, label]) => {
                const on = m === timer.mode;
                const c = m === 'focus' ? 'var(--amber)' : 'var(--mint)';
                return (
                  <button key={m} role="tab" aria-selected={on} className="btn btn-sm" style={{ height: 30, borderColor: on ? c : 'var(--border)', color: on ? c : 'var(--muted)', background: 'transparent' }} onClick={() => setTimer(setMode(timer, m))}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
              <span className="mono" aria-live="off" style={{ fontSize: 'clamp(64px, 12vw, 96px)', lineHeight: 0.9, letterSpacing: -3, color: running ? 'var(--text)' : 'var(--muted)' }}>{format(left)}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 6 }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} style={{ width: 10, height: 10, borderRadius: 2, background: i < timer.done % 4 ? 'var(--amber)' : 'transparent', border: `1px solid ${i < timer.done % 4 || (i === timer.done % 4 && isFocus) ? 'var(--amber)' : '#4A5366'}` }} />
                  ))}
                </div>
                <span className="muted" style={{ fontSize: 11 }}>오늘 {timer.done}회 · {timer.done * 25}분</span>
              </div>
            </div>
            {quest && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: project.color }} />
                <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{quest.title}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, height: 48, background: accent }}
                onClick={() => {
                  if (!running) enableAudio();
                  setTimer(running ? pause(timer, Date.now()) : start(timer, Date.now()));
                }}
              >
                {running ? '일시정지' : isFocus ? '집중 시작' : '휴식 시작'}
              </button>
              <button className="btn" aria-label="다음 구간으로 건너뛰기" style={{ width: 48, height: 48 }} onClick={() => setTimer(advance(timer, Date.now(), false).state)}><IconSkip /></button>
            </div>
          </section>

          <div className="hud-card" style={{ position: 'absolute', left: '50%', bottom: 20, transform: 'translateX(-50%)', display: 'flex', gap: 10, padding: 10 }} aria-label="장면">
            {SCENES.map((x) => (
              <button key={x.id} onClick={() => setScene(x.id)} aria-pressed={x.id === scene} style={{ width: 96, padding: 0, border: `2px solid ${x.id === scene ? 'var(--amber)' : 'transparent'}`, borderRadius: 8, overflow: 'hidden', background: 'var(--panel)', display: 'flex', flexDirection: 'column' }}>
                <img src={x.src} alt="" style={{ width: '100%', height: 52, objectFit: 'cover' }} />
                <span style={{ fontSize: 11, padding: '4px 0', color: x.id === scene ? 'var(--amber)' : 'var(--muted)' }}>{x.label}</span>
              </button>
            ))}
          </div>

          <section aria-label="소리" className="hud-card" style={{ position: 'absolute', right: 20, bottom: 20, width: 320, display: 'flex', flexDirection: 'column', gap: 12, borderRadius: 14, padding: '16px 18px' }}>
            {!audioOn && (
              <button className="btn btn-sm" style={{ height: 40, borderStyle: 'dashed', borderColor: 'var(--amber)', color: 'var(--amber)' }} onClick={enableAudio}>
                소리 켜기 · 브라우저에서 한 번 눌러야 재생돼요
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                className="btn btn-sm"
                aria-label={audioOn && bgmOn ? 'BGM 일시정지' : 'BGM 재생'}
                style={{ width: 36, height: 36, borderRadius: '50%', borderColor: 'var(--amber)', color: 'var(--amber)', padding: 0 }}
                onClick={() => {
                  if (!audioOn) { enableAudio(); return; }
                  engine.current?.setBgm(!bgmOn);
                  setBgmOn(!bgmOn);
                }}
              >
                {audioOn && bgmOn ? <IconPause /> : <IconPlay />}
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{TRACKS[track].name} · lo-fi</span>
                <span className="muted" style={{ fontSize: 11 }}>{track + 1}/3 · {TRACKS[track].bpm} BPM · {audioOn ? (bgmOn ? '재생 중' : '멈춤') : '소리 꺼짐'}</span>
              </div>
              <button className="btn btn-ghost btn-sm" aria-label="다음 곡" onClick={() => { engine.current?.nextTrack(); setTrack((track + 1) % TRACKS.length); }}><IconSkip /></button>
            </div>
            {LAYERS.map(([k, label]) => (
              <label key={k} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 30px', alignItems: 'center', gap: 10, fontSize: 12, color: vol[k] > 0 ? 'var(--text)' : 'var(--muted)' }}>
                <span>{label}</span>
                <input type="range" min={0} max={100} value={vol[k]} aria-label={`${label} 볼륨`} style={{ accentColor: '#F4B03E' }} onChange={(e) => { const v = Number(e.target.value); setVol({ ...vol, [k]: v }); engine.current?.setVolume(k, v); }} />
                <span className="mono muted" style={{ fontSize: 11, textAlign: 'right' }}>{vol[k]}</span>
              </label>
            ))}
            <span style={{ fontSize: 11, color: 'var(--faint)' }}>모든 소리는 브라우저에서 실시간 합성 · 파일·저작권 없음</span>
          </section>
        </>
      ) : (
        <button onClick={() => setUi(true)} className="hud-card" style={{ position: 'absolute', left: 20, bottom: 20, display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text)', cursor: 'pointer' }}>
          <span className="mono" style={{ fontSize: 22 }}>{format(left)}</span>
          <span className="muted" style={{ fontSize: 11 }}>UI 보기</span>
        </button>
      )}
    </div>
  );
}

'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect } from 'react';
import { actualProgress, buildingStage, expectedProgress, health } from '@/lib/schedule';
import { useApp, type Mode } from '@/store/useApp';
import { unreadCount } from '@/lib/social';
import { EMPTY_PLOTS } from '@/town/map';
import { IconCalendar, IconCup, IconExpand, IconList, IconMail, IconTown, IconUser } from './icons';
import FriendProjectPanel from './FriendProjectPanel';
import LiveSync from './LiveSync';
import PlacePanel from './PlacePanel';
import ProjectPanel from './ProjectPanel';
import Voyage from './Voyage';

const TownCanvas = dynamic(() => import('./TownCanvas'), { ssr: false });

export default function TownApp({ mode, meId }: { mode: Mode; meId?: string }) {
  const projects = useApp((s) => s.projects);
  const townProjects = useApp((s) => s.townProjects);
  const friends = useApp((s) => s.friends);
  const townName = useApp((s) => s.townName);
  const me = useApp((s) => s.meId);
  const booted = useApp((s) => s.booted);
  const selectedId = useApp((s) => s.selectedId);
  const listMode = useApp((s) => s.listMode);
  const xp = useApp((s) => s.xp);
  const toast = useApp((s) => s.toast);
  const view = useApp((s) => s.view);
  const messages = useApp((s) => s.messages);
  const { setListMode, select, openView } = useApp.getState();
  const unread = unreadCount(messages, undefined, me);
  const online = friends.filter((f) => f.status !== 'offline').length;
  const selected = projects.find((p) => p.id === selectedId) ?? null;
  const friendProject = selected ? null : townProjects.find((p) => p.id === selectedId) ?? null;
  const level = 1 + Math.floor(xp / 100);
  const townDone = projects.reduce((n, p) => n + p.milestones.filter((m) => m.status === 'completed').length, 0);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => useApp.setState({ toast: null }), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { select(null); openView(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select, openView]);

  return (
    <div className="shell">
      <LiveSync mode={mode} meId={meId} presence={PRESENCE_ONLINE} />
      <header className="topbar">
        <Link href="/" className="brand">SIDETOWN</Link>
        <span style={{ width: 1, height: 18, background: 'var(--border)' }} className="town" />
        <span className="town">{townName}</span>
        <div style={{ flex: 1 }} />
        <div className="xp" title={`누적 ${xp} XP`}>
          <img src="/assets/character/front-right.png" alt="" />
          <span className="pixel" style={{ fontSize: 13, color: 'var(--amber)' }}>LV {level}</span>
          <span className="bar"><span style={{ width: `${xp % 100}%` }} /></span>
          <span className="mono xp-num" style={{ fontSize: 12, color: 'var(--muted)' }}>{xp % 100}/100</span>
        </div>
        <div className="friends">
          <span className="label">접속 {online}</span>
          <span style={{ display: 'flex' }}>
            {friends.map((f) => (
              <button key={f.id} className="avatar" title={`${f.name}에게 쪽지`} aria-label={`${f.name}에게 쪽지 (${f.status === 'focus' ? '집중 중' : f.status === 'online' ? '접속 중' : '오프라인'})`} onClick={() => openView({ kind: 'inbox', friendId: f.id })} style={{ background: f.bg, color: f.fg, padding: 0, opacity: f.status === 'offline' ? 0.55 : 1 }}>
                {f.initial}
                {f.status !== 'offline' && <span className="dot" style={{ background: f.status === 'focus' ? 'var(--coral)' : 'var(--mint)' }} />}
              </button>
            ))}
          </span>
        </div>
        <button className="icon-btn" aria-label={`쪽지함${unread ? `, 안 읽은 쪽지 ${unread}개` : ''}`} onClick={() => openView({ kind: 'inbox' })} style={{ position: 'relative', width: 40, height: 40, border: '1px solid var(--border)', color: 'var(--text)' }}>
          <IconMail />
          {unread > 0 && <span className="mono" style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, background: 'var(--coral)', color: '#1a0e0a', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{unread}</span>}
        </button>
      </header>

      <div className="body">
        <nav className="rail" aria-label="주요 메뉴">
          <button className="icon-btn" aria-label="마을" aria-current={!listMode ? 'page' : undefined} onClick={() => setListMode(false)}><IconTown /></button>
          <button className="icon-btn" aria-label="계획 (단계 1.5)" title="계획 화면은 단계 1.5에서 연결돼요" disabled style={{ opacity: 0.45 }}><IconCalendar /></button>
          <button className="icon-btn" aria-label="프로젝트 목록" aria-current={listMode ? 'page' : undefined} onClick={() => setListMode(true)}><IconList /></button>
          <button className="icon-btn" aria-label="공용 카페 · 마을 게시판" aria-current={view?.kind === 'cafe' ? 'page' : undefined} onClick={() => openView({ kind: 'cafe' })}><IconCup /></button>
          <button className="icon-btn" aria-label="내 집 · 캐릭터" aria-current={view?.kind === 'home' ? 'page' : undefined} onClick={() => openView({ kind: 'home' })}><IconUser /></button>
        </nav>

        <main className="stage">
          {mode === 'demo' && booted && <span className="demo-banner">데모 마을 · 이 브라우저에만 저장돼요</span>}
          {!listMode && <TownCanvas panelOpen={!!selected || !!friendProject || !!view} />}
          {listMode && <ListView />}

          {!listMode && (
            <div className="hud town-growth hud-card" style={{ position: 'absolute' }}>
              <span className="muted" style={{ fontSize: 12 }}>마을 성장</span>
              <span><b className="mono" style={{ fontSize: 20 }}>{townDone}</b> <span className="muted" style={{ fontSize: 12 }}>/ 15 중간 목표</span></span>
              <div className="ticks">{Array.from({ length: 15 }, (_, i) => <span key={i} className={i < townDone ? 'on' : ''} />)}</div>
              <span className="muted" style={{ fontSize: 12 }}>{Math.max(0, 5 - townDone) > 0 ? `${5 - townDone}개 더 완료하면 공용 화단이 열려요` : '15개를 채우면 광장 가로등이 하나 더 켜져요'}</span>
            </div>
          )}

          <div className="hud" style={{ right: 16, bottom: 16 }}>
            <button
              className="btn btn-sm"
              style={{ height: 40 }}
              onClick={() => {
                const used = new Set([...projects, ...townProjects].map((p) => p.plotId));
                const free = EMPTY_PLOTS.find((pl) => !used.has(pl.id));
                if (free) openView({ kind: 'new', plotId: free.id });
                else useApp.getState().notify('빈 부지가 없어요 · 마을 확장 구역은 다음 단계에서 열려요', 'warn');
              }}
            >
              + 새 프로젝트
            </button>
            <button className="btn btn-sm" onClick={() => setListMode(!listMode)} style={{ height: 40 }}>{listMode ? '마을로 보기' : '목록으로 보기'}</button>
            <Link href="/focus" className="btn btn-sm" style={{ height: 40, textDecoration: 'none', borderColor: 'var(--amber)', color: 'var(--amber)' }}><IconExpand /> 전체 화면 집중</Link>
          </div>

          {mode === 'demo' && <DevTools />}
        </main>

        {view ? <PlacePanel view={view} /> : friendProject ? <FriendProjectPanel project={friendProject} /> : <ProjectPanel project={selected} />}
      </div>

      {toast && (
        <div key={toast.id} className={`toast ${toast.tone}`} role="status" aria-live="polite">{toast.text}</div>
      )}
    </div>
  );
}

const PRESENCE_ONLINE = { status: 'online' } as const;

function ListView() {
  const projects = useApp((s) => s.projects);
  const today = useApp((s) => s.today);
  const select = useApp((s) => s.select);
  return (
    <div className="list" role="list" aria-label="프로젝트 목록">
      {projects.map((p) => {
        const stage = buildingStage(p);
        return (
          <button key={p.id} role="listitem" className="card list-card" onClick={() => select(p.id)}>
            <img src={p.condition === 'decayed' && p.building === 'workshop' ? '/assets/town/workshop-decayed.png' : `/assets/town/${p.building}-s${stage}.png`} alt="" style={{ filter: p.condition === 'decayed' && p.building !== 'workshop' ? 'grayscale(0.8) brightness(0.6)' : undefined }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
              <span style={{ fontWeight: 600 }}>{p.title}</span>
              <Voyage progress={actualProgress(p)} expected={expectedProgress(p, today)} color={p.color} health={health(p, today)} width={170} height={32} />
              <span className="muted" style={{ fontSize: 12 }}>{p.condition === 'decayed' ? '건물이 낡았어요 · 작업을 시작하면 수리돼요' : `${stage}단계 · 남은 퀘스트 ${p.quests.filter((q) => q.status !== 'done').length}개`}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DevTools() {
  const today = useApp((s) => s.today);
  const { advanceDays, reset } = useApp.getState();
  return (
    <details className="devtools">
      <summary>검증 도구 · 오늘 {today.slice(5).replace('-', '.')}</summary>
      <div className="dev-body hud-card">
        <span className="muted" style={{ fontSize: 11, lineHeight: 1.5 }}>단계 0 검증용. 실제 서비스에는 없어요.</span>
        <button className="btn btn-sm" onClick={() => advanceDays(7)}>하루 시계 +7일</button>
        <button className="btn btn-sm" onClick={() => advanceDays(30)}>하루 시계 +30일</button>
        <button className="btn btn-sm" onClick={reset}>예시 데이터로 되돌리기</button>
      </div>
    </details>
  );
}

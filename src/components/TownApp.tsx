'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect } from 'react';
import { actualProgress, buildingStage, expectedProgress, health } from '@/lib/schedule';
import { activeProjects, mapProjects, useApp, type Mode } from '@/store/useApp';
import { firstFreeLot } from '@/town/map';
import { MobileNav, Rail, Toaster, Topbar } from './AppChrome';
import FocusOverlay, { enterFocus } from './FocusOverlay';
import { useFocus } from '@/focus/useFocus';
import { useRouter } from 'next/navigation';
import { IconCalendar, IconExpand, IconMove } from './icons';
import FriendProjectPanel from './FriendProjectPanel';
import LiveSync from './LiveSync';
import PlacePanel from './PlacePanel';
import ProjectPanel from './ProjectPanel';
import Voyage from './Voyage';

const TownCanvas = dynamic(() => import('./TownCanvas'), { ssr: false });

export default function TownApp({ mode, meId }: { mode: Mode; meId?: string }) {
  const projects = useApp((s) => s.projects);
  const townProjects = useApp((s) => s.townProjects);
  const booted = useApp((s) => s.booted);
  const selectedId = useApp((s) => s.selectedId);
  const listMode = useApp((s) => s.listMode);
  const view = useApp((s) => s.view);
  const { setListMode, select, openView } = useApp.getState();
  const focusOpen = useFocus((s) => s.open);
  const moving = useApp((s) => s.moving);
  const router = useRouter();

  // 예전 /focus 링크·계획 화면에서 넘어온 경우(?focus=1&project=…&quest=…)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('focus') !== '1') return;
    enterFocus({ projectId: q.get('project') ?? undefined, questId: q.get('quest') ?? undefined });
    router.replace('/', { scroll: false });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = projects.find((p) => p.id === selectedId) ?? null;
  const friendProject = selected ? null : townProjects.find((p) => p.id === selectedId) ?? null;
  // 마을 전체(친구 포함)의 중간 목표 완료 수. 친구가 겉모습만 공개했으면 단계로 대신 센다
  const townDone =
    projects.reduce((n, p) => n + p.milestones.filter((m) => m.status === 'completed').length, 0) +
    townProjects.reduce((n, p) => n + (p.milestones.length ? p.milestones.filter((m) => m.status === 'completed').length : (p.stage ?? 0)), 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (useFocus.getState().open) return;
        if (useApp.getState().moving) {
          useApp.getState().cancelMove();
          return;
        }
        select(null);
        openView(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select, openView]);

  return (
    <div className={`shell${focusOpen ? ' focus-on' : ''}`}>
      <LiveSync mode={mode} meId={meId} />
      <Topbar />
      <div className="body">
        <Rail active="town" />

        <main className="stage">
          {mode === 'demo' && booted && <span className="demo-banner">데모 마을 · 이 브라우저에만 저장돼요</span>}
          {(!listMode || focusOpen) && <TownCanvas panelOpen={!focusOpen && (!!selected || !!friendProject || !!view)} />}
          {focusOpen && <FocusOverlay />}
          {moving && !focusOpen && (
            <div className="move-banner hud-card" role="status">
              <IconMove />
              <span><b>{moving.title}</b> · 옮길 빈 부지를 눌러 주세요</span>
              <button className="btn btn-sm" onClick={() => useApp.getState().cancelMove()}>취소</button>
            </div>
          )}
          {listMode && <ListView />}

          {!listMode && (
            <div className="hud town-growth hud-card" style={{ position: 'absolute' }}>
              <span className="muted" style={{ fontSize: 12 }}>마을 성장</span>
              <span><b className="mono" style={{ fontSize: 20 }}>{townDone}</b> <span className="muted" style={{ fontSize: 12 }}>/ 15 중간 목표</span></span>
              <div className="ticks">{Array.from({ length: 15 }, (_, i) => <span key={i} className={i < townDone ? 'on' : ''} />)}</div>
              <span className="muted" style={{ fontSize: 12 }}>{Math.max(0, 5 - townDone) > 0 ? `${5 - townDone}개 더 완료하면 공용 화단이 열려요` : '15개를 채우면 광장 가로등이 하나 더 켜져요'}</span>
            </div>
          )}

          <div className="hud town-hud" style={{ right: 16, bottom: 16 }}>
            <button
              className="btn btn-sm"
              style={{ height: 40 }}
              onClick={() => {
                const st = useApp.getState();
                const free = firstFreeLot(mapProjects(st).map((p) => p.plotId), st.layout);
                if (free) openView({ kind: 'new', plotId: free });
                else useApp.getState().notify('빈 부지가 없어요 · 철거하거나 완공 건물을 명예의 전당에 올리면 부지가 비어요', 'warn');
              }}
            >
              + 새 프로젝트
            </button>
            <Link href="/plan" className="btn btn-sm" style={{ height: 40, textDecoration: 'none' }}><IconCalendar width={16} height={16} /> 계획</Link>
            <button className="btn btn-sm" onClick={() => setListMode(!listMode)} style={{ height: 40 }}>{listMode ? '마을로 보기' : '목록으로 보기'}</button>
            <button className="btn btn-sm" onClick={() => enterFocus()} style={{ height: 40, borderColor: 'var(--amber)', color: 'var(--amber)' }}><IconExpand /> 집중 모드</button>
          </div>

          {mode === 'demo' && <DevTools />}
        </main>

        {view ? <PlacePanel view={view} /> : friendProject ? <FriendProjectPanel project={friendProject} /> : <ProjectPanel project={selected} />}
      </div>
      <MobileNav active="town" />
      <Toaster />
    </div>
  );
}

function ListView() {
  const projects = useApp((s) => s.projects);
  const today = useApp((s) => s.today);
  const select = useApp((s) => s.select);
  return (
    <div className="list" role="list" aria-label="프로젝트 목록">
      {activeProjects(projects).map((p) => {
        const stage = buildingStage(p);
        return (
          <button key={p.id} role="listitem" className="card list-card" onClick={() => select(p.id)}>
            <img src={p.status === 'demolishing' ? '/assets/town/demolition.png' : p.condition === 'decayed' && p.building === 'workshop' ? '/assets/town/workshop-decayed.png' : `/assets/town/${p.building}-s${stage}.png`} alt="" style={{ filter: p.condition === 'decayed' && p.building !== 'workshop' ? 'grayscale(0.8) brightness(0.6)' : undefined }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
              <span style={{ fontWeight: 600 }}>{p.title}</span>
              <Voyage progress={actualProgress(p)} expected={expectedProgress(p, today)} color={p.color} health={health(p, today)} width={170} height={32} />
              <span className="muted" style={{ fontSize: 12 }}>{p.status === 'demolishing' ? '철거 중' : p.condition === 'decayed' ? '건물이 낡았어요 · 작업을 시작하면 수리돼요' : `${stage}단계 · 남은 퀘스트 ${p.quests.filter((q) => q.status !== 'done').length}개`}</span>
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
        <span className="muted" style={{ fontSize: 11, lineHeight: 1.5 }}>데모 마을 검증용. 실제 서비스에는 없어요.</span>
        <button className="btn btn-sm" onClick={() => advanceDays(7)}>하루 시계 +7일</button>
        <button className="btn btn-sm" onClick={() => advanceDays(30)}>하루 시계 +30일</button>
        <button
          className="btn btn-sm"
          onClick={() => {
            // 철거 1시간을 기다리지 않고 확인하기
            const s = useApp.getState();
            useApp.setState({ projects: s.projects.map((p) => (p.status === 'demolishing' ? { ...p, demolishEndsAt: new Date(Date.now() - 1000).toISOString() } : p)) });
            s.tickClock();
          }}
        >
          철거 시간 건너뛰기
        </button>
        <button className="btn btn-sm" onClick={reset}>예시 데이터로 되돌리기</button>
      </div>
    </details>
  );
}

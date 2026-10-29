'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { allQuests } from '@/lib/plan';
import type { ISODate } from '@/lib/types';
import { activeProjects, useApp, type Mode } from '@/store/useApp';
import { MobileNav, Rail, Toaster, Topbar } from '../AppChrome';
import LiveSync from '../LiveSync';
import { IconPlus } from '../icons';
import Drawer from './Drawer';
import { ProjectFilter, type Selection } from './shared';
import { Overview, Today, Week, type ViewProps } from './ViewsA';
import { Board, Month, Table, Timeline } from './ViewsB';

const VIEWS = [
  ['overview', '한눈에'],
  ['today', '오늘'],
  ['week', '주간'],
  ['month', '월간'],
  ['timeline', '타임라인'],
  ['table', '표'],
  ['board', '보드'],
] as const;
type ViewKey = (typeof VIEWS)[number][0];

const PRESENCE = { status: 'online' } as const;

export default function PlanApp({ mode, meId }: { mode: Mode; meId?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const projectsAll = useApp((s) => s.projects);
  const friendsAll = useApp((s) => s.townProjects);
  const today = useApp((s) => s.today);
  const prefs = useApp((s) => s.prefs);
  const booted = useApp((s) => s.booted);

  const initial = (params.get('view') as ViewKey) ?? 'overview';
  const [view, setView] = useState<ViewKey>(VIEWS.some(([k]) => k === initial) ? initial : 'overview');
  const [filter, setFilter] = useState<string | 'all'>(params.get('project') ?? 'all');
  const [showFriends, setShowFriends] = useState(params.get('friends') === '1');
  const [anchor, setAnchor] = useState<ISODate>(today);
  const [sel, setSel] = useState<Selection>(null);

  // 데모 날짜(예시 데이터 기준일)와 서버 날짜가 다르므로 오늘이 정해지면 맞춘다
  useEffect(() => setAnchor(today), [today]);

  useEffect(() => {
    const q = new URLSearchParams();
    if (view !== 'overview') q.set('view', view);
    if (filter !== 'all') q.set('project', filter);
    if (showFriends) q.set('friends', '1');
    const s = q.toString();
    router.replace(s ? `${path}?${s}` : path, { scroll: false });
  }, [view, filter, showFriends]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const mine = useMemo(() => activeProjects(projectsAll).filter((p) => filter === 'all' || p.id === filter), [projectsAll, filter]);
  const friends = useMemo(
    () => (showFriends ? friendsAll.filter((p) => p.status !== 'archived' && !p.hallAt && (filter === 'all' || p.id === filter)) : []),
    [friendsAll, showFriends, filter],
  );
  const refs = useMemo(() => allQuests(mine, friends), [mine, friends]);
  const props: ViewProps = { refs, mine, friends, today, prefs, open: setSel, anchor, setAnchor, goView: (v) => setView(v as ViewKey) };

  return (
    <div className="shell">
      <LiveSync mode={mode} meId={meId} presence={PRESENCE} />
      <Topbar />
      <div className="body">
        <Rail active="plan" />
        <main className="plan" aria-label="계획">
          <div className="plan-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1>계획</h1>
              <span className="muted" style={{ fontSize: 13 }}>진행 중 {activeProjects(projectsAll).filter((p) => p.status === 'active').length} · 남은 퀘스트 {refs.filter((r) => !r.readonly && r.quest.status !== 'done').length}</span>
              <div style={{ flex: 1 }} />
              <button className="btn btn-primary btn-sm" onClick={() => setSel({ kind: 'new-quest', projectId: filter !== 'all' ? filter : undefined })} style={{ height: 36 }}><IconPlus /> 퀘스트 추가</button>
            </div>
            <ProjectFilter projects={activeProjects(projectsAll)} friends={friendsAll.filter((p) => !p.hallAt)} selected={filter} setSelected={setFilter} showFriends={showFriends} setShowFriends={setShowFriends} />
            <div className="tabs plan-tabs" role="tablist" aria-label="보기">
              {VIEWS.map(([k, label]) => (
                <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}>{label}</button>
              ))}
            </div>
          </div>
          <div className="plan-body" role="tabpanel">
            {!booted ? null : view === 'overview' ? <Overview {...props} /> :
              view === 'today' ? <Today {...props} /> :
              view === 'week' ? <Week {...props} /> :
              view === 'month' ? <Month {...props} /> :
              view === 'timeline' ? <Timeline {...props} /> :
              view === 'table' ? <Table {...props} /> :
              <Board {...props} />}
          </div>
        </main>
        {sel && <Drawer key={JSON.stringify(sel)} sel={sel} onClose={() => setSel(null)} />}
      </div>
      <MobileNav active="plan" />
      <Toaster />
    </div>
  );
}

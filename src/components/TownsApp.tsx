'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BUILDING_INFO } from '@/lib/templates';
import { activeProjects, useApp, type Mode } from '@/store/useApp';
import { MobileNav, Rail, Toaster, Topbar } from './AppChrome';
import LiveSync from './LiveSync';
import { IconCopy, IconPlus, IconTown } from './icons';

/** 내 마을들(친구 그룹별) 한눈에 보기 · 새 마을 · 마을 간 프로젝트 복사 */
export default function TownsApp({ mode, meId }: { mode: Mode; meId?: string }) {
  const router = useRouter();
  const towns = useApp((s) => s.towns);
  const townId = useApp((s) => s.townId);
  const projects = useApp((s) => s.projects);
  const [name, setName] = useState('');
  const others = towns.filter((t) => t.id !== townId);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const mine = activeProjects(projects).filter((p) => p.status !== 'archived');

  return (
    <div className="shell">
      <LiveSync mode={mode} meId={meId} />
      <Topbar />
      <div className="body">
        <Rail active="towns" />
        <main className="plan" aria-label="내 마을">
          <div className="plan-body">
            <div className="towns">
              <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <h1 style={{ margin: 0, fontSize: 24 }}>내 마을</h1>
                <span className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>친구 그룹마다 마을을 따로 만들 수 있어요(최대 10곳, 마을마다 8명). 위쪽 마을 이름을 눌러 언제든 오갈 수 있어요.</span>
              </header>

              <section className="town-cards" aria-label="마을 목록">
                {towns.map((t) => {
                  const cur = t.id === townId;
                  return (
                    <article key={t.id} className={`card town-card${cur ? ' cur' : ''}`}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconTown />
                        <b className="ellipsis" style={{ flex: 1, fontSize: 15 }}>{t.name}</b>
                        {cur && <span className="chip" style={{ color: 'var(--amber)', borderColor: 'currentColor' }}>지금 마을</span>}
                      </div>
                      <span className="muted" style={{ fontSize: 12 }}>{t.members}명이 살아요 · 내 프로젝트 {t.myProjects}개</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {cur ? (
                          <button className="btn btn-sm" onClick={() => { useApp.getState().openView({ kind: 'cafe' }); router.push('/'); }}>친구 초대 · 카페로</button>
                        ) : (
                          <button className="btn btn-primary btn-sm" onClick={async () => { await useApp.getState().switchTown(t.id); router.push('/'); }}>이 마을로 가기</button>
                        )}
                      </div>
                    </article>
                  );
                })}
                <form
                  className="card town-card new"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!name.trim()) return;
                    await useApp.getState().createTown(name);
                    setName('');
                  }}
                >
                  <b style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconPlus /> 새 마을 만들기</b>
                  <input className="input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="예: 회사 동기 마을, 주말 스터디" aria-label="새 마을 이름" />
                  <button className="btn btn-sm" disabled={!name.trim()} style={{ alignSelf: 'flex-start', opacity: name.trim() ? 1 : 0.5 }}>만들고 들어가기</button>
                </form>
              </section>

              <section className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }} aria-label="프로젝트 복사">
                <h2 style={{ margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}><IconCopy /> 다른 마을로 프로젝트 복사</h2>
                <span className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
                  지금 마을의 내 프로젝트를 진행 상황 그대로 다른 마을에도 세워요. 원래 건물은 이 마을에 남아요(경험치는 다시 주지 않아요). 다른 마을의 프로젝트를 복사하려면 그 마을로 먼저 가세요.
                </span>
                {others.length === 0 && <span className="muted" style={{ fontSize: 13 }}>복사할 다른 마을이 없어요. 위에서 새 마을을 만들어 보세요.</span>}
                {others.length > 0 && mine.length === 0 && <span className="muted" style={{ fontSize: 13 }}>이 마을에 내 프로젝트가 없어요.</span>}
                {others.length > 0 && mine.map((p) => {
                  const target = targets[p.id] ?? others[0].id;
                  return (
                    <div key={p.id} className="copy-row" style={{ ['--pc' as string]: p.color }}>
                      <img src={`/assets/town/${p.building}-s${Math.min(3, p.stage ?? 0)}.png`} alt="" />
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <b className="ellipsis" style={{ fontSize: 14 }}>{p.title}</b>
                        <span className="muted" style={{ fontSize: 11 }}>{BUILDING_INFO[p.building].name} · 중간 목표 {p.milestones.filter((m) => m.status === 'completed').length}/{p.milestones.length}{p.hallAt ? ' · 명예의 전당' : ''}</span>
                      </span>
                      <select className="input" style={{ width: 170 }} value={target} onChange={(e) => setTargets({ ...targets, [p.id]: e.target.value })} aria-label={`${p.title} 복사할 마을`}>
                        {others.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <button className="btn btn-sm" style={{ height: 38 }} disabled={p.status === 'demolishing'} onClick={() => useApp.getState().copyProject(p.id, target)}>복사</button>
                    </div>
                  );
                })}
              </section>
            </div>
          </div>
        </main>
      </div>
      <MobileNav active="towns" />
      <Toaster />
    </div>
  );
}

'use client';

import { Fragment, useMemo, useState } from 'react';
import { addDays } from '@/lib/schedule';
import { capacityFor, dayLoad, dowLabel, md, monthGrid, questsOn, timelineScale, type QuestRef } from '@/lib/plan';
import { editable } from '@/lib/edit';
import type { ISODate, Project, Quest } from '@/lib/types';
import { useApp } from '@/store/useApp';
import { IconChevron, IconPin, IconPlus } from '../icons';
import { QuestCard, STATUS_LABEL, useDrop } from './shared';
import type { ViewProps } from './ViewsA';

/* ───────── 월간 ───────── */
export function Month({ refs, mine, friends, today, prefs, open, anchor, setAnchor, goView }: ViewProps) {
  const grid = monthGrid(anchor);
  const month = anchor.slice(0, 7);
  const marks = useMemo(() => {
    const m = new Map<ISODate, { label: string; color: string; kind: 'ms' | 'pj'; open: () => void }[]>();
    const push = (d: ISODate, v: { label: string; color: string; kind: 'ms' | 'pj'; open: () => void }) => m.set(d, [...(m.get(d) ?? []), v]);
    for (const p of [...mine, ...friends]) {
      for (const ms of p.milestones) if (ms.status !== 'completed') push(ms.target, { label: ms.title, color: p.color, kind: 'ms', open: () => open({ kind: 'milestone', projectId: p.id, milestoneId: ms.id }) });
      if (p.status !== 'completed') push(p.target, { label: p.title, color: p.color, kind: 'pj', open: () => undefined });
    }
    return m;
  }, [mine, friends, open]);
  const shift = (n: number) => {
    const [y, mo] = anchor.split('-').map(Number);
    setAnchor(new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 10));
  };
  return (
    <div className="month">
      <div className="week-nav">
        <button className="icon-btn" aria-label="지난달" onClick={() => shift(-1)}><IconChevron style={{ transform: 'scaleX(-1)' }} /></button>
        <h2>{Number(month.slice(0, 4))}년 {Number(month.slice(5))}월</h2>
        <button className="icon-btn" aria-label="다음 달" onClick={() => shift(1)}><IconChevron /></button>
        {month !== today.slice(0, 7) && <button className="btn btn-sm" onClick={() => setAnchor(today)}>이번 달</button>}
        <div style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 12 }}>◆ 중간 목표일 · ⚑ 프로젝트 목표일 · 칸으로 끌어다 놓으면 그날 일정</span>
      </div>
      <div className="mgrid" role="grid" aria-label="월간 달력">
        {['월', '화', '수', '목', '금', '토', '일'].map((d) => <span key={d} className="mhead">{d}</span>)}
        {grid.map((d) => (
          <MonthCell key={d} d={d} out={d.slice(0, 7) !== month} today={today} refs={questsOn(refs, d)} marks={marks.get(d) ?? []} over={dayLoad(refs, d) > capacityFor(d, prefs)} open={open}
            onPick={() => { setAnchor(d); goView('week'); }} />
        ))}
      </div>
    </div>
  );
}

function MonthCell({ d, out, today, refs, marks, over, open, onPick }: { d: ISODate; out: boolean; today: ISODate; refs: QuestRef[]; marks: { label: string; color: string; kind: 'ms' | 'pj'; open: () => void }[]; over: boolean; open: ViewProps['open']; onPick: () => void }) {
  const drop = useDrop((pid, qid) => useApp.getState().updateQuest(pid, qid, { scheduledStart: d }));
  const items = refs.slice(0, 3);
  return (
    <div className={`mcell${out ? ' out' : ''}${d === today ? ' is-today' : ''}${drop.over ? ' drop' : ''}`} {...drop.props} role="gridcell">
      <button className="mnum mono" onClick={onPick} aria-label={`${md(d)} 주간 보기로`} style={{ color: over ? 'var(--coral)' : undefined }}>{Number(d.slice(8))}</button>
      {marks.map((m, i) => (
        <button key={i} className="mmark ellipsis" style={{ color: m.color }} onClick={m.open} title={m.label}>{m.kind === 'ms' ? '◆' : '⚑'} {m.label}</button>
      ))}
      {items.map((r) => (
        <button key={r.quest.id} className={`mq ellipsis ${r.quest.status}`} style={{ ['--pc' as string]: r.project.color }} draggable={!r.readonly}
          onDragStart={(e) => e.dataTransfer.setData('text/sidetown-quest', JSON.stringify({ projectId: r.project.id, questId: r.quest.id }))}
          onClick={() => open({ kind: 'quest', projectId: r.project.id, questId: r.quest.id })} title={r.quest.title}>
          {r.quest.title}
        </button>
      ))}
      {refs.length > 3 && <button className="mmore" onClick={onPick}>+{refs.length - 3}개</button>}
    </div>
  );
}

/* ───────── 타임라인(간트) ───────── */
export function Timeline({ mine, friends, today, open }: ViewProps) {
  const [months, setMonths] = useState(6);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const s = timelineScale(today, months);
  const pct = (d: ISODate) => `${s.x(d) * 100}%`;
  const width = (a: ISODate, b: ISODate) => `${Math.max(0.4, (s.x(addDays(b, 1)) - s.x(a)) * 100)}%`;
  const names = useApp((st) => st.friends);
  const rows: { p: Project; ro: boolean }[] = [...mine.map((p) => ({ p, ro: !editable(p) })), ...friends.filter((p) => p.milestones.length).map((p) => ({ p, ro: true }))];
  return (
    <div className="tl">
      <div className="week-nav">
        <h2>타임라인</h2>
        <span className="muted" style={{ fontSize: 12 }}>막대 = 지금 계획 · 점선 = 처음 계획(기준선) · 점 = 퀘스트 마감</span>
        <div style={{ flex: 1 }} />
        <div className="seg" role="radiogroup" aria-label="기간">
          {[3, 6, 12].map((m) => <button key={m} role="radio" aria-checked={months === m} onClick={() => setMonths(m)}>{m}개월</button>)}
        </div>
      </div>
      <div className="tl-scroll">
        <div className="tl-grid" style={{ minWidth: months * 160 + 240 }}>
          <div className="tl-name tl-headcell">이름</div>
          <div className="tl-track tl-headcell">
            {s.months.map((m) => <span key={m.date} className="tl-month" style={{ left: `${m.offset * 100}%` }}>{m.label}</span>)}
            <span className="tl-today-label mono" style={{ left: pct(today) }}>오늘 {md(today)}</span>
          </div>
          {rows.map(({ p, ro }) => {
            const isOpen = !collapsed[p.id];
            const owner = names.find((f) => f.id === p.ownerId)?.name;
            return (
              <Fragment key={p.id}>
                <div className="tl-name tl-proj" style={{ ['--pc' as string]: p.color }}>
                  <button className="icon-btn" style={{ width: 24, height: 24 }} aria-label={isOpen ? '접기' : '펼치기'} aria-expanded={isOpen} onClick={() => setCollapsed({ ...collapsed, [p.id]: isOpen })}>
                    <IconChevron style={{ transform: isOpen ? 'rotate(90deg)' : undefined }} />
                  </button>
                  <span className="pdot" />
                  <b className="ellipsis" style={{ flex: 1 }}>{p.title}</b>
                  {owner && <span className="muted" style={{ fontSize: 11 }}>{owner}</span>}
                  {!ro && <button className="icon-btn" style={{ width: 26, height: 26 }} aria-label={`${p.title}에 중간 목표 추가`} onClick={() => open({ kind: 'new-milestone', projectId: p.id })}><IconPlus /></button>}
                </div>
                <div className="tl-track">
                  <Gridlines s={s} today={today} />
                  <span className="tl-pbar" style={{ left: pct(p.start), width: width(p.start, p.target), ['--pc' as string]: p.color }} />
                  {p.baselineTarget !== p.target && <span className="tl-flag base" style={{ left: pct(p.baselineTarget) }} title={`처음 목표일 ${md(p.baselineTarget)}`} />}
                  <span className="tl-flag" style={{ left: pct(p.target), ['--pc' as string]: p.color }} title={`목표일 ${md(p.target)}`} />
                </div>
                {isOpen && p.milestones.map((m) => {
                  const dues = p.quests.filter((q) => q.milestoneId === m.id && q.due);
                  return (
                    <Fragment key={m.id}>
                      <button className="tl-name tl-ms" onClick={() => open({ kind: 'milestone', projectId: p.id, milestoneId: m.id })}>
                        <span className={`ms-dot ${m.status}`} style={{ ['--pc' as string]: p.color }} />
                        <span className="ellipsis" style={{ flex: 1 }}>{m.title}</span>
                        {m.pinned && <IconPin width={12} height={12} />}
                        <span className="mono muted" style={{ fontSize: 10 }}>{md(m.target)}</span>
                      </button>
                      <div className="tl-track">
                        <Gridlines s={s} today={today} />
                        {(m.baselineStart !== m.start || m.baselineTarget !== m.target) && (
                          <span className="tl-base" style={{ left: pct(m.baselineStart), width: width(m.baselineStart, m.baselineTarget) }} />
                        )}
                        <button className={`tl-bar ${m.status}`} style={{ left: pct(m.start), width: width(m.start, m.target), ['--pc' as string]: p.color }}
                          onClick={() => open({ kind: 'milestone', projectId: p.id, milestoneId: m.id })} aria-label={`${m.title} ${md(m.start)}–${md(m.target)}`}>
                          <span className="ellipsis">{m.title}</span>
                        </button>
                        {dues.map((q) => (
                          <button key={q.id} className={`tl-dot ${q.status}`} style={{ left: pct(q.due!), ['--pc' as string]: p.color }} title={`${q.title} · 마감 ${md(q.due)}`}
                            onClick={() => open({ kind: 'quest', projectId: p.id, questId: q.id })} aria-label={`${q.title} 마감 ${md(q.due)}`} />
                        ))}
                      </div>
                    </Fragment>
                  );
                })}
              </Fragment>
            );
          })}
        </div>
      </div>
      {rows.length === 0 && <span className="muted" style={{ fontSize: 13, padding: 20 }}>표시할 프로젝트가 없어요.</span>}
    </div>
  );
}

function Gridlines({ s, today }: { s: ReturnType<typeof timelineScale>; today: ISODate }) {
  return (
    <>
      {s.months.map((m) => <span key={m.date} className="tl-gl" style={{ left: `${m.offset * 100}%` }} />)}
      <span className="tl-now" style={{ left: `${s.x(today) * 100}%` }} />
    </>
  );
}

/* ───────── 표 ───────── */
type SortKey = 'due' | 'day' | 'project' | 'status';
export function Table({ refs, today, open }: ViewProps) {
  const [sort, setSort] = useState<SortKey>('due');
  const [hideDone, setHideDone] = useState(true);
  const rows = useMemo(() => {
    const list = refs.filter((r) => !hideDone || r.quest.status !== 'done');
    const k = (r: QuestRef) =>
      sort === 'due' ? r.quest.due ?? '9999' : sort === 'day' ? r.quest.scheduledStart ?? '9999' : sort === 'project' ? r.project.title : { doing: '0', todo: '1', done: '2' }[r.quest.status];
    return [...list].sort((a, b) => k(a).localeCompare(k(b)));
  }, [refs, sort, hideDone]);
  const upd = (r: QuestRef, patch: Partial<Quest>) => useApp.getState().updateQuest(r.project.id, r.quest.id, patch);
  return (
    <div className="ptable-wrap">
      <div className="week-nav">
        <h2>표</h2>
        <span className="muted mono" style={{ fontSize: 12 }}>{rows.length}개</span>
        <div style={{ flex: 1 }} />
        <label className="toggle" style={{ fontSize: 12 }}><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> <span>끝낸 일 숨기기</span></label>
        <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="muted">정렬</span>
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={{ width: 110, padding: '6px 8px' }}>
            <option value="due">마감순</option>
            <option value="day">하는 날순</option>
            <option value="project">프로젝트</option>
            <option value="status">상태</option>
          </select>
        </label>
        <button className="btn btn-primary btn-sm" onClick={() => open({ kind: 'new-quest' })}><IconPlus /> 퀘스트</button>
      </div>
      <div className="ptable-scroll">
        <table className="ptable">
          <thead>
            <tr>
              <th style={{ width: 36 }}><span className="sr">완료</span></th>
              <th>퀘스트</th>
              <th>프로젝트 · 중간 목표</th>
              <th style={{ width: 96 }}>상태</th>
              <th style={{ width: 150 }}>하는 날</th>
              <th style={{ width: 150 }}>마감</th>
              <th style={{ width: 80 }}>예상</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const q = r.quest;
              const ro = r.readonly || q.status === 'done' || !editable(r.project);
              const late = q.status !== 'done' && q.due && q.due < today;
              return (
                <tr key={q.id} className={q.status === 'done' ? 'done' : undefined} style={{ ['--pc' as string]: r.project.color }}>
                  <td>{!r.readonly && <input type="checkbox" checked={q.status === 'done'} aria-label={`${q.title} 완료`} onChange={() => useApp.getState().toggleQuest(r.project.id, q.id)} />}</td>
                  <td><button className="tlink" onClick={() => open({ kind: 'quest', projectId: r.project.id, questId: q.id })}>{q.title}{q.pinned && <IconPin width={12} height={12} style={{ marginLeft: 4 }} />}</button></td>
                  <td><span className="pdot" /> <span className="muted">{r.project.title} · {r.milestone?.title}</span></td>
                  <td>
                    {ro ? <span className="muted">{STATUS_LABEL[q.status]}</span> : (
                      <select className="input cell" value={q.status} onChange={(e) => upd(r, { status: e.target.value as Quest['status'] })} aria-label="상태">
                        <option value="todo">할 일</option>
                        <option value="doing">진행 중</option>
                      </select>
                    )}
                  </td>
                  <td>{ro ? <span className="mono muted">{q.scheduledStart ? `${md(q.scheduledStart)} ${dowLabel(q.scheduledStart)}` : '—'}</span> : <input className="input cell" type="date" value={q.scheduledStart ?? ''} onChange={(e) => upd(r, { scheduledStart: e.target.value || undefined })} aria-label="하는 날" />}</td>
                  <td>{ro ? <span className="mono muted">{q.due ? md(q.due) : '—'}</span> : <input className="input cell" type="date" value={q.due ?? ''} onChange={(e) => upd(r, { due: e.target.value || undefined })} aria-label="마감" style={{ color: late ? 'var(--coral)' : undefined }} />}</td>
                  <td>{ro ? <span className="mono muted">{q.estimatedMinutes}분</span> : <input className="input cell" type="number" min={1} max={600} value={q.estimatedMinutes} onChange={(e) => upd(r, { estimatedMinutes: Number(e.target.value) || 1 })} aria-label="예상 시간(분)" />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <span className="muted" style={{ fontSize: 13, padding: 16, display: 'block' }}>표시할 퀘스트가 없어요.</span>}
      </div>
    </div>
  );
}

/* ───────── 보드 ───────── */
export function Board({ refs, today, open }: ViewProps) {
  const cols: { key: Quest['status']; label: string }[] = [
    { key: 'todo', label: '할 일' },
    { key: 'doing', label: '진행 중' },
    { key: 'done', label: '끝' },
  ];
  const move = (projectId: string, questId: string, to: Quest['status']) => {
    const st = useApp.getState();
    const p = st.projects.find((x) => x.id === projectId);
    const q = p?.quests.find((x) => x.id === questId);
    if (!p || !q || q.status === to) return;
    if (to === 'done') st.toggleQuest(projectId, questId);
    else if (q.status === 'done') {
      st.toggleQuest(projectId, questId);
      if (to === 'doing') setTimeout(() => useApp.getState().updateQuest(projectId, questId, { status: 'doing' }), 0);
    } else st.updateQuest(projectId, questId, { status: to });
  };
  return (
    <div className="board">
      {cols.map((c) => <BoardCol key={c.key} label={c.label} status={c.key} refs={refs.filter((r) => r.quest.status === c.key)} today={today} open={open} onDrop={(pid, qid) => move(pid, qid, c.key)} />)}
    </div>
  );
}

function BoardCol({ label, status, refs, today, open, onDrop }: { label: string; status: Quest['status']; refs: QuestRef[]; today: ISODate; open: ViewProps['open']; onDrop: (pid: string, qid: string) => void }) {
  const drop = useDrop(onDrop);
  const shown = status === 'done' ? refs.slice(-30).reverse() : refs;
  return (
    <section className={`bcol${drop.over ? ' drop' : ''}`} {...drop.props} aria-label={label}>
      <header>
        <b>{label}</b>
        <span className="muted mono">{refs.length}</span>
        <div style={{ flex: 1 }} />
        {status === 'todo' && <button className="icon-btn" style={{ width: 28, height: 28 }} aria-label="퀘스트 추가" onClick={() => open({ kind: 'new-quest' })}><IconPlus /></button>}
      </header>
      <div className="bcol-list">
        {shown.map((r) => <QuestCard key={r.quest.id} r={r} today={today} showDate onOpen={() => open({ kind: 'quest', projectId: r.project.id, questId: r.quest.id })} />)}
        {refs.length === 0 && <span className="muted" style={{ fontSize: 12, padding: 6 }}>{status === 'done' ? '끝낸 퀘스트가 여기 모여요' : '비어 있어요'}</span>}
      </div>
    </section>
  );
}

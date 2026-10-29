'use client';

import { useMemo, useState } from 'react';
import { actualProgress, addDays, daysBetween, expectedProgress, health } from '@/lib/schedule';
import {
  backlog, dowLabel, md, minutesLabel, overdue, questsOn, suggestMove, upcoming, weekDays, weekLabel, weekStats, weekSummary,
  type PlanPrefs, type QuestRef,
} from '@/lib/plan';
import type { Health, ISODate, Project } from '@/lib/types';
import { useApp } from '@/store/useApp';
import Voyage from '../Voyage';
import { IconChevron, IconFlag, IconPlus, IconSpark } from '../icons';
import { QuestCard, useDrop, type Selection } from './shared';

export interface ViewProps {
  refs: QuestRef[];
  mine: Project[];
  friends: Project[];
  today: ISODate;
  prefs: PlanPrefs;
  open: (s: Selection) => void;
  anchor: ISODate;
  setAnchor: (d: ISODate) => void;
  goView: (v: string) => void;
}

const HEALTH: Record<Health, [string, string]> = { ok: ['순항', 'var(--mint)'], warn: ['주의', 'var(--amber)'], late: ['지연', 'var(--coral)'] };

const dday = (today: ISODate, d: ISODate) => {
  const n = daysBetween(today, d);
  return n === 0 ? 'D-day' : n > 0 ? `D-${n}` : `D+${-n}`;
};

/* ───────── 한눈에: 세부 일정 대시보드 ───────── */
export function Overview({ refs, mine, friends, today, prefs, open, goView, setAnchor }: ViewProps) {
  const week = weekDays(today);
  const sum = weekSummary(refs, week, prefs);
  const todays = questsOn(refs, today).filter((r) => !r.readonly);
  const late = overdue(refs, today);
  const soon = upcoming(mine, friends, today, 14);
  const stats = weekStats(refs, week, prefs);
  const friendName = useApp((s) => s.friends);
  const nameOf = (p: Project) => friendName.find((f) => f.id === p.ownerId)?.name;
  return (
    <div className="ov">
      <section className="ov-stats" aria-label="이번 주 요약">
        <button className="ov-stat" onClick={() => goView('week')}>
          <span className="muted">이번 주 남은 계획</span>
          <b className="mono">{minutesLabel(sum.planned)} <span className="muted" style={{ fontWeight: 400 }}>/ {minutesLabel(sum.capacity)}</span></b>
          <span className="cap"><span style={{ width: `${Math.min(100, (sum.planned / Math.max(1, sum.capacity)) * 100)}%`, background: sum.planned > sum.capacity ? 'var(--coral)' : 'var(--amber)' }} /></span>
        </button>
        <button className="ov-stat" onClick={() => goView('today')}>
          <span className="muted">오늘 할 일</span>
          <b className="mono">{todays.filter((r) => r.quest.status !== 'done').length}<span className="muted" style={{ fontWeight: 400 }}> 남음 · {todays.filter((r) => r.quest.status === 'done').length} 끝</span></b>
        </button>
        <button className="ov-stat" onClick={() => goView('table')}>
          <span className="muted">마감 지난 일</span>
          <b className="mono" style={{ color: late.length ? 'var(--coral)' : undefined }}>{late.length}</b>
        </button>
        <div className="ov-stat">
          <span className="muted">이번 주 끝낸 일</span>
          <b className="mono">{sum.doneCount}<span className="muted" style={{ fontWeight: 400 }}> · {minutesLabel(sum.doneMinutes)}</span></b>
        </div>
      </section>

      <section aria-label="요일별 부하" className="ov-week">
        {stats.map((s) => {
          const h = Math.min(1, s.planned / Math.max(1, s.capacity));
          return (
            <button
              key={s.date}
              className="ov-day"
              data-today={s.date === today || undefined}
              onClick={() => {
                setAnchor(s.date);
                goView('week');
              }}
              aria-label={`${md(s.date)} ${dowLabel(s.date)}요일 계획 ${s.planned}분 / ${s.capacity}분`}
            >
              <span className="bar"><span style={{ height: `${h * 100}%`, background: s.over ? 'var(--coral)' : 'var(--amber)' }} /></span>
              <span className="mono" style={{ fontSize: 11 }}>{dowLabel(s.date)}</span>
              <span className="mono muted" style={{ fontSize: 10 }}>{s.planned ? `${s.planned}분` : '—'}</span>
            </button>
          );
        })}
      </section>

      <section className="ov-projects" aria-label="프로젝트">
        {mine.map((p) => {
          const h = p.status === 'paused' ? null : health(p, today);
          const next = p.milestones.find((m) => m.status !== 'completed');
          const openQ = p.quests.filter((q) => q.status !== 'done').length;
          return (
            <article key={p.id} className="card ov-proj" style={{ ['--pc' as string]: p.color }}>
              <header>
                <span className="pdot" />
                <b className="ellipsis" style={{ flex: 1 }}>{p.title}</b>
                {p.status === 'demolishing' ? <span className="chip" style={{ color: 'var(--coral)', borderColor: 'currentColor' }}>철거 중</span> :
                  p.status === 'completed' ? <span className="chip" style={{ color: 'var(--mint)', borderColor: 'currentColor' }}>완공</span> :
                  h ? <span className="chip" style={{ color: HEALTH[h][1], borderColor: 'currentColor' }}>{HEALTH[h][0]}</span> : <span className="chip" style={{ color: 'var(--muted)', borderColor: 'currentColor' }}>쉬는 중</span>}
              </header>
              <Voyage progress={actualProgress(p)} expected={expectedProgress(p, today)} color={p.color} health={h ?? 'ok'} width={300} height={34} />
              {next ? (
                <button className="ov-next" onClick={() => open({ kind: 'milestone', projectId: p.id, milestoneId: next.id })}>
                  <IconFlag />
                  <span className="ellipsis" style={{ flex: 1 }}>{next.title}</span>
                  <span className="mono" style={{ color: next.target < today ? 'var(--coral)' : 'var(--muted)' }}>{md(next.target)} · {dday(today, next.target)}</span>
                </button>
              ) : <span className="muted" style={{ fontSize: 12 }}>모든 중간 목표를 끝냈어요</span>}
              <footer>
                <span className="muted">남은 퀘스트 {openQ}개 · 목표일 {md(p.target)}</span>
                {p.status !== 'completed' && p.status !== 'demolishing' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => open({ kind: 'new-quest', projectId: p.id })}><IconPlus /> 퀘스트</button>
                )}
              </footer>
            </article>
          );
        })}
        {friends.map((p) => (
          <article key={p.id} className="card ov-proj friend" style={{ ['--pc' as string]: p.color }}>
            <header>
              <span className="pdot" />
              <b className="ellipsis" style={{ flex: 1 }}>{p.title}</b>
              <span className="muted" style={{ fontSize: 11 }}>{nameOf(p)}님</span>
            </header>
            {p.milestones.length ? (
              <>
                <Voyage progress={actualProgress(p)} expected={expectedProgress(p, today)} color={p.color} health={health(p, today)} width={300} height={30} />
                {(() => {
                  const next = p.milestones.find((m) => m.status !== 'completed');
                  return next ? (
                    <button className="ov-next" onClick={() => open({ kind: 'milestone', projectId: p.id, milestoneId: next.id })}>
                      <IconFlag /><span className="ellipsis" style={{ flex: 1 }}>{next.title}</span><span className="mono muted">{md(next.target)}</span>
                    </button>
                  ) : null;
                })()}
              </>
            ) : <span className="muted" style={{ fontSize: 12 }}>겉모습만 공개한 프로젝트예요</span>}
          </article>
        ))}
        {mine.length === 0 && <span className="muted" style={{ fontSize: 13 }}>아직 프로젝트가 없어요. 마을의 빈 부지에서 착공해 보세요.</span>}
      </section>

      <div className="ov-cols">
        <section className="card ov-list" aria-label="오늘 할 일">
          <h3>오늘 할 일 <span className="muted mono">{md(today)} {dowLabel(today)}</span></h3>
          {todays.length === 0 && <span className="muted" style={{ fontSize: 13 }}>오늘로 정한 퀘스트가 없어요. 주간 보기에서 보관함의 일을 끌어다 놓아 보세요.</span>}
          {todays.map((r) => <QuestCard key={r.quest.id} r={r} today={today} onOpen={() => open({ kind: 'quest', projectId: r.project.id, questId: r.quest.id })} />)}
          {late.length > 0 && (
            <>
              <h4 style={{ color: 'var(--coral)' }}>마감 지난 일 {late.length}</h4>
              {late.slice(0, 5).map((r) => <QuestCard key={r.quest.id} r={r} today={today} onOpen={() => open({ kind: 'quest', projectId: r.project.id, questId: r.quest.id })} />)}
            </>
          )}
        </section>
        <section className="card ov-list" aria-label="다가오는 마감">
          <h3>다가오는 2주</h3>
          {soon.length === 0 && <span className="muted" style={{ fontSize: 13 }}>2주 안에 마감이 없어요.</span>}
          {soon.map((u, i) => (
            <button
              key={`${u.kind}-${u.title}-${i}`}
              className="ov-up"
              style={{ ['--pc' as string]: u.project.color }}
              onClick={() => {
                if (u.kind === 'quest' && u.questId) open({ kind: 'quest', projectId: u.project.id, questId: u.questId });
                else if (u.kind === 'milestone') {
                  const m = u.project.milestones.find((x) => x.title === u.title && x.target === u.date);
                  if (m) open({ kind: 'milestone', projectId: u.project.id, milestoneId: m.id });
                }
              }}
            >
              <span className="mono" style={{ width: 44 }}>{md(u.date)}</span>
              <span className="mono muted" style={{ width: 44, fontSize: 11 }}>{dday(today, u.date)}</span>
              <span className="pdot" />
              <span className="ellipsis" style={{ flex: 1 }}>
                {u.kind === 'milestone' ? '◆ ' : u.kind === 'project' ? '⚑ ' : ''}{u.title}
                {u.readonly && <span className="muted"> · {nameOf(u.project)}님</span>}
              </span>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}

/* ───────── 오늘 ───────── */
export function Today({ refs, today, open }: ViewProps) {
  const [day, setDay] = useState(today);
  const list = questsOn(refs, day).filter((r) => !r.readonly);
  const late = day === today ? overdue(refs, today).filter((r) => r.quest.scheduledStart !== day) : [];
  const box = backlog(refs).slice(0, 6);
  const total = list.filter((r) => r.quest.status !== 'done').reduce((s, r) => s + r.quest.estimatedMinutes, 0);
  const move = (projectId: string, questId: string, d: ISODate) => useApp.getState().updateQuest(projectId, questId, { scheduledStart: d });
  const drop = useDrop((pid, qid) => move(pid, qid, day));
  return (
    <div className="today">
      <div className="today-nav">
        <button className="icon-btn" aria-label="전날" onClick={() => setDay(addDays(day, -1))}><IconChevron style={{ transform: 'scaleX(-1)' }} /></button>
        <h2>{day === today ? '오늘' : md(day)} <span className="muted mono" style={{ fontSize: 14, fontWeight: 400 }}>{md(day)} {dowLabel(day)}요일</span></h2>
        <button className="icon-btn" aria-label="다음 날" onClick={() => setDay(addDays(day, 1))}><IconChevron /></button>
        {day !== today && <button className="btn btn-sm" onClick={() => setDay(today)}>오늘로</button>}
        <div style={{ flex: 1 }} />
        <span className="muted mono" style={{ fontSize: 12 }}>남은 일 {minutesLabel(total)}</span>
        <button className="btn btn-primary btn-sm" onClick={() => open({ kind: 'new-quest', date: day })}><IconPlus /> 퀘스트</button>
      </div>
      <section className={`today-list${drop.over ? ' drop' : ''}`} {...drop.props} aria-label="이날 할 일">
        {list.length === 0 && <span className="muted" style={{ fontSize: 13, padding: 8 }}>이날로 정한 퀘스트가 없어요. 아래 보관함에서 가져오거나 끌어다 놓아요.</span>}
        {list.map((r) => <QuestCard key={r.quest.id} r={r} today={today} onOpen={() => open({ kind: 'quest', projectId: r.project.id, questId: r.quest.id })} />)}
      </section>
      {late.length > 0 && (
        <section aria-label="마감 지난 일" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ color: 'var(--coral)' }}>마감 지난 일</h3>
          {late.map((r) => (
            <div key={r.quest.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}><QuestCard r={r} today={today} onOpen={() => open({ kind: 'quest', projectId: r.project.id, questId: r.quest.id })} /></div>
              <button className="btn btn-sm" onClick={() => move(r.project.id, r.quest.id, day)}>오늘 하기</button>
            </div>
          ))}
        </section>
      )}
      {box.length > 0 && (
        <section aria-label="보관함" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3>보관함 <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>하는 날이 정해지지 않은 일</span></h3>
          {box.map((r) => (
            <div key={r.quest.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}><QuestCard r={r} today={today} onOpen={() => open({ kind: 'quest', projectId: r.project.id, questId: r.quest.id })} /></div>
              <button className="btn btn-sm" onClick={() => move(r.project.id, r.quest.id, day)}>{day === today ? '오늘' : md(day)} 하기</button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

/* ───────── 주간 캘린더 + 보관함 ───────── */
export function Week({ refs, today, prefs, open, anchor, setAnchor }: ViewProps) {
  const days = weekDays(anchor);
  const stats = weekStats(refs, days, prefs);
  const sug = suggestMove(refs, days, today, prefs);
  const sum = weekSummary(refs, days, prefs);
  const [q, setQ] = useState('');
  const box = useMemo(() => backlog(refs).filter((r) => !q || r.quest.title.includes(q) || r.project.title.includes(q)), [refs, q]);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const move = (projectId: string, questId: string, d?: ISODate) => useApp.getState().updateQuest(projectId, questId, { scheduledStart: d });
  const boxDrop = useDrop((pid, qid) => move(pid, qid, undefined));
  const [prefsOpen, setPrefsOpen] = useState(false);
  const sugKey = sug ? `${sug.ref.quest.id}:${sug.to}` : null;

  return (
    <div className="week">
      <aside className={`backlog${boxDrop.over ? ' drop' : ''}`} {...boxDrop.props} aria-label="할 일 보관함">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, flex: 1 }}>할 일 보관함 <span className="muted mono" style={{ fontSize: 12 }}>{box.length}</span></h3>
          <button className="btn btn-ghost btn-sm" onClick={() => open({ kind: 'new-quest' })}><IconPlus /> 추가</button>
        </div>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="퀘스트 검색" aria-label="보관함 검색" style={{ padding: '8px 10px' }} />
        <span className="muted" style={{ fontSize: 11, lineHeight: 1.5 }}>하는 날이 없는 일이에요. 요일 칸으로 끌어다 놓으면 그날 일정이 돼요. 여기로 다시 끌어오면 날짜가 빠져요.</span>
        <div className="backlog-list">
          {box.map((r) => <QuestCard key={r.quest.id} r={r} today={today} onOpen={() => open({ kind: 'quest', projectId: r.project.id, questId: r.quest.id })} />)}
          {box.length === 0 && <span className="muted" style={{ fontSize: 12 }}>보관함이 비었어요.</span>}
        </div>
        <div className="backlog-foot">
          <button className="btn btn-sm" onClick={() => setPrefsOpen(!prefsOpen)} style={{ width: '100%' }}>하루 가용 시간 · 평일 {prefs.weekday}분 · 주말 {prefs.weekend}분</button>
          {prefsOpen && <PrefsEditor prefs={prefs} />}
        </div>
      </aside>

      <section className="week-main" aria-label={`${weekLabel(anchor)} 캘린더`}>
        <div className="week-nav">
          <button className="icon-btn" aria-label="지난주" onClick={() => setAnchor(addDays(anchor, -7))}><IconChevron style={{ transform: 'scaleX(-1)' }} /></button>
          <h2>{weekLabel(anchor)}</h2>
          <button className="icon-btn" aria-label="다음 주" onClick={() => setAnchor(addDays(anchor, 7))}><IconChevron /></button>
          <span className="mono muted" style={{ fontSize: 12 }}>{md(days[0])} – {md(days[6])}</span>
          {!days.includes(today) && <button className="btn btn-sm" onClick={() => setAnchor(today)}>이번 주</button>}
          <div style={{ flex: 1 }} />
          <span className="muted" style={{ fontSize: 12 }}>이번 주 계획</span>
          <span className="cap" style={{ width: 110 }}><span style={{ width: `${Math.min(100, (sum.planned / Math.max(1, sum.capacity)) * 100)}%`, background: sum.planned > sum.capacity ? 'var(--coral)' : 'var(--amber)' }} /></span>
          <span className="mono" style={{ fontSize: 12 }}>{minutesLabel(sum.planned)} / {minutesLabel(sum.capacity)}</span>
        </div>

        {sug && sugKey !== dismissed && (
          <div className="suggest" role="status">
            <IconSpark />
            <span style={{ flex: 1 }}>
              <b>{md(sug.from)} {dowLabel(sug.from)}요일</b> 계획이 가용 시간보다 <b>{minutesLabel(sug.over)}</b> 많아요. ‘{sug.ref.quest.title}’를 {dowLabel(sug.to)}요일로 옮길까요?
            </span>
            <button className="btn btn-primary btn-sm" onClick={() => move(sug.ref.project.id, sug.ref.quest.id, sug.to)}>{dowLabel(sug.to)}요일로 옮기기</button>
            <button className="btn btn-sm" onClick={() => setDismissed(sugKey)}>그대로 두기</button>
          </div>
        )}

        <div className="days">
          {days.map((d, i) => (
            <DayColumn key={d} date={d} stat={stats[i]} refs={questsOn(refs, d)} today={today} open={open} onDrop={(pid, qid) => move(pid, qid, d)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function DayColumn({ date, stat, refs, today, open, onDrop }: { date: ISODate; stat: ReturnType<typeof weekStats>[number]; refs: QuestRef[]; today: ISODate; open: ViewProps['open']; onDrop: (pid: string, qid: string) => void }) {
  const drop = useDrop(onDrop);
  const ratio = Math.min(1, stat.planned / Math.max(1, stat.capacity));
  const mine = refs.filter((r) => !r.readonly);
  const theirs = refs.filter((r) => r.readonly);
  return (
    <div className={`day${drop.over ? ' drop' : ''}${date === today ? ' is-today' : ''}${date < today ? ' past' : ''}`} {...drop.props} aria-label={`${md(date)} ${dowLabel(date)}요일`}>
      <header>
        <span className="dow">{dowLabel(date)}</span>
        <span className="date mono">{Number(date.slice(8))}</span>
        <div style={{ flex: 1 }} />
        <button className="icon-btn add" aria-label={`${md(date)}에 퀘스트 추가`} onClick={() => open({ kind: 'new-quest', date })}><IconPlus /></button>
      </header>
      <div className="load" title={`${stat.planned}분 / 가용 ${stat.capacity}분`}>
        <span style={{ width: `${ratio * 100}%`, background: stat.over ? 'var(--coral)' : 'var(--amber)' }} />
      </div>
      <span className="mono muted load-txt" style={{ color: stat.over ? 'var(--coral)' : undefined }}>{stat.planned ? `${stat.planned}/${stat.capacity}분` : `가용 ${stat.capacity}분`}</span>
      <div className="day-list">
        {mine.map((r) => <QuestCard key={r.quest.id} r={r} today={today} compact onOpen={() => open({ kind: 'quest', projectId: r.project.id, questId: r.quest.id })} />)}
        {theirs.map((r) => <QuestCard key={r.quest.id} r={r} today={today} compact onOpen={() => open({ kind: 'quest', projectId: r.project.id, questId: r.quest.id })} />)}
      </div>
    </div>
  );
}

function PrefsEditor({ prefs }: { prefs: PlanPrefs }) {
  const [wd, setWd] = useState(prefs.weekday);
  const [we, setWe] = useState(prefs.weekend);
  return (
    <form
      className="card"
      style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}
      onSubmit={(e) => {
        e.preventDefault();
        useApp.getState().savePrefs({ weekday: wd, weekend: we });
        useApp.getState().notify('하루 가용 시간을 바꿨어요');
      }}
    >
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <span style={{ width: 36 }}>평일</span>
        <input type="range" min={0} max={480} step={15} value={wd} onChange={(e) => setWd(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--amber)' }} />
        <span className="mono" style={{ width: 52, textAlign: 'right' }}>{minutesLabel(wd)}</span>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <span style={{ width: 36 }}>주말</span>
        <input type="range" min={0} max={600} step={15} value={we} onChange={(e) => setWe(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--amber)' }} />
        <span className="mono" style={{ width: 52, textAlign: 'right' }}>{minutesLabel(we)}</span>
      </label>
      <button className="btn btn-primary btn-sm">저장</button>
    </form>
  );
}

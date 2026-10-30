'use client';

import { usePathname, useRouter } from 'next/navigation';
import { enterFocus } from '../FocusOverlay';
import { useEffect, useState } from 'react';
import { addDays } from '@/lib/schedule';
import { md } from '@/lib/plan';
import { editable } from '@/lib/edit';
import { MESSAGE_MAX } from '@/lib/social';
import type { ISODate, Project, Quest, RescheduleScope } from '@/lib/types';
import { useApp } from '@/store/useApp';
import { IconClose, IconPin, IconPlay, IconTrash } from '../icons';
import { DateQuick, STATUS_LABEL, type Selection } from './shared';

/** 계획 화면 오른쪽(모바일은 아래) 편집 서랍. 마을 화면의 프로젝트 패널 안에서도 쓴다 */
export default function Drawer({ sel, onClose, embedded = false }: { sel: Exclude<Selection, null>; onClose: () => void; embedded?: boolean }) {
  const body =
    sel.kind === 'quest' ? <QuestDetail projectId={sel.projectId} questId={sel.questId} onClose={onClose} /> :
    sel.kind === 'milestone' ? <MilestoneDetail projectId={sel.projectId} milestoneId={sel.milestoneId} onClose={onClose} /> :
    sel.kind === 'new-quest' ? <NewQuest init={sel} onClose={onClose} /> :
    <NewMilestone projectId={sel.projectId} onClose={onClose} />;
  if (embedded) return body;
  return (
    <aside className="panel drawer" aria-label="편집">
      <div className="sheet-handle"><span /></div>
      {body}
    </aside>
  );
}

function useProject(projectId: string): { p?: Project; readonly: boolean } {
  const mine = useApp((s) => s.projects.find((x) => x.id === projectId));
  const friend = useApp((s) => s.townProjects.find((x) => x.id === projectId));
  return { p: mine ?? friend, readonly: !mine || !editable(mine) };
}

function Head({ crumb, color, title, onClose, children }: { crumb: string; color: string; title?: string; onClose: () => void; children?: React.ReactNode }) {
  return (
    <div className="panel-head">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span className="muted ellipsis" style={{ fontSize: 12, flex: 1 }}>{crumb}</span>
        <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label="닫기" onClick={onClose}><IconClose width={18} height={18} /></button>
      </div>
      {title && <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', lineHeight: 1.35 }}>{title}</h2>}
      {children}
    </div>
  );
}

/** 입력을 벗어나거나 Enter를 누르면 저장하는 글 입력 */
function TextField({ value, onSave, label, multiline = false, max = 80, placeholder, big = false, disabled = false }: { value: string; onSave: (v: string) => void; label?: string; multiline?: boolean; max?: number; placeholder?: string; big?: boolean; disabled?: boolean }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => {
    if (v !== value) onSave(v);
  };
  const common = {
    className: 'input',
    value: v,
    maxLength: max,
    placeholder,
    disabled,
    'aria-label': label,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV(e.target.value),
    onBlur: commit,
  };
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && !big && <span className="flabel">{label}</span>}
      {multiline ? (
        <textarea {...common} rows={3} />
      ) : (
        <input
          {...common}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          style={big ? { fontSize: 18, fontWeight: 700, padding: '10px 12px' } : undefined}
        />
      )}
    </label>
  );
}

function Minutes({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="flabel">예상 시간</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" type="number" min={1} max={600} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value) || 1)} aria-label="예상 시간(분)" style={{ width: 84, padding: '7px 10px' }} />
        <span className="muted" style={{ fontSize: 12 }}>분</span>
        {[15, 30, 45, 60, 90].map((n) => (
          <button type="button" key={n} disabled={disabled} className="btn btn-sm" aria-pressed={value === n} onClick={() => onChange(n)} style={{ height: 30 }}>{n}</button>
        ))}
      </div>
    </div>
  );
}

/** 두 번 눌러야 지워지는 버튼(실수 방지, 브라우저 확인창 없이) */
function DeleteButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button className="btn btn-sm" onClick={() => (armed ? onConfirm() : setArmed(true))} style={{ height: 40, color: armed ? '#1a0e0a' : 'var(--coral)', background: armed ? 'var(--coral)' : undefined, borderColor: 'rgba(232,119,90,0.5)' }} aria-label={armed ? `${label} — 한 번 더 누르면 지워져요` : label}>
      <IconTrash /> {armed ? '정말 지우기' : '지우기'}
    </button>
  );
}

/* ───────── 퀘스트 상세 ───────── */
function QuestDetail({ projectId, questId, onClose }: { projectId: string; questId: string; onClose: () => void }) {
  const { p, readonly } = useProject(projectId);
  const today = useApp((s) => s.today);
  const friendName = useApp((s) => s.friends.find((f) => f.id === p?.ownerId)?.name);
  const { updateQuest, deleteQuest, toggleQuest, postpone, sendMessage } = useApp.getState();
  const [scope, setScope] = useState<RescheduleScope>('only');
  const router = useRouter();
  const path = usePathname();
  const [cheer, setCheer] = useState('');
  const q = p?.quests.find((x) => x.id === questId);
  if (!p || !q) {
    return (
      <>
        <Head crumb="퀘스트" color="var(--border)" onClose={onClose} />
        <div className="panel-scroll"><span className="muted">이 퀘스트는 지워졌거나 볼 수 없어요.</span></div>
      </>
    );
  }
  const ms = p.milestones.find((m) => m.id === q.milestoneId);
  const save = (patch: Partial<Quest>) => updateQuest(projectId, questId, patch);
  const done = q.status === 'done';
  const msLocked = ms?.status === 'completed';
  const ro = readonly || done;

  return (
    <>
      <Head crumb={`${friendName ? `${friendName}님 · ` : ''}${p.title} / ${ms?.title ?? ''}`} color={p.color} onClose={onClose}>
        {readonly ? (
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, lineHeight: 1.35 }}>{q.title}</h2>
        ) : (
          <TextField big label="퀘스트 이름" value={q.title} onSave={(v) => save({ title: v })} disabled={done} />
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="chip" style={{ color: done ? 'var(--mint)' : q.status === 'doing' ? 'var(--amber)' : 'var(--muted)', borderColor: 'currentColor' }}>{STATUS_LABEL[q.status]}</span>
          {q.baselineDue && q.due && q.due > q.baselineDue && <span className="muted mono" style={{ fontSize: 11 }}>처음 마감 {md(q.baselineDue)} → {md(q.due)}</span>}
          {readonly && <span className="muted" style={{ fontSize: 11 }}>{friendName ? `${friendName}님의 일정이라 읽기만 할 수 있어요` : '지금은 편집할 수 없어요'}</span>}
        </div>
      </Head>

      <div className="panel-scroll">
        {!readonly && !done && (
          <div className="seg" role="radiogroup" aria-label="상태">
            {(['todo', 'doing'] as const).map((s) => (
              <button key={s} role="radio" aria-checked={q.status === s} onClick={() => save({ status: s })}>{STATUS_LABEL[s]}</button>
            ))}
          </div>
        )}

        {!readonly && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="flabel">중간 목표</span>
            <select className="input" value={q.milestoneId} disabled={done} onChange={(e) => save({ milestoneId: e.target.value })}>
              {p.milestones.map((m) => (
                <option key={m.id} value={m.id} disabled={m.status === 'completed' && m.id !== q.milestoneId}>
                  {m.title}{m.status === 'completed' ? ' (완료)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}

        {ro ? (
          <div className="kv">
            <span>하는 날</span><b className="mono">{q.scheduledStart ? md(q.scheduledStart) : '—'}</b>
            <span>마감</span><b className="mono">{q.due ? md(q.due) : '—'}</b>
            <span>예상</span><b className="mono">{q.estimatedMinutes}분</b>
          </div>
        ) : (
          <>
            <DateQuick label="하는 날 (캘린더에 놓이는 날)" value={q.scheduledStart} today={today} onChange={(d) => save({ scheduledStart: d })} />
            <DateQuick label="마감" value={q.due} today={today} onChange={(d) => save({ due: d })} />
            <Minutes value={q.estimatedMinutes} onChange={(n) => save({ estimatedMinutes: n })} />
            <label className="toggle">
              <input type="checkbox" checked={!!q.pinned} onChange={(e) => save({ pinned: e.target.checked })} />
              <span><IconPin width={13} height={13} /> 고정 — ‘뒤 일정까지 미루기’를 해도 이 퀘스트는 움직이지 않아요</span>
            </label>
          </>
        )}

        {ms?.criteria && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="flabel">이 중간 목표의 완료 기준</span>
            <div className="dod">{ms.criteria}</div>
          </div>
        )}

        {readonly ? (
          q.note && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="flabel">메모</span>
              <div className="dod" style={{ whiteSpace: 'pre-wrap' }}>{q.note}</div>
            </div>
          )
        ) : (
          <TextField multiline max={1000} label="메모" value={q.note ?? ''} placeholder="떠오른 것, 링크, 막힌 점" onSave={(v) => save({ note: v })} />
        )}

        {!ro && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="flabel">미루기</span>
            <div className="seg" role="radiogroup" aria-label="미루는 범위">
              <button role="radio" aria-checked={scope === 'only'} onClick={() => setScope('only')}>이 퀘스트만</button>
              <button role="radio" aria-checked={scope === 'cascade'} onClick={() => setScope('cascade')}>뒤 일정까지 같이</button>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 3, 7].map((d) => (
                <button key={d} className="btn btn-sm" onClick={() => postpone(projectId, d, scope, questId)}>{d === 7 ? '1주' : `${d}일`} 미루기</button>
              ))}
            </div>
            <span className="muted" style={{ fontSize: 11, lineHeight: 1.5 }}>
              {scope === 'cascade' ? '같은 중간 목표의 뒤 퀘스트, 뒤 중간 목표, 프로젝트 목표일이 함께 밀려요. 고정한 일정은 그대로예요.' : '이 퀘스트의 하는 날·마감만 옮겨요.'} 누적 지연이 30일을 넘으면 건물이 잠시 낡아요.
            </span>
          </div>
        )}
      </div>

      <div className="panel-foot" style={{ flexWrap: 'wrap' }}>
        {readonly ? (
          p.ownerId && friendName ? (
            <form
              style={{ display: 'flex', gap: 8, width: '100%' }}
              onSubmit={(e) => {
                e.preventDefault();
                if (sendMessage(p.ownerId!, cheer.trim() ? cheer : `‘${q.title}’ 응원해요!`, p.id)) setCheer('');
              }}
            >
              <input className="input" value={cheer} maxLength={MESSAGE_MAX} onChange={(e) => setCheer(e.target.value)} placeholder={`‘${q.title}’ 응원해요!`} aria-label="응원 쪽지" />
              <button className="btn btn-primary btn-sm" style={{ height: 40 }}>응원</button>
            </form>
          ) : null
        ) : (
          <>
            <button className="btn btn-primary" style={{ flex: 1, opacity: msLocked && done ? 0.5 : 1 }} disabled={msLocked && done} onClick={() => toggleQuest(projectId, questId)}>
              {done ? '완료 취소 · −10XP' : '완료하기 · +10XP'}
            </button>
            {!done && (
              <button
                className="btn"
                aria-label="이 퀘스트로 집중 모드 시작"
                onClick={() => {
                  enterFocus({ projectId, questId });
                  if (path !== '/') router.push('/');
                }}
              >
                <IconPlay /> 집중
              </button>
            )}
            {!done && (
              <DeleteButton
                label="퀘스트 지우기"
                onConfirm={() => {
                  if (deleteQuest(projectId, questId)) onClose();
                }}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ───────── 중간 목표 상세 ───────── */
function MilestoneDetail({ projectId, milestoneId, onClose }: { projectId: string; milestoneId: string; onClose: () => void }) {
  const { p, readonly } = useProject(projectId);
  const today = useApp((s) => s.today);
  const { updateMilestone, deleteMilestone, completeMilestone, toggleQuest } = useApp.getState();
  const [evidence, setEvidence] = useState('');
  const [adding, setAdding] = useState(false);
  const m = p?.milestones.find((x) => x.id === milestoneId);
  if (!p || !m) {
    return (
      <>
        <Head crumb="중간 목표" color="var(--border)" onClose={onClose} />
        <div className="panel-scroll"><span className="muted">이 중간 목표는 지워졌거나 볼 수 없어요.</span></div>
      </>
    );
  }
  const idx = p.milestones.indexOf(m);
  const quests = p.quests.filter((q) => q.milestoneId === m.id);
  const open = quests.filter((q) => q.status !== 'done');
  const done = m.status === 'completed';
  const ro = readonly || done;
  const save = (patch: Parameters<typeof updateMilestone>[2]) => updateMilestone(projectId, milestoneId, patch);
  const moved = m.target !== m.baselineTarget || m.start !== m.baselineStart;

  return (
    <>
      <Head crumb={`${p.title} / 중간 목표 ${String(idx + 1).padStart(2, '0')}`} color={p.color} onClose={onClose}>
        {ro ? <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{m.title}</h2> : <TextField big label="중간 목표 이름" value={m.title} onSave={(v) => save({ title: v })} />}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="chip" style={{ color: done ? 'var(--mint)' : m.status === 'active' ? 'var(--amber)' : 'var(--muted)', borderColor: 'currentColor' }}>{done ? '완료' : m.status === 'active' ? '진행 중' : '예정'}</span>
          <span className="muted mono" style={{ fontSize: 11 }}>{md(m.start)} – {md(m.target)}{moved ? ` · 처음 계획 ${md(m.baselineStart)} – ${md(m.baselineTarget)}` : ''}</span>
        </div>
      </Head>
      <div className="panel-scroll">
        {ro ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="flabel">완료 기준</span>
              <div className="dod">{m.criteria || '—'}</div>
            </div>
            {m.evidence && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="flabel">성과 기록</span>
                <div className="dod">{m.evidence}</div>
              </div>
            )}
          </>
        ) : (
          <>
            <TextField multiline max={200} label="완료 기준 (확인할 수 있는 결과물로)" value={m.criteria} onSave={(v) => save({ criteria: v })} placeholder="예: 기출 3회분 70점 이상" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="flabel">시작</span>
                <input className="input" type="date" value={m.start} onChange={(e) => e.target.value && save({ start: e.target.value })} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="flabel">목표일</span>
                <input className="input" type="date" value={m.target} min={m.start} onChange={(e) => e.target.value && save({ target: e.target.value })} />
              </label>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="flabel">작업량 (진척도 가중치)</span>
              <div className="seg" role="radiogroup" aria-label="작업량">
                {[1, 2, 3, 4, 5].map((w) => (
                  <button key={w} role="radio" aria-checked={m.weight === w} onClick={() => save({ weight: w })}>{w}</button>
                ))}
              </div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={!!m.pinned} onChange={(e) => save({ pinned: e.target.checked })} />
              <span><IconPin width={13} height={13} /> 고정 — 뒤 일정을 미뤄도 이 목표일은 그대로</span>
            </label>
          </>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="flabel" style={{ flex: 1 }}>퀘스트 {quests.length - open.length}/{quests.length}</span>
            {!ro && <button className="btn btn-ghost btn-sm" onClick={() => setAdding(!adding)}>{adding ? '닫기' : '+ 퀘스트'}</button>}
          </div>
          {adding && !ro && <QuestQuickAdd projectId={projectId} milestoneId={m.id} today={today} onDone={() => undefined} />}
          {quests.length === 0 && <span className="muted" style={{ fontSize: 13 }}>아직 퀘스트가 없어요.</span>}
          {quests.map((q) => (
            <label key={q.id} className={`quest ${q.status}`} style={{ padding: '9px 10px' }}>
              {!readonly && <input type="checkbox" checked={q.status === 'done'} disabled={done} onChange={() => toggleQuest(projectId, q.id)} />}
              <span style={{ flex: 1 }}>
                <span className="title" style={{ fontSize: 13 }}>{q.title}</span>
                <span className="meta"><span className="mono">{q.estimatedMinutes}분</span>{q.due && <span className="mono">마감 {md(q.due)}</span>}</span>
              </span>
            </label>
          ))}
        </div>

        {!readonly && !done && open.length === 0 && quests.length > 0 && (
          <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>‘{m.title}’를 완료할 수 있어요</span>
            <textarea className="input" rows={2} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="결과물 메모나 링크" aria-label="성과 기록" />
            <button className="btn btn-primary btn-sm" disabled={!evidence.trim()} style={{ opacity: evidence.trim() ? 1 : 0.5 }} onClick={() => completeMilestone(projectId, m.id, evidence.trim())}>중간 목표 완료 · +50XP</button>
          </div>
        )}
      </div>
      {!ro && (
        <div className="panel-foot">
          <DeleteButton
            label="중간 목표 지우기"
            onConfirm={() => {
              if (deleteMilestone(projectId, milestoneId)) onClose();
            }}
          />
          <span className="muted" style={{ fontSize: 11, lineHeight: 1.5, alignSelf: 'center' }}>안의 남은 퀘스트도 함께 지워져요. 완료한 일이 있으면 지울 수 없어요.</span>
        </div>
      )}
    </>
  );
}

/** 한 줄 빠른 추가 */
export function QuestQuickAdd({ projectId, milestoneId, today, onDone, date }: { projectId: string; milestoneId: string; today: ISODate; onDone: () => void; date?: ISODate }) {
  const [title, setTitle] = useState('');
  const [min, setMin] = useState(30);
  const [day, setDay] = useState<ISODate | undefined>(date);
  return (
    <form
      className="card"
      style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        if (useApp.getState().addQuest(projectId, milestoneId, { title, estimatedMinutes: min, scheduledStart: day })) {
          setTitle('');
          onDone();
        }
      }}
    >
      <input className="input" autoFocus value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="20~60분 안에 끝낼 수 있는 일" aria-label="새 퀘스트 이름" />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="input" value={min} onChange={(e) => setMin(Number(e.target.value))} aria-label="예상 시간" style={{ width: 90, padding: '6px 8px' }}>
          {[15, 20, 30, 45, 60, 90, 120].map((n) => <option key={n} value={n}>{n}분</option>)}
        </select>
        <input className="input" type="date" value={day ?? ''} onChange={(e) => setDay(e.target.value || undefined)} aria-label="하는 날" style={{ width: 150, padding: '6px 8px' }} />
        <button type="button" className="btn btn-sm" onClick={() => setDay(today)} style={{ height: 30 }}>오늘</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary btn-sm" disabled={!title.trim()} style={{ opacity: title.trim() ? 1 : 0.5 }}>추가</button>
      </div>
    </form>
  );
}

/* ───────── 새 퀘스트 ───────── */
function NewQuest({ init, onClose }: { init: Extract<Selection, { kind: 'new-quest' }>; onClose: () => void }) {
  const allMine = useApp((s) => s.projects);
  const projects = allMine.filter(editable);
  const today = useApp((s) => s.today);
  const [pid, setPid] = useState(init.projectId ?? projects[0]?.id ?? '');
  const p = projects.find((x) => x.id === pid);
  const openMs = p?.milestones.filter((m) => m.status !== 'completed') ?? [];
  const [mid, setMid] = useState(init.milestoneId ?? openMs.find((m) => m.status === 'active')?.id ?? openMs[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [min, setMin] = useState(30);
  const [day, setDay] = useState<ISODate | undefined>(init.date);
  const [due, setDue] = useState<ISODate | undefined>();
  const [note, setNote] = useState('');
  const [keep, setKeep] = useState(false);
  useEffect(() => {
    if (!openMs.some((m) => m.id === mid)) setMid(openMs.find((m) => m.status === 'active')?.id ?? openMs[0]?.id ?? '');
  }, [pid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!projects.length) {
    return (
      <>
        <Head crumb="새 퀘스트" color="var(--amber)" title="먼저 프로젝트를 만들어요" onClose={onClose} />
        <div className="panel-scroll"><span className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>마을의 빈 부지를 누르거나 ‘+ 새 프로젝트’로 착공하면 퀘스트를 더할 수 있어요.</span></div>
      </>
    );
  }
  const ok = !!title.trim() && !!mid;
  return (
    <>
      <Head crumb="새 퀘스트" color={p?.color ?? 'var(--amber)'} title="퀘스트 추가" onClose={onClose} />
      <form
        className="panel-scroll"
        id="new-quest-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ok) return;
          if (useApp.getState().addQuest(pid, mid, { title, estimatedMinutes: min, scheduledStart: day, due, note })) {
            if (keep) {
              setTitle('');
              setNote('');
            } else onClose();
          }
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="flabel">무엇을 할까요?</span>
          <input className="input" autoFocus value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="예: 로그인 화면 와이어프레임 3장" />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="flabel">프로젝트</span>
            <select className="input" value={pid} onChange={(e) => setPid(e.target.value)}>
              {projects.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="flabel">중간 목표</span>
            <select className="input" value={mid} onChange={(e) => setMid(e.target.value)}>
              {openMs.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </label>
        </div>
        <Minutes value={min} onChange={setMin} />
        <DateQuick label="하는 날" value={day} today={today} onChange={setDay} />
        <DateQuick label="마감 (선택)" value={due} today={today} onChange={setDue} />
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="flabel">메모 (선택)</span>
          <textarea className="input" rows={2} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
          <span>추가한 뒤 계속 적기</span>
        </label>
      </form>
      <div className="panel-foot">
        <button form="new-quest-form" className="btn btn-primary" style={{ flex: 1, opacity: ok ? 1 : 0.5 }} disabled={!ok}>퀘스트 추가</button>
      </div>
    </>
  );
}

/* ───────── 새 중간 목표 ───────── */
function NewMilestone({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { p } = useProject(projectId);
  const last = p?.milestones.at(-1);
  const startDefault = last ? addDays(last.target, 1) : useApp.getState().today;
  const [title, setTitle] = useState('');
  const [criteria, setCriteria] = useState('');
  const [weight, setWeight] = useState(1);
  const [start, setStart] = useState(startDefault);
  const [target, setTarget] = useState(addDays(startDefault, 20));
  if (!p) return null;
  const ok = !!title.trim() && target >= start;
  return (
    <>
      <Head crumb={p.title} color={p.color} title="중간 목표 추가" onClose={onClose} />
      <form
        className="panel-scroll"
        id="new-ms-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok && useApp.getState().addMilestone(projectId, { title, criteria, weight, start, target })) onClose();
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="flabel">중간 목표 (건물이 자라는 지점)</span>
          <input className="input" autoFocus value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="예: 베타 테스터 5명 피드백" />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="flabel">완료 기준</span>
          <textarea className="input" rows={2} value={criteria} maxLength={200} onChange={(e) => setCriteria(e.target.value)} placeholder="결과물로 확인할 수 있게" />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="flabel">시작</span>
            <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="flabel">목표일</span>
            <input className="input" type="date" value={target} min={start} onChange={(e) => setTarget(e.target.value)} />
          </label>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="flabel">작업량</span>
          <div className="seg" role="radiogroup" aria-label="작업량">
            {[1, 2, 3, 4, 5].map((w) => <button type="button" key={w} role="radio" aria-checked={weight === w} onClick={() => setWeight(w)}>{w}</button>)}
          </div>
        </div>
        {target > p.target && <span className="notice warn" style={{ fontSize: 12 }}>프로젝트 목표일({md(p.target)})보다 늦어서 목표일이 {md(target)}로 늘어나요. 처음 계획보다 늦어진 만큼 지연으로 보여요.</span>}
      </form>
      <div className="panel-foot">
        <button form="new-ms-form" className="btn btn-primary" style={{ flex: 1, opacity: ok ? 1 : 0.5 }} disabled={!ok}>중간 목표 추가</button>
      </div>
    </>
  );
}

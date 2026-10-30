'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  actualProgress,
  buildingStage,
  cumulativeDelayDays,
  DECAY_THRESHOLD_DAYS,
  expectedProgress,
  health,
} from '@/lib/schedule';
import { demolishRemaining, editable } from '@/lib/edit';
import type { Health, Project, Visibility } from '@/lib/types';
import { useApp } from '@/store/useApp';
import { friendName, relTime } from '@/lib/social';
import { STAGE_NAMES } from '@/lib/templates';
import { IconCalendar, IconClose, IconCopy, IconEdit, IconFlag, IconPlay, IconPlus, IconTrophy } from './icons';
import Drawer, { QuestQuickAdd } from './plan/Drawer';
import type { Selection } from './plan/shared';
import Voyage from './Voyage';
import { enterFocus } from './FocusOverlay';

const md = (d?: string) => (d ? d.slice(5).replace('-', '.') : '');
const HEALTH: Record<Health, [string, string]> = { ok: ['순항', '#6CC3A0'], warn: ['주의', '#F4B03E'], late: ['지연', '#E8775A'] };
const KIND: Record<Project['building'], string> = { workshop: '개발 공방 · 메이커', bookstore: '서점 · 작가', lab: '연구소 · 학자' };
const COLORS = ['#F4B03E', '#E8775A', '#7FB2E5', '#6CC3A0', '#C9A0F0', '#E58FB7', '#D9CFB2'];
export const VIS: { key: Visibility; label: string; desc: string }[] = [
  { key: 'town', label: '세부 일정까지', desc: '친구가 중간 목표·퀘스트·마감을 볼 수 있어요(편집은 나만)' },
  { key: 'exterior', label: '겉모습만', desc: '이름·건물·단계만 보여요' },
  { key: 'private', label: '비공개', desc: '친구 마을 화면에서 건물이 보이지 않아요' },
];

export default function ProjectPanel({ project }: { project: Project | null }) {
  const select = useApp((s) => s.select);
  if (!project) {
    return (
      <aside className="panel closed" aria-label="프로젝트 패널">
        <div className="empty-panel">
          <IconFlag width={28} height={28} />
          <span>
            마을의 건물을 누르면
            <br />
            프로젝트가 여기에 열려요
          </span>
        </div>
      </aside>
    );
  }
  return <PanelBody key={project.id} project={project} onClose={() => select(null)} />;
}

/** 두 번 눌러야 실행(실수 방지) */
function ConfirmButton({ label, armedLabel, onConfirm, tone = 'warn', style }: { label: React.ReactNode; armedLabel: string; onConfirm: () => void; tone?: 'warn' | 'good'; style?: React.CSSProperties }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  const c = tone === 'warn' ? 'var(--coral)' : 'var(--mint)';
  return (
    <button className="btn btn-sm" onClick={() => (armed ? onConfirm() : setArmed(true))} style={{ color: armed ? '#120c08' : c, background: armed ? c : undefined, borderColor: c, ...style }}>
      {armed ? armedLabel : label}
    </button>
  );
}

function useNow(ms = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function PanelBody({ project: p, onClose }: { project: Project; onClose: () => void }) {
  const today = useApp((s) => s.today);
  const meId = useApp((s) => s.meId);
  const friends = useApp((s) => s.friends);
  const messages = useApp((s) => s.messages);
  const cheers = messages.filter((m) => m.projectId === p.id && m.from !== meId);
  const { toggleQuest, startWork, completeMilestone, postpone, togglePause, cancelDemolition, moveToHall } = useApp.getState();
  const [tab, setTab] = useState<'todo' | 'plan' | 'settings'>('todo');
  const [evidence, setEvidence] = useState('');
  const [sub, setSub] = useState<Selection>(null);
  const [adding, setAdding] = useState(false);
  const now = useNow();

  if (sub) {
    return (
      <aside className="panel" aria-label="편집">
        <div className="sheet-handle"><span /></div>
        <Drawer embedded key={JSON.stringify(sub)} sel={sub} onClose={() => setSub(null)} />
      </aside>
    );
  }

  const canEdit = editable(p);
  const actual = actualProgress(p);
  const expected = expectedProgress(p, today);
  const h = health(p, today);
  const delay = cumulativeDelayDays(p, today);
  const stage = buildingStage(p);
  const active = p.milestones.find((m) => m.status !== 'completed');
  const activeIdx = active ? p.milestones.indexOf(active) : p.milestones.length;
  const msQuests = active ? p.quests.filter((q) => q.milestoneId === active.id) : [];
  const open = msQuests.filter((q) => q.status !== 'done');
  const done = msQuests.filter((q) => q.status === 'done');
  const canCompleteMs = canEdit && !!active && msQuests.length > 0 && open.length === 0;
  const nextStageImg = `/assets/town/${p.building}-s${Math.min(3, stage + 1)}.png`;
  const smallest = [...p.quests].filter((q) => q.status !== 'done').sort((a, b) => a.estimatedMinutes - b.estimatedMinutes)[0];
  const focusQuest = p.quests.find((q) => q.status === 'doing') ?? open[0];
  const left = demolishRemaining(p, now);
  const [hLabel, hColor] =
    p.status === 'demolishing' ? ['철거 중', '#E8775A'] : p.status === 'completed' ? ['완공', '#6CC3A0'] : p.status === 'paused' ? ['항해 쉬기', '#98A0B3'] : HEALTH[h];

  return (
    <aside className="panel" aria-label={`${p.title} 프로젝트 패널`}>
      <div className="sheet-handle"><span /></div>
      <div className="panel-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="chip" style={{ color: hColor, borderColor: hColor }}>{hLabel}</span>
          <span className="muted" style={{ fontSize: 12 }}>{KIND[p.building]} · {stage}단계 {STAGE_NAMES[stage]}</span>
          <div style={{ flex: 1 }} />
          <Link href={`/plan?project=${encodeURIComponent(p.id)}&view=timeline`} className="icon-btn" style={{ width: 36, height: 36 }} aria-label="계획 화면에서 열기" title="계획 화면에서 열기"><IconCalendar width={18} height={18} /></Link>
          <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label="패널 닫기" onClick={onClose}><IconClose width={18} height={18} /></button>
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px', lineHeight: 1.3 }}>{p.title}</h1>
        <div className="dod"><span style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 2 }}><IconFlag /></span><span>완료 조건 · {p.definitionOfDone}</span></div>
      </div>

      <div className="panel-scroll">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Voyage progress={actual} expected={expected} color={p.color} health={p.status === 'paused' ? 'ok' : h} width={344} height={46} />
          <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
            <span>출항 {md(p.start)}</span>
            <span style={{ color: actual >= expected ? 'var(--mint)' : 'var(--coral)' }}>{actual}% · 계획 {expected}%</span>
            <span>도착 {md(p.target)}</span>
          </div>
        </div>

        {p.status === 'demolishing' && (
          <div className="notice warn" role="status">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span>철거 중이에요 · <b>{left !== null ? Math.ceil(left / 60000) : 0}분</b> 뒤에 부지가 비어요. 그동안은 퀘스트를 할 수 없어요. 경험치와 성과 기록은 남아요.</span>
              <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => cancelDemolition(p.id)}>철거 취소하고 다시 짓기</button>
            </div>
          </div>
        )}

        {p.status === 'completed' && (
          <div className="notice good" role="status">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span>완공했어요! 랜드마크를 명예의 전당에 올리면 기록이 전시되고, 이 부지는 다음 프로젝트를 위해 비워져요.</span>
              <ConfirmButton tone="good" label={<><IconTrophy width={16} height={16} /> 명예의 전당에 올리기</>} armedLabel="한 번 더 누르면 올려요" onConfirm={() => moveToHall(p.id)} style={{ alignSelf: 'flex-start', height: 36 }} />
            </div>
          </div>
        )}

        {p.condition === 'decayed' && canEdit && (
          <div className="notice warn" role="status">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span>처음 목표보다 <b>{delay}일</b> 늦어져 건물에 먼지가 쌓였어요. 경험치와 기록은 그대로예요.</span>
              {smallest && (
                <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => startWork(p.id, smallest.id)}>
                  {smallest.estimatedMinutes}분짜리 퀘스트로 불 켜기
                </button>
              )}
            </div>
          </div>
        )}
        {p.condition === 'repairing' && canEdit && (
          <div className="notice good" role="status">수리 중이에요. 퀘스트 하나를 끝내면 불이 다시 켜지고, 지금 계획이 새 기준선이 돼요.</div>
        )}

        {active && (
          <button className="card next-ms" onClick={() => setSub({ kind: 'milestone', projectId: p.id, milestoneId: active.id })} style={{ textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
            <img src={nextStageImg} alt="다음 성장 단계 미리보기" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
              <span className="muted" style={{ fontSize: 12 }}>다음 중간 목표 · {activeIdx + 1}/{p.milestones.length} · {md(active.target)}까지</span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{active.title}</span>
              <span style={{ fontSize: 12, color: 'var(--amber)' }}>{active.criteria || '완료 기준을 적어 주세요'}</span>
            </div>
            {canEdit && <IconEdit />}
          </button>
        )}

        <div role="tablist" aria-label="프로젝트 보기" className="tabs">
          <button role="tab" aria-selected={tab === 'todo'} onClick={() => setTab('todo')}>할 일</button>
          <button role="tab" aria-selected={tab === 'plan'} onClick={() => setTab('plan')}>일정</button>
          <button role="tab" aria-selected={tab === 'settings'} onClick={() => setTab('settings')}>설정</button>
        </div>

        {tab === 'todo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...open, ...done].map((q) => (
              <div key={q.id} className={`quest ${q.status}`} style={{ alignItems: 'center' }}>
                <input type="checkbox" checked={q.status === 'done'} disabled={!canEdit} aria-label={`${q.title} 완료`} onChange={() => toggleQuest(p.id, q.id)} />
                <button className="quest-body" onClick={() => setSub({ kind: 'quest', projectId: p.id, questId: q.id })} aria-label={`${q.title} 편집`}>
                  <span className="title" style={{ fontSize: 14, fontWeight: q.status === 'doing' ? 600 : 500 }}>{q.title}</span>
                  <span className="meta">
                    {q.status === 'doing' && <span style={{ color: 'var(--amber)', fontWeight: 600 }}>진행 중</span>}
                    <span>약 {q.estimatedMinutes}분</span>
                    {q.scheduledStart && <span className="mono">{md(q.scheduledStart)} 하기</span>}
                    {q.due && <span className="mono" style={{ color: q.status !== 'done' && q.due < today ? 'var(--coral)' : undefined }}>마감 {md(q.due)}</span>}
                    <span className="mono">+10XP</span>
                  </span>
                </button>
                {canEdit && <IconEdit style={{ color: 'var(--muted)', flexShrink: 0 }} />}
              </div>
            ))}
            {msQuests.length === 0 && <span className="muted" style={{ fontSize: 13 }}>이 중간 목표에 아직 퀘스트가 없어요.</span>}
            {canEdit && active && (adding ? (
              <QuestQuickAdd projectId={p.id} milestoneId={active.id} today={today} onDone={() => setAdding(false)} />
            ) : (
              <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setAdding(true)}><IconPlus /> 퀘스트 추가</button>
            ))}
            {cheers.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>친구 응원</span>
                {cheers.map((m) => (
                  <button key={m.id} className="card" onClick={() => useApp.getState().openView({ kind: 'inbox', friendId: m.from })} style={{ textAlign: 'left', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 12 }}><b>{friendName(m.from, friends, meId)}</b> <span className="muted">· {relTime(m.at)} · 답장하기</span></span>
                    <span style={{ fontSize: 13, lineHeight: 1.5 }}>{m.text}</span>
                  </button>
                ))}
              </div>
            )}
            {canCompleteMs && active && (
              <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>‘{active.title}’를 완료할 수 있어요</span>
                <span className="muted" style={{ fontSize: 12 }}>완료 기준: {active.criteria}. 결과물 메모나 링크를 하나 남겨 주세요.</span>
                <textarea className="input" rows={2} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="예: 가입→계획→완료 흐름 녹화 링크" aria-label="성과 기록" />
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!evidence.trim()}
                  style={{ opacity: evidence.trim() ? 1 : 0.5 }}
                  onClick={() => {
                    completeMilestone(p.id, active.id, evidence.trim());
                    setEvidence('');
                  }}
                >
                  중간 목표 완료 · +50 XP
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'plan' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card" style={{ padding: '4px 0' }}>
              {p.milestones.map((m, i) => {
                const moved = m.target !== m.baselineTarget;
                const nq = p.quests.filter((q) => q.milestoneId === m.id);
                return (
                  <button key={m.id} className="ms-row" onClick={() => setSub({ kind: 'milestone', projectId: p.id, milestoneId: m.id })} style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}>
                    <span className="mono" style={{ width: 22, height: 22, borderRadius: 4, fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: m.status === 'completed' ? p.color : 'transparent', color: m.status === 'completed' ? '#0E111B' : 'var(--text)', border: m.status === 'completed' ? 'none' : `1px solid ${m.status === 'active' ? 'var(--amber)' : 'var(--border)'}`, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{ flex: 1, fontSize: 13, color: m.status === 'completed' ? 'var(--muted)' : 'var(--text)', textAlign: 'left' }}>
                      {m.title}
                      <span className="muted mono" style={{ fontSize: 10, display: 'block' }}>퀘스트 {nq.filter((q) => q.status === 'done').length}/{nq.length}</span>
                    </span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {moved && <span style={{ textDecoration: 'line-through', marginRight: 6 }}>{md(m.baselineTarget)}</span>}
                      <span style={{ color: moved ? 'var(--amber)' : undefined }}>{md(m.target)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {canEdit && <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setSub({ kind: 'new-milestone', projectId: p.id })}><IconPlus /> 중간 목표 추가</button>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span>누적 지연</span>
                <span className="mono" style={{ color: delay >= DECAY_THRESHOLD_DAYS ? 'var(--coral)' : 'var(--muted)' }}>{delay}일 / {DECAY_THRESHOLD_DAYS}일</span>
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (delay / DECAY_THRESHOLD_DAYS) * 100)}%`, height: '100%', background: delay >= DECAY_THRESHOLD_DAYS ? 'var(--coral)' : 'var(--amber)' }} />
              </div>
            </div>
            {canEdit && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button className="btn btn-sm" onClick={() => postpone(p.id, 7, 'cascade')}>뒤 일정까지 1주 미루기</button>
                <button className="btn btn-sm" onClick={() => postpone(p.id, 7, 'only')}>다음 퀘스트만 1주</button>
                <button className="btn btn-sm" onClick={() => togglePause(p.id)}>{p.status === 'paused' ? '항해 다시 시작' : '항해 쉬기'}</button>
              </div>
            )}
            <Link href={`/plan?project=${encodeURIComponent(p.id)}&view=timeline`} className="btn btn-sm" style={{ textDecoration: 'none', alignSelf: 'flex-start' }}><IconCalendar width={16} height={16} /> 타임라인·캘린더에서 보기</Link>
          </div>
        )}

        {tab === 'settings' && <Settings p={p} />}
      </div>

      <div className="panel-foot">
        {canEdit ? (
          <>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => {
                startWork(p.id, focusQuest?.id);
                enterFocus({ projectId: p.id, questId: focusQuest?.id });
              }}
            >
              <IconPlay /> 작업 이어가기 · 집중 모드
            </button>
            <button className="btn" onClick={() => setSub({ kind: 'new-quest', projectId: p.id, milestoneId: active?.id })}><IconPlus /> 퀘스트</button>
          </>
        ) : (
          <Link href={`/plan?project=${encodeURIComponent(p.id)}`} className="btn" style={{ flex: 1, textDecoration: 'none' }}><IconCalendar width={16} height={16} /> 계획 화면에서 보기</Link>
        )}
      </div>
    </aside>
  );
}

function Settings({ p }: { p: Project }) {
  const towns = useApp((s) => s.towns);
  const townId = useApp((s) => s.townId);
  const { updateProject, startDemolition, copyProject } = useApp.getState();
  const [title, setTitle] = useState(p.title);
  const [dod, setDod] = useState(p.definitionOfDone);
  const others = towns.filter((t) => t.id !== townId);
  const [target, setTarget] = useState(others[0]?.id ?? '');
  const canEdit = editable(p);
  const vis = p.visibility ?? 'town';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="flabel">프로젝트 이름</span>
        <input className="input" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} onBlur={() => title !== p.title && updateProject(p.id, { title })} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="flabel">끝났다고 말할 수 있는 순간</span>
        <textarea className="input" rows={2} value={dod} maxLength={200} onChange={(e) => setDod(e.target.value)} onBlur={() => dod !== p.definitionOfDone && updateProject(p.id, { definitionOfDone: dod })} />
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="flabel">이름표 색</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {COLORS.map((c) => (
            <button key={c} aria-label={`색 ${c}`} aria-pressed={p.color.toLowerCase() === c.toLowerCase()} onClick={() => updateProject(p.id, { color: c })}
              style={{ width: 28, height: 28, borderRadius: 6, background: c, border: p.color.toLowerCase() === c.toLowerCase() ? '2px solid var(--text)' : '2px solid transparent' }} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="flabel">친구에게 보이는 범위</span>
        {VIS.map((v) => (
          <label key={v.key} className="toggle" style={{ alignItems: 'flex-start' }}>
            <input type="radio" name={`vis-${p.id}`} checked={vis === v.key} onChange={() => updateProject(p.id, { visibility: v.key })} />
            <span><b style={{ color: 'var(--text)' }}>{v.label}</b> — {v.desc}</span>
          </label>
        ))}
      </div>

      <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><IconCopy /> 다른 마을로 복사</span>
        <span className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>지금까지의 중간 목표·퀘스트·완료 상태를 그대로 다른 마을에 하나 더 세워요. 원래 건물은 이 마을에 남고, 경험치는 다시 주지 않아요.</span>
        {others.length === 0 ? (
          <span className="muted" style={{ fontSize: 12 }}>다른 마을이 없어요. 위쪽 마을 이름을 눌러 새 마을을 만들 수 있어요.</span>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <select className="input" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="복사할 마을">
              {others.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button className="btn btn-sm" style={{ height: 38, flexShrink: 0 }} onClick={() => target && copyProject(p.id, target)} disabled={p.status === 'demolishing'}>복사</button>
          </div>
        )}
      </div>

      {canEdit && (
        <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, borderColor: 'rgba(232,119,90,0.45)' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>프로젝트 중지 · 철거</span>
          <span className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>건물이 1시간 동안 철거 현장으로 바뀌고, 끝나면 부지가 비어요. 1시간 안에는 취소할 수 있어요. 지금까지 받은 경험치·성과 기록은 지워지지 않아요. 잠깐 쉬고 싶다면 ‘일정’ 탭의 항해 쉬기를 쓰세요.</span>
          <ConfirmButton label="철거 시작" armedLabel="한 번 더 누르면 철거를 시작해요" onConfirm={() => startDemolition(p.id)} style={{ alignSelf: 'flex-start', height: 36 }} />
        </div>
      )}
    </div>
  );
}

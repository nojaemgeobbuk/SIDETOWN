'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  actualProgress,
  buildingStage,
  cumulativeDelayDays,
  DECAY_THRESHOLD_DAYS,
  expectedProgress,
  health,
} from '@/lib/schedule';
import type { Health, Project } from '@/lib/types';
import { useApp } from '@/store/useApp';
import { friendName, relTime } from '@/lib/social';
import { STAGE_NAMES } from '@/lib/templates';
import { IconClose, IconFlag, IconPlay } from './icons';
import Voyage from './Voyage';

const md = (d?: string) => (d ? d.slice(5).replace('-', '.') : '');
const HEALTH: Record<Health, [string, string]> = { ok: ['순항', '#6CC3A0'], warn: ['주의', '#F4B03E'], late: ['지연', '#E8775A'] };
const KIND: Record<Project['building'], string> = { workshop: '개발 공방 · 메이커', bookstore: '서점 · 작가', lab: '연구소 · 학자' };

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
  return <PanelBody project={project} onClose={() => select(null)} />;
}

function PanelBody({ project: p, onClose }: { project: Project; onClose: () => void }) {
  const today = useApp((s) => s.today);
  const meId = useApp((s) => s.meId);
  const friends = useApp((s) => s.friends);
  const cheers = useApp((s) => s.messages).filter((m) => m.projectId === p.id && m.from !== meId);
  const { toggleQuest, startWork, completeMilestone, postpone, togglePause } = useApp.getState();
  const [tab, setTab] = useState<'todo' | 'plan'>('todo');
  const [evidence, setEvidence] = useState('');

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
  const canCompleteMs = !!active && msQuests.length > 0 && open.length === 0;
  const nextStageImg = `/assets/town/${p.building}-s${Math.min(3, stage + 1)}.png`;
  const smallest = [...p.quests].filter((q) => q.status !== 'done').sort((a, b) => a.estimatedMinutes - b.estimatedMinutes)[0];
  const focusQuest = p.quests.find((q) => q.status === 'doing') ?? open[0];
  const [hLabel, hColor] = p.status === 'paused' ? ['항해 쉬기', '#98A0B3'] : HEALTH[h];

  return (
    <aside className="panel" aria-label={`${p.title} 프로젝트 패널`}>
      <div className="sheet-handle"><span /></div>
      <div className="panel-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="chip" style={{ color: hColor, borderColor: hColor }}>{hLabel}</span>
          <span className="muted" style={{ fontSize: 12 }}>{KIND[p.building]} · {stage}단계 {STAGE_NAMES[stage]}</span>
          <div style={{ flex: 1 }} />
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
            <span style={{ color: actual >= expected ? 'var(--mint)' : 'var(--coral)' }}>
              {actual}% · 계획 {expected}%
            </span>
            <span>도착 {md(p.target)}</span>
          </div>
        </div>

        {p.condition === 'decayed' && (
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
        {p.condition === 'repairing' && (
          <div className="notice good" role="status">수리 중이에요. 퀘스트 하나를 끝내면 불이 다시 켜지고, 지금 계획이 새 기준선이 돼요.</div>
        )}

        {active && (
          <div className="card next-ms">
            <img src={nextStageImg} alt="다음 성장 단계 미리보기" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span className="muted" style={{ fontSize: 12 }}>다음 중간 목표 · {activeIdx + 1}/{p.milestones.length}</span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{active.title}</span>
              <span style={{ fontSize: 12, color: 'var(--amber)' }}>{active.criteria}</span>
            </div>
          </div>
        )}

        <div role="tablist" aria-label="프로젝트 보기" className="tabs">
          <button role="tab" aria-selected={tab === 'todo'} onClick={() => setTab('todo')}>할 일</button>
          <button role="tab" aria-selected={tab === 'plan'} onClick={() => setTab('plan')}>일정</button>
        </div>

        {tab === 'todo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...open, ...done].map((q) => (
              <label key={q.id} className={`quest ${q.status}`}>
                <input type="checkbox" checked={q.status === 'done'} onChange={() => toggleQuest(p.id, q.id)} />
                <span style={{ flex: 1 }}>
                  <span className="title" style={{ fontSize: 14, fontWeight: q.status === 'doing' ? 600 : 500 }}>{q.title}</span>
                  <span className="meta">
                    {q.status === 'doing' && <span style={{ color: 'var(--amber)', fontWeight: 600 }}>진행 중</span>}
                    <span>약 {q.estimatedMinutes}분 · AI 추정</span>
                    {q.due && <span className="mono">기한 {md(q.due)}</span>}
                    <span className="mono">+10XP</span>
                  </span>
                </span>
              </label>
            ))}
            {msQuests.length === 0 && <span className="muted" style={{ fontSize: 13 }}>이 중간 목표에 아직 퀘스트가 없어요.</span>}
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
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                    <span className="mono" style={{ width: 22, height: 22, borderRadius: 4, fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: m.status === 'completed' ? p.color : 'transparent', color: m.status === 'completed' ? '#0E111B' : 'var(--text)', border: m.status === 'completed' ? 'none' : '1px solid var(--border)' }}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{ flex: 1, fontSize: 13, color: m.status === 'completed' ? 'var(--muted)' : 'var(--text)' }}>{m.title}</span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {moved && <span style={{ textDecoration: 'line-through', marginRight: 6 }}>{md(m.baselineTarget)}</span>}
                      <span style={{ color: moved ? 'var(--amber)' : undefined }}>{md(m.target)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span>누적 지연</span>
                <span className="mono" style={{ color: delay >= DECAY_THRESHOLD_DAYS ? 'var(--coral)' : 'var(--muted)' }}>{delay}일 / {DECAY_THRESHOLD_DAYS}일</span>
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (delay / DECAY_THRESHOLD_DAYS) * 100)}%`, height: '100%', background: delay >= DECAY_THRESHOLD_DAYS ? 'var(--coral)' : 'var(--amber)' }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button className="btn btn-sm" onClick={() => postpone(p.id, 7, 'cascade')}>뒤 일정까지 1주 미루기</button>
              <button className="btn btn-sm" onClick={() => postpone(p.id, 7, 'only')}>다음 퀘스트만 1주</button>
              <button className="btn btn-sm" onClick={() => togglePause(p.id)}>{p.status === 'paused' ? '항해 다시 시작' : '항해 쉬기'}</button>
            </div>
            <span className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>미리보기·기간 선택이 있는 전체 미루기 창은 단계 1.5에서 붙여요. 여기서는 규칙(8.2·8.3) 동작을 검증해요.</span>
          </div>
        )}
      </div>

      <div className="panel-foot">
        <Link
          href={`/focus?project=${p.id}${focusQuest ? `&quest=${focusQuest.id}` : ''}`}
          className="btn btn-primary"
          style={{ flex: 1, textDecoration: 'none' }}
          onClick={() => startWork(p.id, focusQuest?.id)}
        >
          <IconPlay /> 작업 이어가기
        </Link>
        <button className="btn" disabled title="AI 나누기는 단계 1에서 연결" style={{ opacity: 0.5 }}>더 작게 나누기</button>
      </div>
    </aside>
  );
}

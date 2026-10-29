'use client';

import Link from 'next/link';
import { useState } from 'react';
import { actualProgress, expectedProgress, health } from '@/lib/schedule';
import { MESSAGE_MAX, relTime } from '@/lib/social';
import { BUILDING_INFO, STAGE_NAMES } from '@/lib/templates';
import type { Project } from '@/lib/types';
import { useApp } from '@/store/useApp';
import { IconCalendar, IconClose, IconFlag } from './icons';
import Drawer from './plan/Drawer';
import type { Selection } from './plan/shared';
import Voyage from './Voyage';

const md = (d?: string) => (d ? d.slice(5).replace('-', '.') : '');

/**
 * 친구의 건물(읽기 전용). 친구가 ‘세부 일정까지’ 공개했으면 중간 목표·퀘스트·마감이 보이고,
 * ‘겉모습만’이면 이름·건물·단계·목표일만 보인다. 편집은 할 수 없고, 응원 쪽지를 남길 수 있다.
 */
export default function FriendProjectPanel({ project: p }: { project: Project }) {
  const friends = useApp((s) => s.friends);
  const meId = useApp((s) => s.meId);
  const messages = useApp((s) => s.messages);
  const today = useApp((s) => s.today);
  const { select, sendMessage, openView } = useApp.getState();
  const [text, setText] = useState('');
  const [sub, setSub] = useState<Selection>(null);
  const owner = friends.find((f) => f.id === p.ownerId);
  const name = owner?.name ?? '이웃';
  const stage = p.stage ?? 0;
  const mine = messages.filter((m) => m.projectId === p.id && m.from === meId);
  const focusing = owner?.status === 'focus' && owner.plotId === p.plotId;
  const detail = p.milestones.length > 0;
  const cond =
    p.status === 'demolishing' ? '철거 중' : p.status === 'paused' ? '항해 쉬는 중' : p.status === 'completed' ? '완공' : p.condition === 'decayed' ? '불이 꺼져 있어요' : p.condition === 'repairing' ? '수리 중' : focusing ? `지금 작업 중 · ${owner?.focusMinutes ?? 0}분` : '순항 중';

  if (sub) {
    return (
      <aside className="panel" aria-label="친구 일정">
        <div className="sheet-handle"><span /></div>
        <Drawer embedded key={JSON.stringify(sub)} sel={sub} onClose={() => setSub(null)} />
      </aside>
    );
  }

  const active = p.milestones.find((m) => m.status !== 'completed');
  const activeQuests = active ? p.quests.filter((q) => q.milestoneId === active.id) : [];
  const dues = p.quests.filter((q) => q.status !== 'done' && q.due).sort((a, b) => a.due!.localeCompare(b.due!)).slice(0, 4);

  return (
    <aside className="panel" aria-label={`${name}님의 ${p.title}`}>
      <div className="sheet-handle"><span /></div>
      <div className="panel-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="chip" style={{ color: focusing ? 'var(--coral)' : 'var(--muted)', borderColor: focusing ? 'var(--coral)' : 'var(--border)' }}>{name}님의 건물</span>
          <span className="muted" style={{ fontSize: 12 }}>{BUILDING_INFO[p.building].name} · {stage}단계 {STAGE_NAMES[stage]}</span>
          <div style={{ flex: 1 }} />
          <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label="패널 닫기" onClick={() => select(null)}><IconClose width={18} height={18} /></button>
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px', lineHeight: 1.3 }}>{p.title}</h1>
        {p.definitionOfDone && (
          <div className="dod"><span style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 2 }}><IconFlag /></span><span>완료 조건 · {p.definitionOfDone}</span></div>
        )}
      </div>

      <div className="panel-scroll">
        {detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Voyage progress={actualProgress(p)} expected={expectedProgress(p, today)} color={p.color} health={health(p, today)} width={344} height={42} />
            <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
              <span>출항 {md(p.start)}</span>
              <span>{cond} · {actualProgress(p)}%</span>
              <span>도착 {md(p.target)}</span>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
            <img src={`/assets/town/${p.building}-s${stage}.png`} alt="" style={{ width: 72, height: 72, objectFit: 'contain', filter: p.condition === 'decayed' ? 'grayscale(0.8) brightness(0.6)' : undefined }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{cond}</span>
              <span className="muted mono" style={{ fontSize: 12 }}>목표일 {md(p.target)}</span>
              <span className="muted" style={{ fontSize: 11 }}>{name}님이 겉모습만 공개했어요</span>
            </div>
          </div>
        )}

        {detail && (
          <>
            <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }} aria-label="중간 목표">
              <span className="flabel">중간 목표</span>
              <div className="card" style={{ padding: '4px 0' }}>
                {p.milestones.map((m, i) => {
                  const nq = p.quests.filter((q) => q.milestoneId === m.id);
                  return (
                    <button key={m.id} className="ms-row" onClick={() => setSub({ kind: 'milestone', projectId: p.id, milestoneId: m.id })} style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}>
                      <span className="mono" style={{ width: 22, height: 22, borderRadius: 4, fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: m.status === 'completed' ? p.color : 'transparent', color: m.status === 'completed' ? '#0E111B' : 'var(--text)', border: m.status === 'completed' ? 'none' : `1px solid ${m.status === 'active' ? 'var(--amber)' : 'var(--border)'}`, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                      <span style={{ flex: 1, fontSize: 13, textAlign: 'left', color: m.status === 'completed' ? 'var(--muted)' : 'var(--text)' }}>
                        {m.title}
                        <span className="muted mono" style={{ fontSize: 10, display: 'block' }}>퀘스트 {nq.filter((q) => q.status === 'done').length}/{nq.length}{m.evidence ? ` · ${m.evidence}` : ''}</span>
                      </span>
                      <span className="mono muted" style={{ fontSize: 11 }}>{md(m.target)}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {active && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }} aria-label="지금 하는 일">
                <span className="flabel">지금 하는 일 · {active.title}</span>
                {activeQuests.length === 0 && <span className="muted" style={{ fontSize: 12 }}>아직 퀘스트가 없어요.</span>}
                {activeQuests.map((q) => (
                  <button key={q.id} className={`quest ${q.status}`} onClick={() => setSub({ kind: 'quest', projectId: p.id, questId: q.id })} style={{ textAlign: 'left', color: 'inherit' }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, border: '1.5px solid var(--border)', background: q.status === 'done' ? 'var(--mint)' : 'transparent', flexShrink: 0, marginTop: 2 }} aria-hidden />
                    <span style={{ flex: 1 }}>
                      <span className="title" style={{ fontSize: 13 }}>{q.title}</span>
                      <span className="meta">
                        {q.status === 'doing' && <span style={{ color: 'var(--amber)', fontWeight: 600 }}>진행 중</span>}
                        <span>{q.estimatedMinutes}분</span>
                        {q.scheduledStart && <span className="mono">{md(q.scheduledStart)} 하기</span>}
                        {q.due && <span className="mono">마감 {md(q.due)}</span>}
                      </span>
                    </span>
                  </button>
                ))}
              </section>
            )}

            {dues.length > 0 && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 4 }} aria-label="다가오는 마감">
                <span className="flabel">다가오는 마감</span>
                {dues.map((q) => (
                  <span key={q.id} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                    <span className="mono" style={{ width: 40, color: q.due! < today ? 'var(--coral)' : 'var(--muted)' }}>{md(q.due)}</span>
                    <span className="ellipsis">{q.title}</span>
                  </span>
                ))}
              </section>
            )}
            <Link href={`/plan?friends=1&project=${encodeURIComponent(p.id)}&view=timeline`} className="btn btn-sm" style={{ textDecoration: 'none', alignSelf: 'flex-start' }}><IconCalendar width={16} height={16} /> 계획 화면에서 {name}님 일정 보기</Link>
          </>
        )}

        {mine.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="flabel">내가 남긴 응원</span>
            {mine.map((m) => (
              <div key={m.id} className="card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span className="muted mono" style={{ fontSize: 10 }}>{relTime(m.at)}</span>
                <span style={{ fontSize: 13, lineHeight: 1.5 }}>{m.text}</span>
              </div>
            ))}
          </div>
        )}
        {owner && (
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => openView({ kind: 'inbox', friendId: owner.id })}>{name}님과의 쪽지 보기</button>
        )}
      </div>

      {owner && (
        <form
          className="panel-foot"
          style={{ flexDirection: 'column', gap: 6 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (sendMessage(owner.id, text, p.id)) setText('');
          }}
        >
          {focusing && <span className="muted" style={{ fontSize: 11 }}>{name}님은 집중 중이에요. 응원은 휴식 시간에 알려드려요.</span>}
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" value={text} maxLength={MESSAGE_MAX} onChange={(e) => setText(e.target.value)} placeholder={`‘${p.title}’에 응원 남기기`} aria-label="응원 남기기" />
            <button className="btn btn-primary btn-sm" style={{ height: 40, opacity: text.trim() ? 1 : 0.5 }} disabled={!text.trim()}>응원</button>
          </div>
        </form>
      )}
    </aside>
  );
}

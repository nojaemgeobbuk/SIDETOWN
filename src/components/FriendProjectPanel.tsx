'use client';

import { useState } from 'react';
import { MESSAGE_MAX, relTime } from '@/lib/social';
import { BUILDING_INFO, STAGE_NAMES } from '@/lib/templates';
import type { Project } from '@/lib/types';
import { useApp } from '@/store/useApp';
import { IconClose, IconFlag } from './icons';

const md = (d?: string) => (d ? d.slice(5).replace('-', '.') : '');

/**
 * 친구의 건물(읽기 전용). 친구가 공개한 겉모습(이름·건물·단계·상태·목표일)만 보이고
 * 중간 목표·퀘스트·성과 기록은 RLS로 막혀 있다. 여기서 할 수 있는 일은 응원 쪽지뿐.
 */
export default function FriendProjectPanel({ project: p }: { project: Project }) {
  const friends = useApp((s) => s.friends);
  const meId = useApp((s) => s.meId);
  const messages = useApp((s) => s.messages);
  const { select, sendMessage, openView } = useApp.getState();
  const [text, setText] = useState('');
  const owner = friends.find((f) => f.id === p.ownerId);
  const name = owner?.name ?? '이웃';
  const stage = p.stage ?? 0;
  const mine = messages.filter((m) => m.projectId === p.id && m.from === meId);
  const focusing = owner?.status === 'focus' && owner.plotId === p.plotId;
  const cond =
    p.status === 'paused' ? '항해 쉬는 중' : p.status === 'completed' ? '완공' : p.condition === 'decayed' ? '불이 꺼져 있어요' : p.condition === 'repairing' ? '수리 중' : focusing ? `지금 작업 중 · ${owner?.focusMinutes ?? 0}분` : '순항 중';

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
        <div className="card" style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
          <img src={`/assets/town/${p.building}-s${stage}.png`} alt="" style={{ width: 72, height: 72, objectFit: 'contain', filter: p.condition === 'decayed' ? 'grayscale(0.8) brightness(0.6)' : undefined }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{cond}</span>
            <span className="muted mono" style={{ fontSize: 12 }}>목표일 {md(p.target)}</span>
            <span className="muted" style={{ fontSize: 11 }}>세부 계획은 {name}님만 볼 수 있어요</span>
          </div>
        </div>
        {mine.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>내가 남긴 응원</span>
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

'use client';

import { useMemo, useState } from 'react';
import { addDays } from '@/lib/schedule';
import { md, type QuestRef } from '@/lib/plan';
import type { ISODate, Project, Quest } from '@/lib/types';
import { useApp } from '@/store/useApp';
import { IconPin } from '../icons';

export type Selection =
  | { kind: 'quest'; projectId: string; questId: string }
  | { kind: 'milestone'; projectId: string; milestoneId: string }
  | { kind: 'new-quest'; projectId?: string; milestoneId?: string; date?: ISODate }
  | { kind: 'new-milestone'; projectId: string }
  | null;

export const STATUS_LABEL: Record<Quest['status'], string> = { todo: '할 일', doing: '진행 중', done: '끝' };

/** 퀘스트 카드(주간·오늘·보드 공용). 끌어서 옮길 수 있다 */
export function QuestCard({
  r,
  today,
  onOpen,
  compact = false,
  draggable = true,
  showDate = false,
}: {
  r: QuestRef;
  today: ISODate;
  onOpen: () => void;
  compact?: boolean;
  draggable?: boolean;
  showDate?: boolean;
}) {
  const q = r.quest;
  const late = q.status !== 'done' && q.due && q.due < today;
  const friend = useApp((s) => (r.readonly ? s.friends.find((f) => f.id === r.project.ownerId)?.name : undefined));
  return (
    <div
      className={`qcard ${q.status}${r.readonly ? ' ro' : ''}`}
      style={{ ['--pc' as string]: r.project.color }}
      draggable={draggable && !r.readonly}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/sidetown-quest', JSON.stringify({ projectId: r.project.id, questId: q.id }));
        e.dataTransfer.effectAllowed = 'move';
      }}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`${q.title}, ${r.project.title}${q.status === 'done' ? ', 끝남' : ''}`}
    >
      {!r.readonly && (
        <input
          type="checkbox"
          checked={q.status === 'done'}
          aria-label={`${q.title} 완료`}
          onClick={(e) => e.stopPropagation()}
          onChange={() => useApp.getState().toggleQuest(r.project.id, q.id)}
        />
      )}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="qt">{q.title}</span>
        {!compact && (
          <span className="qm">
            <span className="pdot" />
            <span className="ellipsis">{friend ? `${friend} · ` : ''}{r.project.title}</span>
          </span>
        )}
        <span className="qm">
          <span className="mono">{q.estimatedMinutes}분</span>
          {showDate && q.scheduledStart && <span className="mono">{md(q.scheduledStart)} 하기</span>}
          {q.due && <span className="mono" style={{ color: late ? 'var(--coral)' : undefined }}>{late ? '지남 ' : '마감 '}{md(q.due)}</span>}
          {q.status === 'doing' && <span style={{ color: 'var(--amber)', fontWeight: 600 }}>진행 중</span>}
          {q.pinned && <IconPin width={12} height={12} aria-label="고정" />}
        </span>
      </span>
    </div>
  );
}

/** 드롭 대상: 퀘스트를 놓으면 onDrop(projectId, questId) */
export function useDrop(onDrop: (projectId: string, questId: string) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (e: React.DragEvent) => {
        if (e.dataTransfer.types.includes('text/sidetown-quest')) {
          e.preventDefault();
          setOver(true);
        }
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: React.DragEvent) => {
        setOver(false);
        const raw = e.dataTransfer.getData('text/sidetown-quest');
        if (!raw) return;
        e.preventDefault();
        const { projectId, questId } = JSON.parse(raw);
        onDrop(projectId, questId);
      },
    },
  };
}

export function ProjectFilter({ projects, friends, selected, setSelected, showFriends, setShowFriends }: {
  projects: Project[];
  friends: Project[];
  selected: string | 'all';
  setSelected: (v: string | 'all') => void;
  showFriends: boolean;
  setShowFriends: (v: boolean) => void;
}) {
  const friendCount = friends.filter((p) => p.milestones.length > 0).length;
  return (
    <div className="pfilter" role="group" aria-label="프로젝트 거르기">
      <button className="pchip" aria-pressed={selected === 'all'} onClick={() => setSelected('all')}>전체</button>
      {projects.map((p) => (
        <button key={p.id} className="pchip" aria-pressed={selected === p.id} onClick={() => setSelected(selected === p.id ? 'all' : p.id)} style={{ ['--pc' as string]: p.color }}>
          <span className="pdot" />
          <span className="ellipsis" style={{ maxWidth: 140 }}>{p.title}</span>
        </button>
      ))}
      {friendCount > 0 && (
        <button className="pchip friends-chip" aria-pressed={showFriends} onClick={() => setShowFriends(!showFriends)} title="같은 마을 친구가 공개한 세부 일정">
          친구 일정 {showFriends ? '보는 중' : '보기'} · {friendCount}
        </button>
      )}
    </div>
  );
}

/** 빠른 날짜 고르기 */
export function DateQuick({ value, onChange, today, label }: { value?: ISODate; onChange: (d?: ISODate) => void; today: ISODate; label: string }) {
  const opts = useMemo(() => [
    ['오늘', today],
    ['내일', addDays(today, 1)],
    ['다음 주', addDays(today, 7)],
  ] as const, [today]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="flabel">{label}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} aria-label={label} style={{ width: 150, padding: '7px 10px' }} />
        {opts.map(([t, d]) => (
          <button type="button" key={t} className="btn btn-sm" aria-pressed={value === d} onClick={() => onChange(d)} style={{ height: 30 }}>{t}</button>
        ))}
        {value && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(undefined)} style={{ height: 30 }}>비우기</button>}
      </div>
    </div>
  );
}

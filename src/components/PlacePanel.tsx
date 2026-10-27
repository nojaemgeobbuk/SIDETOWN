'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays } from '@/lib/schedule';
import { FRIENDS, friendName, ME, MESSAGE_MAX, relTime, thread, unreadCount, type Friend } from '@/lib/social';
import { BUILDING_INFO, STAGE_NAMES, TEMPLATES } from '@/lib/templates';
import type { BuildingType } from '@/lib/types';
import { useApp, type View } from '@/store/useApp';
import { IconClose } from './icons';

/** 프로젝트가 아닌 장소 패널: 공용 카페, 내 집, 빈 부지(새 프로젝트), 쪽지함 */
export default function PlacePanel({ view }: { view: View }) {
  const close = () => useApp.getState().openView(null);
  return (
    <aside className="panel" aria-label="장소 패널">
      <div className="sheet-handle"><span /></div>
      {view.kind === 'cafe' && <Cafe onClose={close} />}
      {view.kind === 'home' && <Home onClose={close} />}
      {view.kind === 'new' && <NewProject plotId={view.plotId} onClose={close} />}
      {view.kind === 'inbox' && <Inbox friendId={view.friendId} onClose={close} />}
    </aside>
  );
}

function Head({ tag, title, sub, onClose }: { tag: string; title: string; sub?: string; onClose: () => void }) {
  return (
    <div className="panel-head">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="chip" style={{ color: 'var(--amber)', borderColor: 'rgba(244,176,62,0.5)' }}>{tag}</span>
        {sub && <span className="muted" style={{ fontSize: 12 }}>{sub}</span>}
        <div style={{ flex: 1 }} />
        <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label="패널 닫기" onClick={onClose}><IconClose width={18} height={18} /></button>
      </div>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px' }}>{title}</h1>
    </div>
  );
}

function Avatar({ f, size = 30 }: { f: Friend; size?: number }) {
  const dot = f.status === 'focus' ? 'var(--coral)' : f.status === 'online' ? 'var(--mint)' : '#4A5366';
  return (
    <span className="avatar" style={{ width: size, height: size, background: f.bg, color: f.fg, border: 'none' }}>
      {f.initial}
      <span className="dot" style={{ background: dot }} />
    </span>
  );
}

function statusText(f: Friend) {
  if (f.status === 'focus') return `집중 중 · ${f.focusMinutes ?? 0}분`;
  if (f.status === 'online') return '접속 중';
  return '오프라인';
}

/* ───────── 공용 카페: 마을 게시판 ───────── */
function Cafe({ onClose }: { onClose: () => void }) {
  const messages = useApp((s) => s.messages);
  const projects = useApp((s) => s.projects);
  const { sendMessage, openView } = useApp.getState();
  const [text, setText] = useState('');
  const board = messages.filter((m) => m.to === 'board').sort((a, b) => b.at.localeCompare(a.at));
  const townDone = projects.reduce((n, p) => n + p.milestones.filter((m) => m.status === 'completed').length, 0);
  const unlocks = [
    { at: 5, name: '공용 화단' },
    { at: 15, name: '광장 가로등' },
    { at: 30, name: '광장 분수' },
  ];
  return (
    <>
      <Head tag="공용" title="공용 카페" sub="마을 게시판 · 누구나 이용" onClose={onClose} />
      <div className="panel-scroll">
        <section aria-label="지금 마을" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>지금 마을</span>
          {FRIENDS.map((f) => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar f={f} />
              <span style={{ flex: 1, fontSize: 13 }}>{f.name} <span className="muted" style={{ fontSize: 12 }}>· {statusText(f)}</span></span>
              <button className="btn btn-sm" onClick={() => openView({ kind: 'inbox', friendId: f.id })}>쪽지</button>
            </div>
          ))}
        </section>

        <section aria-label="마을 게시판" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>마을 게시판</span>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (sendMessage('board', text)) setText('');
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            <textarea className="input" rows={2} maxLength={MESSAGE_MAX} value={text} onChange={(e) => setText(e.target.value)} placeholder="마을 사람들에게 한마디 (예: 이번 주 같이 회고해요)" aria-label="게시판에 글 쓰기" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="mono muted" style={{ fontSize: 11 }}>{text.length}/{MESSAGE_MAX}</span>
              <button className="btn btn-primary btn-sm" disabled={!text.trim()} style={{ opacity: text.trim() ? 1 : 0.5 }}>게시판에 남기기</button>
            </div>
          </form>
          {board.map((m) => (
            <div key={m.id} className="card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12 }}><b>{friendName(m.from)}</b> <span className="muted">· {relTime(m.at)}</span></span>
              <span style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{m.text}</span>
            </div>
          ))}
        </section>

        <section aria-label="마을 공용 해금" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>함께 여는 마을 장식</span>
          <span className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>누구의 중간 목표든 완료되면 마을 전체 숫자가 올라가요. 지금 {townDone}개.</span>
          {unlocks.map((u) => (
            <div key={u.at} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <span className="mono" style={{ width: 28, color: townDone >= u.at ? 'var(--mint)' : 'var(--muted)' }}>{u.at}</span>
              <span style={{ flex: 1 }}>{u.name}</span>
              <span className="muted" style={{ fontSize: 12 }}>{townDone >= u.at ? '열림' : `${u.at - townDone}개 남음`}</span>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

/* ───────── 내 집: 캐릭터와 진열장 ───────── */
function Home({ onClose }: { onClose: () => void }) {
  const projects = useApp((s) => s.projects);
  const xp = useApp((s) => s.xp);
  const select = useApp((s) => s.select);
  const level = 1 + Math.floor(xp / 100);
  const mastery = (Object.keys(BUILDING_INFO) as BuildingType[]).map((b) => ({
    b,
    n: projects.filter((p) => p.building === b).reduce((s, p) => s + p.milestones.filter((m) => m.status === 'completed').length, 0),
  }));
  const shelf = projects.flatMap((p) => p.milestones.filter((m) => m.status === 'completed').map((m) => ({ p, m })));
  return (
    <>
      <Head tag="내 집" title="새벽작업실" sub="캐릭터 · 진열장" onClose={onClose} />
      <div className="panel-scroll">
        <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14 }}>
          <img src="/assets/character/front-right.png" alt="내 캐릭터" style={{ width: 54, height: 110, objectFit: 'contain' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <span className="pixel" style={{ color: 'var(--amber)', fontSize: 15 }}>LV {level}</span>
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${xp % 100}%`, height: '100%', background: 'var(--amber)' }} /></div>
            <span className="mono muted" style={{ fontSize: 11 }}>누적 {xp} XP · 다음 레벨까지 {100 - (xp % 100)}</span>
          </div>
        </div>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>직업 숙련도</span>
          {mastery.map(({ b, n }) => (
            <div key={b} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 40px', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <span>{BUILDING_INFO[b].role}</span>
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, n * 20)}%`, height: '100%', background: BUILDING_INFO[b].color }} /></div>
              <span className="mono muted" style={{ fontSize: 11, textAlign: 'right' }}>{n}회</span>
            </div>
          ))}
        </section>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>진열장 · 완료한 중간 목표</span>
          {shelf.length === 0 && <span className="muted" style={{ fontSize: 13 }}>아직 비어 있어요. 첫 중간 목표를 끝내면 여기에 놓여요.</span>}
          {shelf.map(({ p, m }) => (
            <button key={m.id} className="card" onClick={() => select(p.id)} style={{ textAlign: 'left', padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flexShrink: 0 }} />
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{m.title}</span>
                <span className="muted" style={{ fontSize: 12 }}>{p.title}{m.evidence ? ` · ${m.evidence}` : ''}</span>
              </span>
            </button>
          ))}
        </section>
      </div>
    </>
  );
}

/* ───────── 빈 부지: 새 프로젝트 만들기 ───────── */
function NewProject({ plotId, onClose }: { plotId: string; onClose: () => void }) {
  const today = useApp((s) => s.today);
  const addProject = useApp((s) => s.addProject);
  const [building, setBuilding] = useState<BuildingType>('workshop');
  const [title, setTitle] = useState('');
  const [dod, setDod] = useState('');
  const [target, setTarget] = useState(addDays(today, 90));
  const [ms, setMs] = useState<string[]>(TEMPLATES.workshop.milestones);
  const [quest, setQuest] = useState(TEMPLATES.workshop.firstQuest);
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  const pick = (b: BuildingType) => {
    setBuilding(b);
    setMs(TEMPLATES[b].milestones);
    setQuest(TEMPLATES[b].firstQuest);
  };
  const ok = title.trim().length > 0 && target > today;
  return (
    <>
      <Head tag="빈 부지" title="새 프로젝트 착공" sub="AI 계획 초안은 단계 1에서 연결" onClose={onClose} />
      <form
        className="panel-scroll"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ok) return;
          addProject({ title, building, definitionOfDone: dod, target, milestones: ms, firstQuest: quest, plotId });
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>무엇을 만들까요?</span>
          <input ref={titleRef} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 가계부 앱 출시" maxLength={60} />
        </label>
        <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>건물</legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 6 }}>
            {(Object.keys(BUILDING_INFO) as BuildingType[]).map((b) => (
              <button type="button" key={b} aria-pressed={building === b} onClick={() => pick(b)} className="card" style={{ padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, borderColor: building === b ? 'var(--amber)' : 'var(--border)', background: building === b ? 'var(--amber-soft)' : 'var(--card)' }}>
                <img src={`/assets/town/${b}-s3.png`} alt="" style={{ width: 64, height: 64, objectFit: 'contain' }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{BUILDING_INFO[b].name}</span>
                <span className="muted" style={{ fontSize: 10, textAlign: 'center' }}>{BUILDING_INFO[b].examples}</span>
              </button>
            ))}
          </div>
          <span className="muted" style={{ fontSize: 11 }}>완성하면 이런 랜드마크가 돼요. 지금은 공사 부지로 시작해요.</span>
        </fieldset>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>끝났다고 말할 수 있는 순간</span>
          <input className="input" value={dod} onChange={(e) => setDod(e.target.value)} placeholder={TEMPLATES[building].dod} maxLength={120} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>목표일</span>
          <input className="input" type="date" value={target} min={addDays(today, 1)} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>중간 목표 (건물이 자라는 지점)</span>
          {ms.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className="mono muted" style={{ width: 22, fontSize: 11 }}>{String(i + 1).padStart(2, '0')}</span>
              <input className="input" value={m} aria-label={`중간 목표 ${i + 1}`} onChange={(e) => setMs(ms.map((x, j) => (j === i ? e.target.value : x)))} />
              <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} aria-label={`중간 목표 ${i + 1} 지우기`} onClick={() => setMs(ms.filter((_, j) => j !== i))}><IconClose width={14} height={14} /></button>
            </div>
          ))}
          {ms.length < 6 && <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setMs([...ms, ''])}>+ 중간 목표 추가</button>}
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>오늘 할 첫 퀘스트 (20분 이내)</span>
          <input className="input" value={quest} onChange={(e) => setQuest(e.target.value)} maxLength={80} />
        </label>
        <button className="btn btn-primary" disabled={!ok} style={{ opacity: ok ? 1 : 0.5 }}>착공하기</button>
      </form>
    </>
  );
}

/* ───────── 쪽지함 ───────── */
function Inbox({ friendId, onClose }: { friendId?: string; onClose: () => void }) {
  const messages = useApp((s) => s.messages);
  const { openView, markRead, sendMessage } = useApp.getState();
  const friend = FRIENDS.find((f) => f.id === friendId);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const conv = useMemo(() => (friend ? thread(messages, friend.id) : []), [messages, friend]);
  useEffect(() => {
    if (friend && unreadCount(messages, friend.id) > 0) markRead(friend.id);
  }, [friend, messages, markRead]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [conv.length]);

  if (!friend) {
    return (
      <>
        <Head tag="쪽지" title="쪽지함" sub="실시간 채팅이 아닌 남겨두는 메시지" onClose={onClose} />
        <div className="panel-scroll">
          {FRIENDS.map((f) => {
            const last = thread(messages, f.id).at(-1);
            const n = unreadCount(messages, f.id);
            return (
              <button key={f.id} className="card" onClick={() => openView({ kind: 'inbox', friendId: f.id })} style={{ textAlign: 'left', padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                <Avatar f={f} size={34} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{f.name} <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>· {statusText(f)}</span></span>
                  <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{last ? `${last.from === ME ? '나: ' : ''}${last.text}` : '아직 주고받은 쪽지가 없어요'}</span>
                </span>
                {n > 0 && <span className="mono" style={{ minWidth: 20, height: 20, borderRadius: 10, background: 'var(--coral)', color: '#1a0e0a', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{n}</span>}
              </button>
            );
          })}
          <button className="btn btn-sm" onClick={() => openView({ kind: 'cafe' })}>마을 게시판 보기</button>
        </div>
      </>
    );
  }

  const focusing = friend.status === 'focus';
  const projects = useApp.getState().projects;
  return (
    <>
      <div className="panel-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => openView({ kind: 'inbox' })} aria-label="쪽지함으로">‹ 쪽지함</button>
          <div style={{ flex: 1 }} />
          <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label="패널 닫기" onClick={onClose}><IconClose width={18} height={18} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar f={friend} size={36} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{friend.name}</span>
            <span className="muted" style={{ fontSize: 12 }}>{statusText(friend)}</span>
          </div>
        </div>
      </div>
      <div className="panel-scroll" aria-live="polite">
        {conv.length === 0 && <span className="muted" style={{ fontSize: 13 }}>첫 쪽지를 남겨 보세요.</span>}
        {conv.map((m) => {
          const mine = m.from === ME;
          const proj = m.projectId ? projects.find((p) => p.id === m.projectId) : undefined;
          return (
            <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 4, alignItems: mine ? 'flex-end' : 'flex-start' }}>
              {proj && <span className="muted" style={{ fontSize: 11 }}>‘{proj.title}’에 남긴 응원</span>}
              <span style={{ padding: '9px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', background: mine ? 'var(--amber)' : 'var(--card)', color: mine ? 'var(--amber-ink)' : 'var(--text)', border: mine ? 'none' : '1px solid var(--border)' }}>{m.text}</span>
              <span className="mono muted" style={{ fontSize: 10 }}>{relTime(m.at)}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form
        className="panel-foot"
        style={{ flexDirection: 'column', gap: 6 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (sendMessage(friend.id, text)) setText('');
        }}
      >
        {focusing && <span className="muted" style={{ fontSize: 11 }}>{friend.name}님은 집중 중이에요. 쪽지는 휴식 시간에 알려드려요.</span>}
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={text} maxLength={MESSAGE_MAX} onChange={(e) => setText(e.target.value)} placeholder={`${friend.name}에게 쪽지`} aria-label={`${friend.name}에게 쪽지`} />
          <button className="btn btn-primary btn-sm" style={{ height: 40, opacity: text.trim() ? 1 : 0.5 }} disabled={!text.trim()}>보내기</button>
        </div>
      </form>
    </>
  );
}

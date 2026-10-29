'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { unreadCount } from '@/lib/social';
import { useApp, type View } from '@/store/useApp';
import AvatarImg from './AvatarImg';
import { IconCalendar, IconCup, IconDown, IconMail, IconPlus, IconTown, IconTrophy, IconUser } from './icons';

/** 마을·계획 화면이 같이 쓰는 상단 바, 왼쪽 메뉴, 모바일 아래 메뉴, 알림 */

function useGo() {
  const router = useRouter();
  const path = usePathname();
  return (view: View | null) => {
    useApp.getState().openView(view);
    if (path !== '/') router.push('/');
  };
}

export function Topbar() {
  const xp = useApp((s) => s.xp);
  const friends = useApp((s) => s.friends);
  const messages = useApp((s) => s.messages);
  const me = useApp((s) => s.meId);
  const avatar = useApp((s) => s.me.avatar);
  const go = useGo();
  const unread = unreadCount(messages, undefined, me);
  const online = friends.filter((f) => f.status !== 'offline').length;
  const level = 1 + Math.floor(xp / 100);
  return (
    <header className="topbar">
      <Link href="/" className="brand">SIDETOWN</Link>
      <span style={{ width: 1, height: 18, background: 'var(--border)' }} className="town-sep" />
      <TownSwitcher />
      <div style={{ flex: 1 }} />
      <button className="xp" title={`누적 ${xp} XP · 내 집에서 캐릭터 꾸미기`} onClick={() => go({ kind: 'home', tab: 'look' })} style={{ cursor: 'pointer', color: 'inherit' }}>
        <AvatarImg avatar={avatar} facing="front-right" height={34} />
        <span className="pixel" style={{ fontSize: 13, color: 'var(--amber)' }}>LV {level}</span>
        <span className="bar"><span style={{ width: `${xp % 100}%` }} /></span>
        <span className="mono xp-num" style={{ fontSize: 12, color: 'var(--muted)' }}>{xp % 100}/100</span>
      </button>
      <div className="friends">
        <span className="label">접속 {online}</span>
        <span style={{ display: 'flex' }}>
          {friends.slice(0, 7).map((f) => (
            <button key={f.id} className="avatar" title={`${f.name}에게 쪽지`} aria-label={`${f.name}에게 쪽지 (${f.status === 'focus' ? '집중 중' : f.status === 'online' ? '접속 중' : '오프라인'})`} onClick={() => go({ kind: 'inbox', friendId: f.id })} style={{ background: f.bg, color: f.fg, padding: 0, opacity: f.status === 'offline' ? 0.55 : 1 }}>
              {f.initial}
              {f.status !== 'offline' && <span className="dot" style={{ background: f.status === 'focus' ? 'var(--coral)' : 'var(--mint)' }} />}
            </button>
          ))}
        </span>
      </div>
      <button className="icon-btn" aria-label={`쪽지함${unread ? `, 안 읽은 쪽지 ${unread}개` : ''}`} onClick={() => go({ kind: 'inbox' })} style={{ position: 'relative', width: 40, height: 40, border: '1px solid var(--border)', color: 'var(--text)' }}>
        <IconMail />
        {unread > 0 && <span className="mono badge">{unread}</span>}
      </button>
    </header>
  );
}

/** 최상단 마을 전환 메뉴(기획서 v1.3: 친구 그룹마다 마을) */
export function TownSwitcher() {
  const towns = useApp((s) => s.towns);
  const townId = useApp((s) => s.townId);
  const townName = useApp((s) => s.townName);
  const [open, setOpen] = useState(false);
  const [making, setMaking] = useState(false);
  const [name, setName] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button className="town-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="town-name">{townName}</span>
        <IconDown />
      </button>
      {open && (
        <div className="menu" role="menu" aria-label="마을 전환">
          <span className="menu-label">내 마을 {towns.length}</span>
          {towns.map((t) => (
            <button
              key={t.id}
              role="menuitemradio"
              aria-checked={t.id === townId}
              className="menu-item"
              onClick={async () => {
                setOpen(false);
                await useApp.getState().switchTown(t.id);
              }}
            >
              <span className="menu-dot" style={{ background: t.id === townId ? 'var(--amber)' : 'var(--border)' }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: t.id === townId ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                <span className="muted" style={{ fontSize: 11 }}>{t.members}명 · 내 프로젝트 {t.myProjects}개</span>
              </span>
            </button>
          ))}
          <div className="menu-sep" />
          {making ? (
            <form
              style={{ display: 'flex', gap: 6, padding: '4px 8px 8px' }}
              onSubmit={async (e) => {
                e.preventDefault();
                if (!name.trim()) return;
                setOpen(false);
                setMaking(false);
                await useApp.getState().createTown(name);
                setName('');
              }}
            >
              <input className="input" autoFocus value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="예: 회사 동기 마을" aria-label="새 마을 이름" style={{ padding: '7px 10px' }} />
              <button className="btn btn-primary btn-sm" disabled={!name.trim()}>만들기</button>
            </form>
          ) : (
            <button className="menu-item" onClick={() => setMaking(true)}>
              <IconPlus /> 새 마을 만들기
            </button>
          )}
          <Link href="/towns" className="menu-item" onClick={() => setOpen(false)} style={{ textDecoration: 'none', color: 'inherit' }}>
            모든 마을 보기 · 프로젝트 복사
          </Link>
        </div>
      )}
    </div>
  );
}

type Active = 'town' | 'plan' | 'towns';

export function Rail({ active }: { active: Active }) {
  const view = useApp((s) => s.view);
  const go = useGo();
  const onTown = active === 'town';
  return (
    <nav className="rail" aria-label="주요 메뉴">
      <Link href="/" className="icon-btn" aria-label="마을" aria-current={onTown && !view ? 'page' : undefined} onClick={() => useApp.getState().openView(null)}><IconTown /></Link>
      <Link href="/plan" className="icon-btn" aria-label="계획 · 일정" aria-current={active === 'plan' ? 'page' : undefined}><IconCalendar /></Link>
      <button className="icon-btn" aria-label="공용 카페 · 마을 게시판" aria-current={onTown && view?.kind === 'cafe' ? 'page' : undefined} onClick={() => go({ kind: 'cafe' })}><IconCup /></button>
      <button className="icon-btn" aria-label="내 집 · 캐릭터" aria-current={onTown && view?.kind === 'home' ? 'page' : undefined} onClick={() => go({ kind: 'home' })}><IconUser /></button>
      <button className="icon-btn" aria-label="명예의 전당" aria-current={onTown && view?.kind === 'hall' ? 'page' : undefined} onClick={() => go({ kind: 'hall' })}><IconTrophy /></button>
    </nav>
  );
}

/** 1024px 미만: 아래 탭 메뉴 */
export function MobileNav({ active }: { active: Active }) {
  const view = useApp((s) => s.view);
  const go = useGo();
  const onTown = active === 'town';
  const item = (label: string, icon: React.ReactNode, current: boolean, onClick?: () => void, href?: string) =>
    href ? (
      <Link href={href} className="mnav-item" aria-current={current ? 'page' : undefined} onClick={onClick}>{icon}<span>{label}</span></Link>
    ) : (
      <button className="mnav-item" aria-current={current ? 'page' : undefined} onClick={onClick}>{icon}<span>{label}</span></button>
    );
  return (
    <nav className="mobile-nav" aria-label="주요 메뉴">
      {item('마을', <IconTown width={20} height={20} />, onTown && !view, () => useApp.getState().openView(null), '/')}
      {item('계획', <IconCalendar width={20} height={20} />, active === 'plan', undefined, '/plan')}
      {item('카페', <IconCup width={20} height={20} />, onTown && view?.kind === 'cafe', () => go({ kind: 'cafe' }))}
      {item('내 집', <IconUser width={20} height={20} />, onTown && view?.kind === 'home', () => go({ kind: 'home' }))}
      {item('전당', <IconTrophy width={20} height={20} />, onTown && view?.kind === 'hall', () => go({ kind: 'hall' }))}
    </nav>
  );
}

export function Toaster() {
  const toast = useApp((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => useApp.setState({ toast: null }), 3600);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div key={toast.id} className={`toast ${toast.tone}`} role="status" aria-live="polite">{toast.text}</div>
  );
}

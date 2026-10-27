/**
 * 친구 메시지 — 기획서 v1.2 13.5절.
 * 실시간 채팅이 아니라 ‘남겨두는 쪽지’와 ‘마을 게시판’이다. 상대가 접속해 있지 않아도 되고,
 * 집중 중인 사람에게는 알림을 미뤘다가 휴식 때 보여준다.
 */
export const ME = 'me';

export interface Friend {
  id: string;
  name: string;
  initial: string;
  bg: string;
  fg: string;
  status: 'focus' | 'online' | 'offline';
  /** 집중 중일 때 작업 중인 건물 */
  plotId?: string;
  focusMinutes?: number;
}

export interface Message {
  id: string;
  from: string;
  /** 친구 id 또는 'board'(마을 게시판) */
  to: string;
  text: string;
  at: string; // ISO datetime
  read: boolean;
  /** 특정 프로젝트에 남긴 응원 */
  projectId?: string;
}

export const MESSAGE_MAX = 200;

export const FRIENDS: Friend[] = [
  { id: 'jiwoo', name: '지우', initial: '지', bg: '#3a2a26', fg: '#f2c8b8', status: 'focus', plotId: 'plot-c', focusMinutes: 18 },
  { id: 'min', name: '민', initial: '민', bg: '#23314a', fg: '#bfd0ee', status: 'online' },
  { id: 'seo', name: '서', initial: '서', bg: '#2c3328', fg: '#cfe0b8', status: 'offline' },
];

export const sampleMessages: Message[] = [
  { id: 'm1', from: 'jiwoo', to: ME, text: '공방 불빛 보고 자극받았어. 오늘 기출 1회차는 꼭 풀게!', at: '2026-10-26T12:40:00+09:00', read: false },
  { id: 'm2', from: ME, to: 'jiwoo', text: '좋아, 끝나면 카페에서 쉬자 ☕', at: '2026-10-26T12:44:00+09:00', read: true },
  { id: 'm3', from: 'min', to: ME, text: '에세이 목차 초안 나오면 첫 독자 해줄게', at: '2026-10-25T21:10:00+09:00', read: false, projectId: 'p-essay' },
  { id: 'b1', from: 'seo', to: 'board', text: '이번 주 목표: 각자 중간 목표 하나씩! 일요일 저녁에 회고 같이 해요', at: '2026-10-25T20:00:00+09:00', read: true },
  { id: 'b2', from: 'jiwoo', to: 'board', text: '시험 4주 남았다… 연구소 다시 불 켜보는 중', at: '2026-10-26T09:12:00+09:00', read: true },
];

export function friendName(id: string): string {
  if (id === ME) return '나';
  return FRIENDS.find((f) => f.id === id)?.name ?? id;
}

/** 나와 친구 사이의 대화(시간순) */
export function thread(messages: Message[], friendId: string): Message[] {
  return messages
    .filter((m) => (m.from === ME && m.to === friendId) || (m.from === friendId && m.to === ME))
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function unreadCount(messages: Message[], friendId?: string): number {
  return messages.filter((m) => m.to === ME && !m.read && (!friendId || m.from === friendId)).length;
}

export function relTime(at: string, now = new Date('2026-10-26T13:00:00+09:00')): string {
  const diff = Math.round((now.getTime() - new Date(at).getTime()) / 60000);
  if (diff < 1) return '방금';
  if (diff < 60) return `${diff}분 전`;
  if (diff < 60 * 24) return `${Math.floor(diff / 60)}시간 전`;
  return `${Math.floor(diff / 1440)}일 전`;
}

/** 입력 정리: 앞뒤 공백 제거, 길이 제한. 빈 문자열이면 null */
export function sanitizeMessage(raw: string): string | null {
  const t = raw.replace(/\s+\n/g, '\n').trim();
  if (!t) return null;
  return t.slice(0, MESSAGE_MAX);
}

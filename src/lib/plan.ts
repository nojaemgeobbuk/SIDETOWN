/**
 * 계획 화면 계산(기획서 6.5). 화면과 분리된 순수 함수라 테스트할 수 있다.
 * 퀘스트의 ‘하는 날’은 scheduledStart, ‘마감’은 due. 하는 날이 없는 남은 퀘스트는 보관함에 있다.
 */
import { addDays, daysBetween } from './schedule';
import type { ISODate, Milestone, Project, Quest } from './types';

export interface PlanPrefs {
  /** 평일·주말 하루 가용 시간(분) */
  weekday: number;
  weekend: number;
}
export const DEFAULT_PREFS: PlanPrefs = { weekday: 90, weekend: 180 };

export interface QuestRef {
  project: Project;
  quest: Quest;
  milestone?: Milestone;
  /** 친구 프로젝트(읽기 전용) */
  readonly: boolean;
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/** 0=일 … 6=토 */
export function dayOfWeek(d: ISODate): number {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dd)).getUTCDay();
}
export const dowLabel = (d: ISODate) => DOW[dayOfWeek(d)];
export const isWeekend = (d: ISODate) => dayOfWeek(d) === 0 || dayOfWeek(d) === 6;
export const md = (d?: string) => (d ? `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}` : '');

/** 월요일 시작 한 주 */
export function weekDays(anchor: ISODate): ISODate[] {
  const offset = (dayOfWeek(anchor) + 6) % 7;
  const mon = addDays(anchor, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

/** “10월 넷째 주” — 그 주의 목요일이 속한 달 기준 */
export function weekLabel(anchor: ISODate): string {
  const thu = weekDays(anchor)[3];
  const month = Number(thu.slice(5, 7));
  const nth = Math.ceil(Number(thu.slice(8, 10)) / 7);
  return `${month}월 ${['첫째', '둘째', '셋째', '넷째', '다섯째'][nth - 1]} 주`;
}

/** 달력 6주(42칸), 월요일 시작 */
export function monthGrid(anchor: ISODate): ISODate[] {
  const first = `${anchor.slice(0, 7)}-01`;
  const start = weekDays(first)[0];
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function capacityFor(d: ISODate, prefs: PlanPrefs = DEFAULT_PREFS): number {
  return isWeekend(d) ? prefs.weekend : prefs.weekday;
}

export function allQuests(mine: Project[], friends: Project[] = []): QuestRef[] {
  const out: QuestRef[] = [];
  for (const [list, readonly] of [[mine, false], [friends, true]] as const) {
    for (const p of list) {
      for (const q of p.quests) out.push({ project: p, quest: q, milestone: p.milestones.find((m) => m.id === q.milestoneId), readonly });
    }
  }
  return out;
}

/** 그날 하기로 한 퀘스트(끝낸 것 포함) */
export function questsOn(refs: QuestRef[], d: ISODate): QuestRef[] {
  return refs.filter((r) => r.quest.scheduledStart === d);
}

/** 그날 남은 일(분) — 끝낸 퀘스트는 빼고 */
export function dayLoad(refs: QuestRef[], d: ISODate): number {
  return questsOn(refs, d)
    .filter((r) => !r.readonly && r.quest.status !== 'done')
    .reduce((s, r) => s + r.quest.estimatedMinutes, 0);
}

/** 하는 날이 정해지지 않은 남은 퀘스트 — 마감이 가까운 순 */
export function backlog(refs: QuestRef[]): QuestRef[] {
  return refs
    .filter((r) => !r.readonly && r.quest.status !== 'done' && !r.quest.scheduledStart)
    .sort((a, b) => (a.quest.due ?? '9999').localeCompare(b.quest.due ?? '9999'));
}

/** 마감이 지났는데 안 끝난 퀘스트 */
export function overdue(refs: QuestRef[], today: ISODate): QuestRef[] {
  return refs
    .filter((r) => !r.readonly && r.quest.status !== 'done' && r.quest.due && r.quest.due < today)
    .sort((a, b) => a.quest.due!.localeCompare(b.quest.due!));
}

export interface DayStat {
  date: ISODate;
  planned: number;
  capacity: number;
  over: number;
}

export function weekStats(refs: QuestRef[], days: ISODate[], prefs: PlanPrefs = DEFAULT_PREFS): DayStat[] {
  return days.map((date) => {
    const planned = dayLoad(refs, date);
    const capacity = capacityFor(date, prefs);
    return { date, planned, capacity, over: Math.max(0, planned - capacity) };
  });
}

export interface MoveSuggestion {
  ref: QuestRef;
  from: ISODate;
  to: ISODate;
  over: number;
}

/**
 * 가용 시간을 넘긴 날이 있으면, 그날의 고정되지 않은 퀘스트 하나를
 * 같은 주의 남는 날(오늘 이후, 마감 전)로 옮기자고 제안한다. 넘친 만큼을 가장 작게 덮는 퀘스트를 고른다.
 */
export function suggestMove(refs: QuestRef[], days: ISODate[], today: ISODate, prefs: PlanPrefs = DEFAULT_PREFS): MoveSuggestion | null {
  const stats = weekStats(refs, days, prefs);
  for (const s of stats) {
    if (s.over <= 0 || s.date < today) continue;
    const movable = questsOn(refs, s.date)
      .filter((r) => !r.readonly && r.quest.status === 'todo' && !r.quest.pinned)
      .sort((a, b) => {
        const fa = a.quest.estimatedMinutes >= s.over ? 0 : 1;
        const fb = b.quest.estimatedMinutes >= s.over ? 0 : 1;
        return fa - fb || a.quest.estimatedMinutes - b.quest.estimatedMinutes;
      });
    for (const r of movable) {
      const target = stats.find(
        (o) => o.date > s.date && o.date >= today && o.capacity - o.planned >= r.quest.estimatedMinutes && (!r.quest.due || o.date <= r.quest.due),
      );
      if (target) return { ref: r, from: s.date, to: target.date, over: s.over };
    }
  }
  return null;
}

export interface Upcoming {
  date: ISODate;
  kind: 'quest' | 'milestone' | 'project';
  title: string;
  project: Project;
  questId?: string;
  readonly: boolean;
}

/** 앞으로 n일 안의 마감(퀘스트 마감·중간 목표 목표일·프로젝트 목표일) */
export function upcoming(mine: Project[], friends: Project[], today: ISODate, days = 14): Upcoming[] {
  const end = addDays(today, days);
  const out: Upcoming[] = [];
  for (const [list, readonly] of [[mine, false], [friends, true]] as const) {
    for (const p of list) {
      if (p.status === 'completed' || p.status === 'archived') continue;
      for (const q of p.quests) if (q.status !== 'done' && q.due && q.due >= today && q.due <= end) out.push({ date: q.due, kind: 'quest', title: q.title, project: p, questId: q.id, readonly });
      for (const m of p.milestones) if (m.status !== 'completed' && m.target >= today && m.target <= end) out.push({ date: m.target, kind: 'milestone', title: m.title, project: p, readonly });
      if (p.target >= today && p.target <= end) out.push({ date: p.target, kind: 'project', title: p.title, project: p, readonly });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
}

export interface TimelineScale {
  start: ISODate;
  end: ISODate;
  days: number;
  months: { date: ISODate; label: string; offset: number }[];
  x: (d: ISODate) => number; // 0..1
}

/** 타임라인 범위: 오늘 기준 앞 1달 ~ 뒤 (months)달, 월 눈금 */
export function timelineScale(today: ISODate, months = 6): TimelineScale {
  const start = `${addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7)}-01`;
  const [y, m] = start.split('-').map(Number);
  const endMonth = new Date(Date.UTC(y, m - 1 + months + 1, 1)).toISOString().slice(0, 10);
  const days = daysBetween(start, endMonth);
  const list: TimelineScale['months'] = [];
  for (let i = 0; i <= months; i++) {
    const d = new Date(Date.UTC(y, m - 1 + i, 1)).toISOString().slice(0, 10);
    list.push({ date: d, label: `${Number(d.slice(5, 7))}월`, offset: daysBetween(start, d) / days });
  }
  return { start, end: endMonth, days, months: list, x: (d) => Math.min(1, Math.max(0, daysBetween(start, d) / days)) };
}

/** 이번 주 계획(남은 일 합) / 가용 시간 합 */
export function weekSummary(refs: QuestRef[], days: ISODate[], prefs: PlanPrefs = DEFAULT_PREFS) {
  const stats = weekStats(refs, days, prefs);
  const done = days.flatMap((d) => questsOn(refs, d)).filter((r) => !r.readonly && r.quest.status === 'done');
  return {
    planned: stats.reduce((s, x) => s + x.planned, 0),
    capacity: stats.reduce((s, x) => s + x.capacity, 0),
    doneCount: done.length,
    doneMinutes: done.reduce((s, r) => s + r.quest.estimatedMinutes, 0),
  };
}

export function minutesLabel(min: number): string {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

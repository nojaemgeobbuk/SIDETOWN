import type { Condition, Health, ISODate, Milestone, Project, RescheduleResult, RescheduleScope } from './types';

/** 기획서 8.3: 누적 지연이 이 값 이상이면 건물이 낡는다. 운영 설정값으로 조정 가능. */
export const DECAY_THRESHOLD_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;

function toUTC(d: ISODate): number {
  const [y, m, dd] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, dd);
}

export function addDays(d: ISODate, n: number): ISODate {
  const t = new Date(toUTC(d) + n * DAY);
  return t.toISOString().slice(0, 10);
}

/** b - a (일). 같은 날이면 0 */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY);
}

function totalWeight(ms: Milestone[]): number {
  return ms.reduce((s, m) => s + m.weight, 0) || 1;
}

/** 실제 진척도(%) = 확정된 중간 목표의 가중 완료율 */
export function actualProgress(p: Project): number {
  const done = p.milestones.filter((m) => m.status === 'completed').reduce((s, m) => s + m.weight, 0);
  return Math.round((done / totalWeight(p.milestones)) * 100);
}

/** 계획 위치(%) = 기준선 날짜로 오늘까지 끝났어야 할 중간 목표 가중치 합(진행 중 구간은 기간 비율만큼) */
export function expectedProgress(p: Project, today: ISODate): number {
  let sum = 0;
  for (const m of p.milestones) {
    const span = Math.max(1, daysBetween(m.baselineStart, m.baselineTarget) + 1);
    const elapsed = daysBetween(m.baselineStart, today) + 1;
    const ratio = Math.min(1, Math.max(0, elapsed / span));
    sum += m.weight * ratio;
  }
  return Math.round((sum / totalWeight(p.milestones)) * 100);
}

export function health(p: Project, today: ISODate): Health {
  if (p.status === 'completed') return 'ok';
  if (daysBetween(p.target, today) > 0) return 'late';
  const diff = actualProgress(p) - expectedProgress(p, today);
  if (diff >= -5) return 'ok';
  if (diff >= -15) return 'warn';
  return 'late';
}

/** 처음(또는 마지막 재설정) 목표일 대비 누적 지연 일수. 목표일이 지났는데 미완료면 경과 일수도 센다 */
export function cumulativeDelayDays(p: Project, today: ISODate): number {
  if (p.status === 'completed') return 0;
  const moved = Math.max(0, daysBetween(p.baselineTarget, p.target));
  const overdue = Math.max(0, daysBetween(p.target, today));
  return moved + overdue;
}

/** 기획서 8.3 상태 전이. 항해 쉬기(paused)는 낡지 않는다 */
export function nextCondition(p: Project, today: ISODate): Condition {
  if (p.status !== 'active') return 'normal';
  const delay = cumulativeDelayDays(p, today);
  if (delay < DECAY_THRESHOLD_DAYS) return 'normal';
  return p.condition === 'repairing' ? 'repairing' : 'decayed';
}

/** 기획서 11절 성장 4단계 */
export function buildingStage(p: Project): 0 | 1 | 2 | 3 {
  if (p.status === 'completed') return 3;
  const done = p.milestones.filter((m) => m.status === 'completed');
  if (done.length === 0) return 0;
  if (p.milestones.length <= 1) return 1;
  const ratio = done.reduce((s, m) => s + m.weight, 0) / totalWeight(p.milestones);
  return ratio >= 0.6 ? 2 : 1;
}

/** 복구 시 지금 계획을 새 기준선으로 삼는다 */
export function rebaseline(p: Project): Project {
  return {
    ...p,
    baselineTarget: p.target,
    milestones: p.milestones.map((m) => ({ ...m, baselineStart: m.start, baselineTarget: m.target })),
    quests: p.quests.map((q) => ({ ...q, baselineDue: q.due })),
  };
}

/**
 * 기획서 8.2 일정 미루기.
 * - only: 해당 퀘스트의 예정·기한만
 * - cascade: 같은 중간 목표에서 이 퀘스트 이후 + 뒤 중간 목표 전부 + 프로젝트 목표일
 * - squeeze: 날짜는 그대로(목표일 고정). 주당 필요 시간 계산은 호출부에서
 * 완료·고정 항목은 움직이지 않고 충돌로 보고한다.
 */
export function reschedule(p: Project, questId: string, days: number, scope: RescheduleScope): RescheduleResult {
  const qi = p.quests.findIndex((q) => q.id === questId);
  if (qi < 0) throw new Error(`quest ${questId} not found`);
  const base: RescheduleResult = { project: p, targetShiftDays: 0, movedQuestIds: [], movedMilestoneIds: [], conflicts: [] };
  if (days === 0 || scope === 'squeeze') return base;

  const quest = p.quests[qi];
  const shiftQuest = (q: typeof quest) => ({
    ...q,
    scheduledStart: q.scheduledStart ? addDays(q.scheduledStart, days) : q.scheduledStart,
    due: q.due ? addDays(q.due, days) : q.due,
  });

  if (scope === 'only') {
    const quests = p.quests.map((q) => (q.id === questId ? shiftQuest(q) : q));
    return { ...base, project: { ...p, quests }, movedQuestIds: [questId] };
  }

  const msIndex = p.milestones.findIndex((m) => m.id === quest.milestoneId);
  const laterMilestones = new Set(p.milestones.slice(msIndex + 1).map((m) => m.id));
  const sameMsQuests = p.quests.filter((q) => q.milestoneId === quest.milestoneId);
  const posInMs = sameMsQuests.findIndex((q) => q.id === questId);
  const affectedQuests = new Set<string>([
    ...sameMsQuests.slice(posInMs).map((q) => q.id),
    ...p.quests.filter((q) => laterMilestones.has(q.milestoneId)).map((q) => q.id),
  ]);

  const conflicts: string[] = [];
  const movedQuestIds: string[] = [];
  const quests = p.quests.map((q) => {
    if (!affectedQuests.has(q.id) || q.status === 'done') return q;
    if (q.pinned) {
      conflicts.push(q.title);
      return q;
    }
    movedQuestIds.push(q.id);
    return shiftQuest(q);
  });

  const movedMilestoneIds: string[] = [];
  const milestones = p.milestones.map((m, i) => {
    if (i < msIndex || m.status === 'completed') return m;
    if (m.pinned) {
      conflicts.push(m.title);
      return m;
    }
    movedMilestoneIds.push(m.id);
    // 현재 중간 목표는 끝 날짜만, 뒤 목표는 시작·끝 모두 이동
    return i === msIndex
      ? { ...m, target: addDays(m.target, days) }
      : { ...m, start: addDays(m.start, days), target: addDays(m.target, days) };
  });

  const project: Project = { ...p, quests, milestones, target: addDays(p.target, days) };
  return { project, targetShiftDays: days, movedQuestIds, movedMilestoneIds, conflicts };
}

/**
 * 퀘스트·중간 목표 편집 규칙. DB 함수(add_quest·update_quest… 20261029 마이그레이션)와 같은 규칙을
 * 앱에서도 먼저 적용해 화면을 바로 바꾸고(낙관적), 데모 모드에서는 이것이 곧 저장이다.
 */
import { buildingStage } from './schedule';
import type { ISODate, Milestone, Project, Quest } from './types';

export type EditResult = { ok: true; project: Project } | { ok: false; error: string };

const ok = (project: Project): EditResult => ({ ok: true, project: { ...project, stage: buildingStage(project) } });
const fail = (error: string): EditResult => ({ ok: false, error });

const maxDate = (a: ISODate, b: ISODate) => (a > b ? a : b);

export function editable(p: Project): boolean {
  return p.status === 'active' || p.status === 'paused';
}

export interface QuestInput {
  title: string;
  estimatedMinutes?: number;
  scheduledStart?: ISODate;
  due?: ISODate;
  note?: string;
}

export function addQuest(p: Project, milestoneId: string, input: QuestInput, id: string): EditResult {
  const ms = p.milestones.find((m) => m.id === milestoneId);
  if (!ms) return fail('중간 목표를 찾을 수 없어요');
  if (ms.status === 'completed') return fail('완료한 중간 목표에는 퀘스트를 더할 수 없어요');
  const title = input.title.trim();
  if (!title) return fail('퀘스트 이름을 적어 주세요');
  const q: Quest = {
    id,
    milestoneId,
    title: title.slice(0, 80),
    estimatedMinutes: clampMinutes(input.estimatedMinutes ?? 30),
    status: 'todo',
    scheduledStart: input.scheduledStart || undefined,
    due: input.due || undefined,
    baselineDue: input.due || undefined,
    note: input.note?.trim() || undefined,
  };
  return ok({ ...p, quests: [...p.quests, q] });
}

export function updateQuest(p: Project, questId: string, patch: Partial<Quest>): EditResult {
  const q = p.quests.find((x) => x.id === questId);
  if (!q) return fail('퀘스트를 찾을 수 없어요');
  if (patch.status === 'done') return fail('완료는 체크로만 할 수 있어요');
  if (patch.milestoneId && patch.milestoneId !== q.milestoneId) {
    const m = p.milestones.find((x) => x.id === patch.milestoneId);
    if (!m) return fail('중간 목표를 찾을 수 없어요');
    if (m.status === 'completed' && q.status !== 'done') return fail('완료한 중간 목표로는 옮길 수 없어요');
  }
  if ('title' in patch && !patch.title?.trim()) return fail('퀘스트 이름을 적어 주세요');
  const next: Quest = {
    ...q,
    ...patch,
    ...(patch.title ? { title: patch.title.trim().slice(0, 80) } : {}),
    ...(patch.estimatedMinutes !== undefined ? { estimatedMinutes: clampMinutes(patch.estimatedMinutes) } : {}),
    // 처음 기한을 정할 때만 기준선. 그 뒤 변경은 지연으로 보인다
    ...('due' in patch && !q.baselineDue ? { baselineDue: patch.due } : {}),
    status: patch.status && q.status !== 'done' ? patch.status : q.status,
  };
  return ok({ ...p, quests: p.quests.map((x) => (x.id === questId ? next : x)) });
}

export function deleteQuest(p: Project, questId: string): EditResult {
  const q = p.quests.find((x) => x.id === questId);
  if (!q) return fail('퀘스트를 찾을 수 없어요');
  if (q.status === 'done') return fail('끝낸 퀘스트는 지울 수 없어요. 완료를 먼저 취소해 주세요');
  return ok({ ...p, quests: p.quests.filter((x) => x.id !== questId) });
}

export interface MilestoneInput {
  title: string;
  criteria?: string;
  weight?: number;
  start: ISODate;
  target: ISODate;
}

export function addMilestone(p: Project, input: MilestoneInput, id: string): EditResult {
  if (!editable(p)) return fail('지금 상태에서는 편집할 수 없어요');
  if (p.milestones.length >= 12) return fail('중간 목표는 12개까지예요');
  if (!input.title.trim()) return fail('중간 목표 이름을 적어 주세요');
  if (input.target < input.start) return fail('끝 날짜가 시작 날짜보다 빨라요');
  const hasOpen = p.milestones.some((m) => m.status !== 'completed');
  const m: Milestone = {
    id,
    title: input.title.trim().slice(0, 80),
    criteria: input.criteria?.trim() ?? '',
    weight: Math.min(10, Math.max(1, input.weight ?? 1)),
    status: hasOpen ? 'planned' : 'active',
    start: input.start,
    target: input.target,
    baselineStart: input.start,
    baselineTarget: input.target,
  };
  return ok({ ...p, milestones: [...p.milestones, m], target: maxDate(p.target, input.target) });
}

export function updateMilestone(p: Project, milestoneId: string, patch: Partial<Milestone>): EditResult {
  const m = p.milestones.find((x) => x.id === milestoneId);
  if (!m) return fail('중간 목표를 찾을 수 없어요');
  if ('title' in patch && !patch.title?.trim()) return fail('중간 목표 이름을 적어 주세요');
  const dates = m.status === 'completed' ? {} : { ...(patch.start ? { start: patch.start } : {}), ...(patch.target ? { target: patch.target } : {}) };
  const next: Milestone = {
    ...m,
    ...(patch.title !== undefined ? { title: patch.title.trim().slice(0, 80) } : {}),
    ...(patch.criteria !== undefined ? { criteria: patch.criteria } : {}),
    ...(patch.weight !== undefined ? { weight: Math.min(10, Math.max(1, patch.weight)) } : {}),
    ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
    ...dates,
  };
  if (next.target < next.start) return fail('끝 날짜가 시작 날짜보다 빨라요');
  const milestones = p.milestones.map((x) => (x.id === milestoneId ? next : x));
  return ok({ ...p, milestones, target: milestones.reduce((d, x) => maxDate(d, x.target), p.target) });
}

export function deleteMilestone(p: Project, milestoneId: string): EditResult {
  const m = p.milestones.find((x) => x.id === milestoneId);
  if (!m) return fail('중간 목표를 찾을 수 없어요');
  if (m.status === 'completed' || p.quests.some((q) => q.milestoneId === milestoneId && q.status === 'done')) {
    return fail('완료한 일이 있는 중간 목표는 지울 수 없어요');
  }
  if (p.milestones.length <= 1) return fail('중간 목표는 하나 이상 있어야 해요');
  let milestones = p.milestones.filter((x) => x.id !== milestoneId);
  if (m.status === 'active') {
    const next = milestones.find((x) => x.status === 'planned');
    if (next) milestones = milestones.map((x) => (x.id === next.id ? { ...x, status: 'active' } : x));
  }
  return ok({ ...p, milestones, quests: p.quests.filter((q) => q.milestoneId !== milestoneId) });
}

/** 다른 마을로 복사: 진행 상황은 그대로, 새 id */
export function copyProject(p: Project, newId: (kind: string) => string, plotId: string): Project {
  const mids = new Map(p.milestones.map((m) => [m.id, newId('m')]));
  return {
    ...p,
    id: newId('p'),
    plotId: p.hallAt ? '' : plotId,
    copiedFrom: p.id,
    ownerId: p.ownerId,
    milestones: p.milestones.map((m) => ({ ...m, id: mids.get(m.id)! })),
    quests: p.quests.map((q) => ({ ...q, id: newId('q'), milestoneId: mids.get(q.milestoneId)! })),
  };
}

function clampMinutes(n: number) {
  return Math.min(600, Math.max(1, Math.round(n || 30)));
}

/** 철거 남은 시간(ms). 철거 중이 아니면 null */
export function demolishRemaining(p: Pick<Project, 'status' | 'demolishEndsAt'>, now = Date.now()): number | null {
  if (p.status !== 'demolishing' || !p.demolishEndsAt) return null;
  return Math.max(0, new Date(p.demolishEndsAt).getTime() - now);
}

export const DEMOLISH_MS = 60 * 60 * 1000;

/** 마을 지도에 서 있는 건물인가(명예의 전당·철거 끝·부지 없음 제외) */
export function onMap(p: Project, now = Date.now()): boolean {
  if (!p.plotId || p.hallAt || p.status === 'archived') return false;
  if (p.status === 'demolishing') return (demolishRemaining(p, now) ?? 0) > 0;
  return true;
}

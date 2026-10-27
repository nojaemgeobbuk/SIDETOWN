'use client';

/**
 * 서버 모드 데이터 계층. 읽기는 RLS가 걸린 표 조회, 쓰기는 전부 RPC(security definer 함수).
 * 날짜 계산(미루기)은 schedule.ts 순수 함수가 하고 서버에는 바뀐 날짜만 보낸다.
 */
import { supabaseBrowser } from './supabase/client';
import { toFriend, type Friend, type Message } from './social';
import type { ISODate, Milestone, Project, Quest, RescheduleScope } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export interface TownSnapshot {
  townId: string;
  townName: string;
  ownerId: string;
  me: Friend;
  friends: Friend[];
  projects: Project[];
  townProjects: Project[];
  messages: Message[];
  xp: number;
  today: ISODate;
}

/** 사용자 시간대 기준 오늘(YYYY-MM-DD) */
export function localToday(timeZone?: string): ISODate {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const key = () => crypto.randomUUID();

function unwrap<T>(r: { data: T; error: { message: string; code?: string } | null }): T {
  if (r.error) throw new LiveError(r.error.message, r.error.code);
  return r.data;
}

export class LiveError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

/** 서버 오류 → 사용자에게 보일 말 */
export function friendlyError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/rate limited/.test(m)) return '쪽지를 너무 빨리 보내고 있어요. 잠시 뒤에 다시 보내 주세요';
  if (/town full/.test(m)) return '마을 정원(8명)이 다 찼어요';
  if (/already in a town/.test(m)) return '이미 다른 마을에 살고 있어요';
  if (/invite invalid/.test(m)) return '초대 링크가 만료됐거나 더 이상 쓸 수 없어요';
  if (/version conflict/.test(m)) return '다른 기기에서 일정이 바뀌었어요. 최신 일정으로 다시 불러왔어요';
  if (/evidence required/.test(m)) return '성과 기록을 한 줄 남겨 주세요';
  if (/open quests remain/.test(m)) return '남은 퀘스트를 먼저 끝내 주세요';
  if (/projects_town_id_plot_id_key|duplicate key/.test(m)) return '그 부지는 이미 쓰고 있어요. 다른 빈 부지를 골라 주세요';
  if (/not authenticated|JWT/.test(m)) return '로그인이 만료됐어요. 다시 로그인해 주세요';
  if (/Failed to fetch|NetworkError/.test(m)) return '연결이 불안정해요. 잠시 뒤에 다시 시도해 주세요';
  return '저장하지 못했어요. 잠시 뒤에 다시 시도해 주세요';
}

const opt = <T,>(v: T | null | undefined) => (v === null ? undefined : v);

function toMilestone(r: Row): Milestone {
  return {
    id: r.id, title: r.title, criteria: r.criteria, weight: r.weight, status: r.status,
    start: r.start_date, target: r.target_date, baselineStart: r.baseline_start_date, baselineTarget: r.baseline_target_date,
    pinned: r.pinned || undefined, evidence: opt(r.evidence),
  };
}

function toQuest(r: Row): Quest {
  return {
    id: r.id, milestoneId: r.milestone_id, title: r.title, estimatedMinutes: r.estimated_minutes, status: r.status,
    scheduledStart: opt(r.scheduled_start), due: opt(r.due_date), baselineDue: opt(r.baseline_due_date), pinned: r.pinned || undefined,
  };
}

function toProject(r: Row, milestones: Milestone[], quests: Quest[]): Project {
  return {
    id: r.id, title: r.title, building: r.building, color: r.color, plotId: r.plot_id ?? '',
    definitionOfDone: r.definition_of_done, start: r.start_date, target: r.target_date, baselineTarget: r.baseline_target_date,
    status: r.status, condition: r.condition, milestones, quests,
    ownerId: r.owner_id, stage: r.stage, planVersion: r.plan_version,
  };
}

export async function loadTown(meId: string): Promise<TownSnapshot> {
  const sb = supabaseBrowser();
  const today = localToday();
  // 오늘 기준으로 내 건물의 낡음 상태를 먼저 맞춘다(매일 배치 대신)
  await sb.rpc('refresh_my_conditions', { p_today: today });

  const [town, members, profiles, projects, milestones, quests, messages, reads, xp] = await Promise.all([
    sb.from('towns').select('id, name, owner_id').maybeSingle(),
    sb.from('town_members').select('user_id, role'),
    sb.from('profiles').select('user_id, nickname'),
    sb.from('projects').select('*').neq('status', 'archived').order('created_at'),
    sb.from('milestones').select('*').order('position'),
    sb.from('quests').select('*').order('position'),
    sb.from('messages').select('*').order('created_at', { ascending: false }).limit(300),
    sb.from('message_reads').select('message_id'),
    sb.rpc('my_xp'),
  ]);
  const t = unwrap(town as any) as Row | null;
  if (!t) throw new LiveError('no town');
  const names = new Map<string, string>((unwrap(profiles as any) as Row[]).map((p) => [p.user_id, p.nickname]));
  const memberRows = unwrap(members as any) as Row[];
  const ms = (unwrap(milestones as any) as Row[]).map((r) => ({ projectId: r.project_id as string, m: toMilestone(r) }));
  const qs = (unwrap(quests as any) as Row[]).map((r) => ({ projectId: r.project_id as string, q: toQuest(r) }));
  const allProjects = (unwrap(projects as any) as Row[]).map((r) =>
    toProject(r, ms.filter((x) => x.projectId === r.id).map((x) => x.m), qs.filter((x) => x.projectId === r.id).map((x) => x.q)),
  );
  const readSet = new Set((unwrap(reads as any) as Row[]).map((r) => r.message_id));
  const msgs: Message[] = (unwrap(messages as any) as Row[])
    .reverse()
    .map((r) => ({
      id: r.id, from: r.sender_id, to: r.recipient_id ?? 'board', text: r.body, at: r.created_at,
      read: r.sender_id === meId || r.recipient_id === null || readSet.has(r.id), projectId: opt(r.project_id),
    }));

  return {
    townId: t.id,
    townName: t.name,
    ownerId: t.owner_id,
    me: toFriend(meId, names.get(meId) ?? '나', 'online'),
    friends: memberRows.filter((m) => m.user_id !== meId).map((m) => toFriend(m.user_id, names.get(m.user_id) ?? '이웃')),
    projects: allProjects.filter((p) => p.ownerId === meId),
    townProjects: allProjects.filter((p) => p.ownerId !== meId),
    messages: msgs,
    xp: (unwrap(xp as any) as number) ?? 0,
    today,
  };
}

const rpc = async <T = unknown,>(fn: string, args: Record<string, unknown>): Promise<T> =>
  unwrap((await supabaseBrowser().rpc(fn, args)) as any) as T;

export const live = {
  completeQuest: (questId: string) => rpc('complete_quest', { p_quest: questId, p_key: key() }),
  reopenQuest: (questId: string) => rpc('reopen_quest', { p_quest: questId, p_key: key() }),
  startWork: (projectId: string, questId?: string) => rpc('start_work', { p_project: projectId, p_quest: questId ?? null }),
  completeMilestone: (milestoneId: string, evidence: string) =>
    rpc('complete_milestone', { p_milestone: milestoneId, p_evidence: evidence, p_key: key() }),
  setPaused: (projectId: string, paused: boolean, today: ISODate) =>
    rpc('set_paused', { p_project: projectId, p_paused: paused, p_today: today }),
  sendMessage: (to: string | null, body: string, projectId?: string) =>
    rpc<string>('send_message', { p_to: to, p_body: body, p_project: projectId ?? null }),
  markRead: (from: string) => rpc('mark_read', { p_from: from }),
  createInvite: () => rpc<string>('create_invite', {}),

  createProject: (p: Project) =>
    rpc<string>('create_project', {
      p: {
        title: p.title, building: p.building, color: p.color, definition_of_done: p.definitionOfDone, plot_id: p.plotId,
        start_date: p.start, target_date: p.target,
        milestones: p.milestones.map((m) => ({ title: m.title, criteria: m.criteria, weight: m.weight, start_date: m.start, target_date: m.target })),
        first_quest: p.quests[0]
          ? { title: p.quests[0].title, estimated_minutes: p.quests[0].estimatedMinutes, due_date: p.quests[0].due ?? null }
          : undefined,
      },
    }),

  /** 미루기 결과(after)와 원래 계획(before)의 차이만 보낸다 */
  applySchedule: (before: Project, after: Project, scope: RescheduleScope, days: number, today: ISODate) =>
    rpc('apply_schedule', {
      p_project: before.id,
      p_version: before.planVersion ?? 1,
      p_scope: scope,
      p_days: days,
      p_today: today,
      p_changes: scheduleDiff(before, after),
    }),
};

export function scheduleDiff(before: Project, after: Project) {
  const changes: { target_date?: string; milestones: Row[]; quests: Row[] } = { milestones: [], quests: [] };
  if (after.target !== before.target) changes.target_date = after.target;
  for (const m of after.milestones) {
    const o = before.milestones.find((x) => x.id === m.id);
    if (o && (o.start !== m.start || o.target !== m.target)) changes.milestones.push({ id: m.id, start_date: m.start, target_date: m.target });
  }
  for (const q of after.quests) {
    const o = before.quests.find((x) => x.id === q.id);
    if (o && (o.scheduledStart !== q.scheduledStart || o.due !== q.due))
      changes.quests.push({ id: q.id, scheduled_start: q.scheduledStart ?? null, due_date: q.due ?? null });
  }
  return changes;
}

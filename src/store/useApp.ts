'use client';

import { create } from 'zustand';
import { sampleProjects, SAMPLE_TODAY } from '@/lib/sample-data';
import { addDays, buildingStage, nextCondition, rebaseline, reschedule } from '@/lib/schedule';
import type { ISODate, Project, RescheduleScope } from '@/lib/types';
import { ME, sampleMessages, sanitizeMessage, type Message } from '@/lib/social';
import { createProject, type NewProjectInput } from '@/lib/templates';

/** 패널에 열린 장소. 프로젝트가 아닌 곳(카페·집·빈 부지·쪽지함) */
export type View =
  | { kind: 'cafe' }
  | { kind: 'home' }
  | { kind: 'new'; plotId: string }
  | { kind: 'inbox'; friendId?: string };

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'warn';
}

interface AppState {
  projects: Project[];
  today: ISODate;
  selectedId: string | null;
  xp: number;
  listMode: boolean;
  toast: Toast | null;
  /** 성장 연출을 위한 마지막 단계 변화 */
  lastGrowth: { projectId: string; stage: number; at: number } | null;
  view: View | null;
  messages: Message[];

  select: (id: string | null) => void;
  openView: (v: View | null) => void;
  sendMessage: (to: string, text: string, projectId?: string) => boolean;
  markRead: (friendId: string) => void;
  addProject: (input: Omit<NewProjectInput, 'today'>) => void;
  setListMode: (on: boolean) => void;
  notify: (text: string, tone?: Toast['tone']) => void;
  toggleQuest: (projectId: string, questId: string) => void;
  startWork: (projectId: string, questId?: string) => void;
  completeMilestone: (projectId: string, milestoneId: string, evidence: string) => void;
  postpone: (projectId: string, days: number, scope: RescheduleScope) => void;
  togglePause: (projectId: string) => void;
  advanceDays: (n: number) => void;
  reset: () => void;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
let toastSeq = 1;

function updateProject(projects: Project[], id: string, fn: (p: Project) => Project): Project[] {
  return projects.map((p) => (p.id === id ? fn(p) : p));
}

export const useApp = create<AppState>((set, get) => ({
  projects: clone(sampleProjects),
  today: SAMPLE_TODAY,
  selectedId: null,
  xp: 620,
  listMode: false,
  toast: null,
  lastGrowth: null,
  view: null,
  messages: clone(sampleMessages),

  select: (id) => set({ selectedId: id, view: null }),
  openView: (v) => set({ view: v, selectedId: null }),
  sendMessage: (to, text, projectId) => {
    const clean = sanitizeMessage(text);
    if (!clean) return false;
    const m: Message = { id: `m-${Date.now().toString(36)}`, from: ME, to, text: clean, at: new Date().toISOString(), read: true, projectId };
    set({ messages: [...get().messages, m] });
    return true;
  },
  markRead: (friendId) =>
    set({ messages: get().messages.map((m) => (m.from === friendId && m.to === ME && !m.read ? { ...m, read: true } : m)) }),
  addProject: (input) => {
    const p = createProject({ ...input, today: get().today });
    set({ projects: [...get().projects, p], view: null, selectedId: p.id, xp: get().xp + 5 });
    get().notify(`‘${p.title}’ 착공! 첫 퀘스트부터 시작해요`, 'good');
  },
  setListMode: (on) => set({ listMode: on }),
  notify: (text, tone = 'info') => set({ toast: { id: toastSeq++, text, tone } }),

  toggleQuest: (projectId, questId) => {
    const { projects, notify } = get();
    const p = projects.find((x) => x.id === projectId);
    const q = p?.quests.find((x) => x.id === questId);
    if (!p || !q) return;
    if (q.status === 'done') {
      // 완료 취소: 같은 사건의 보상만 역산(기획서 10절)
      set({
        projects: updateProject(projects, projectId, (pp) => ({
          ...pp,
          quests: pp.quests.map((x) => (x.id === questId ? { ...x, status: 'todo' } : x)),
        })),
        xp: Math.max(0, get().xp - 10),
      });
      notify('완료를 취소했어요 · −10 XP');
      return;
    }
    let restored = false;
    const next = updateProject(projects, projectId, (pp) => {
      let np: Project = { ...pp, quests: pp.quests.map((x) => (x.id === questId ? { ...x, status: 'done' } : x)) };
      if (np.condition !== 'normal') {
        // 기획서 8.3: 퀘스트 1개 완료 → 복구 + 기준선 재설정
        np = { ...rebaseline(np), condition: 'normal' };
        restored = true;
      }
      return np;
    });
    set({ projects: next, xp: get().xp + 10 });
    notify(restored ? '불이 다시 켜졌어요 · 건물 복구 · +10 XP' : '퀘스트 완료 · +10 XP', 'good');
  },

  startWork: (projectId, questId) => {
    const { projects, notify } = get();
    const p = projects.find((x) => x.id === projectId);
    if (!p) return;
    const targetQuest = questId ?? p.quests.find((q) => q.status !== 'done')?.id;
    const wasDecayed = p.condition === 'decayed';
    set({
      projects: updateProject(projects, projectId, (pp) => ({
        ...pp,
        condition: pp.condition === 'decayed' ? 'repairing' : pp.condition,
        quests: pp.quests.map((q) =>
          q.id === targetQuest && q.status === 'todo' ? { ...q, status: 'doing' } : q.status === 'doing' && q.id !== targetQuest ? { ...q, status: 'todo' } : q,
        ),
      })),
    });
    if (wasDecayed) notify('수리를 시작했어요 · 퀘스트 하나를 끝내면 다시 불이 켜져요', 'info');
  },

  completeMilestone: (projectId, milestoneId, evidence) => {
    const { projects, notify } = get();
    const before = projects.find((x) => x.id === projectId);
    if (!before) return;
    const stageBefore = buildingStage(before);
    const next = updateProject(projects, projectId, (pp) => {
      const idx = pp.milestones.findIndex((m) => m.id === milestoneId);
      const milestones = pp.milestones.map((m, i) =>
        m.id === milestoneId ? { ...m, status: 'completed' as const, evidence } : i === idx + 1 && m.status === 'planned' ? { ...m, status: 'active' as const } : m,
      );
      const allDone = milestones.every((m) => m.status === 'completed');
      return { ...pp, milestones, status: allDone ? 'completed' : pp.status };
    });
    const after = next.find((x) => x.id === projectId)!;
    const stageAfter = buildingStage(after);
    set({
      projects: next,
      xp: get().xp + 50 + (after.status === 'completed' ? 150 : 0),
      lastGrowth: stageAfter > stageBefore ? { projectId, stage: stageAfter, at: Date.now() } : get().lastGrowth,
    });
    notify(stageAfter > stageBefore ? `중간 목표 완료 · 건물이 ${stageAfter}단계로 자랐어요 · +50 XP` : '중간 목표 완료 · +50 XP', 'good');
  },

  postpone: (projectId, days, scope) => {
    const { projects, today, notify } = get();
    const p = projects.find((x) => x.id === projectId);
    const q = p?.quests.find((x) => x.status !== 'done');
    if (!p || !q) return;
    const r = reschedule(p, q.id, days, scope);
    const np = { ...r.project, condition: nextCondition(r.project, today) };
    set({ projects: updateProject(projects, projectId, () => np) });
    if (np.condition === 'decayed' && p.condition === 'normal') notify('누적 지연이 30일을 넘어 건물이 잠시 낡았어요', 'warn');
    else notify(scope === 'cascade' ? `뒤 일정까지 ${days}일 함께 미뤘어요` : `‘${q.title}’만 ${days}일 미뤘어요`);
  },

  togglePause: (projectId) => {
    const { projects, today, notify } = get();
    const next = updateProject(projects, projectId, (pp) => {
      const status = pp.status === 'paused' ? 'active' : pp.status === 'active' ? 'paused' : pp.status;
      const np = { ...pp, status } as Project;
      return { ...np, condition: nextCondition(np, today) };
    });
    set({ projects: next });
    const p = next.find((x) => x.id === projectId)!;
    notify(p.status === 'paused' ? '항해 쉬기 · 이 프로젝트는 낡지 않아요' : '항해를 다시 시작했어요');
  },

  advanceDays: (n) => {
    const today = addDays(get().today, n);
    set({
      today,
      projects: get().projects.map((p) => ({ ...p, condition: nextCondition(p, today) })),
    });
    get().notify(`검증용 시간 이동 · 오늘 ${today}`);
  },

  reset: () =>
    set({ projects: clone(sampleProjects), today: SAMPLE_TODAY, xp: 620, selectedId: null, lastGrowth: null, toast: null, view: null, messages: clone(sampleMessages) }),
}));

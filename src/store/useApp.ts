'use client';

import { create } from 'zustand';
import { sampleProjects, SAMPLE_TODAY } from '@/lib/sample-data';
import { addDays, buildingStage, nextCondition, rebaseline, reschedule } from '@/lib/schedule';
import type { ISODate, Project, RescheduleScope } from '@/lib/types';
import { FRIENDS, ME, sampleMessages, sanitizeMessage, toFriend, type Friend, type Message } from '@/lib/social';
import { createProject, type NewProjectInput } from '@/lib/templates';
import { friendlyError, live, loadTown } from '@/lib/live';

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

/** demo: 로그인 없이 이 브라우저에만 저장 · live: Supabase */
export type Mode = 'demo' | 'live';

export interface Presence {
  status: 'focus' | 'online';
  plotId?: string;
  since?: number;
}

interface AppState {
  mode: Mode;
  booted: boolean;
  meId: string;
  me: Friend;
  friends: Friend[];
  townId: string | null;
  townName: string;
  townOwnerId: string | null;
  /** 내 프로젝트(편집 가능) */
  projects: Project[];
  /** 같은 마을 친구의 프로젝트(겉모습만, 읽기 전용) */
  townProjects: Project[];
  today: ISODate;
  selectedId: string | null;
  xp: number;
  listMode: boolean;
  toast: Toast | null;
  /** 성장 연출을 위한 마지막 단계 변화 */
  lastGrowth: { projectId: string; stage: number; at: number } | null;
  view: View | null;
  messages: Message[];

  boot: (opts: { mode: Mode; meId?: string }) => void;
  reload: () => Promise<void>;
  applyPresence: (byUser: Record<string, Presence>) => void;
  select: (id: string | null) => void;
  openView: (v: View | null) => void;
  sendMessage: (to: string, text: string, projectId?: string) => boolean;
  markRead: (friendId: string) => void;
  createInvite: () => Promise<string | null>;
  addProject: (input: Omit<NewProjectInput, 'today'> & { draft?: Pick<Project, 'milestones'> }) => Promise<void>;
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
const DEMO_KEY = 'sidetown-demo-v1';

function updateProject(projects: Project[], id: string, fn: (p: Project) => Project): Project[] {
  return projects.map((p) => (p.id === id ? fn(p) : p));
}

function demoInitial() {
  return { projects: clone(sampleProjects), today: SAMPLE_TODAY, xp: 620, messages: clone(sampleMessages) };
}

function readDemo(): ReturnType<typeof demoInitial> | null {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return Array.isArray(v?.projects) && Array.isArray(v?.messages) ? v : null;
  } catch {
    return null;
  }
}

let reloadTimer: ReturnType<typeof setTimeout> | null = null;

export const useApp = create<AppState>((set, get) => {
  /** 서버 모드에서만: 화면은 먼저 바꾸고(낙관적), 저장이 실패하면 서버 상태로 되돌린다 */
  const remote = (fn: () => Promise<unknown>) => {
    if (get().mode !== 'live') return;
    fn()
      .then(() => scheduleReload())
      .catch((e) => {
        get().notify(friendlyError(e), 'warn');
        void get().reload();
      });
  };
  const scheduleReload = (ms = 400) => {
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => void get().reload(), ms);
  };

  return {
    mode: 'demo',
    booted: false,
    meId: ME,
    me: toFriend(ME, '나', 'online'),
    friends: FRIENDS,
    townId: null,
    townName: '노을 마을',
    townOwnerId: ME,
    ...demoInitial(),
    townProjects: [],
    selectedId: null,
    listMode: false,
    toast: null,
    lastGrowth: null,
    view: null,

    boot: ({ mode, meId }) => {
      if (get().booted) return;
      if (mode === 'live' && meId) {
        set({ mode, meId, booted: true, projects: [], messages: [], friends: [], xp: 0, townProjects: [] });
        void get().reload();
        return;
      }
      const saved = readDemo();
      set({ mode: 'demo', booted: true, ...(saved ?? {}) });
      // 데모 모드는 이 브라우저에만 저장한다
      useApp.subscribe((s) => {
        try {
          localStorage.setItem(DEMO_KEY, JSON.stringify({ projects: s.projects, today: s.today, xp: s.xp, messages: s.messages }));
        } catch {
          /* 저장소를 쓸 수 없으면 메모리에서만 유지 */
        }
      });
    },

    reload: async () => {
      const { mode, meId } = get();
      if (mode !== 'live') return;
      try {
        const snap = await loadTown(meId);
        const prev = get();
        // 친구 상태(접속·집중)는 Presence가 정하므로 유지
        const status = new Map(prev.friends.map((f) => [f.id, f]));
        set({
          projects: snap.projects,
          townProjects: snap.townProjects,
          messages: snap.messages,
          xp: snap.xp,
          today: snap.today,
          townId: snap.townId,
          townName: snap.townName,
          townOwnerId: snap.ownerId,
          me: snap.me,
          friends: snap.friends.map((f) => {
            const s = status.get(f.id);
            return s ? { ...f, status: s.status, plotId: s.plotId, focusMinutes: s.focusMinutes } : f;
          }),
        });
      } catch (e) {
        get().notify(friendlyError(e), 'warn');
      }
    },

    applyPresence: (byUser) =>
      set({
        friends: get().friends.map((f) => {
          const p = byUser[f.id];
          if (!p) return { ...f, status: 'offline', plotId: undefined, focusMinutes: undefined };
          return {
            ...f,
            status: p.status,
            plotId: p.plotId,
            focusMinutes: p.since ? Math.max(0, Math.round((Date.now() - p.since) / 60000)) : undefined,
          };
        }),
      }),

    select: (id) => set({ selectedId: id, view: null }),
    openView: (v) => set({ view: v, selectedId: null }),

    sendMessage: (to, text, projectId) => {
      const clean = sanitizeMessage(text);
      if (!clean) return false;
      const { meId } = get();
      const m: Message = { id: `local-${Date.now().toString(36)}`, from: meId, to, text: clean, at: new Date().toISOString(), read: true, projectId };
      set({ messages: [...get().messages, m] });
      remote(() => live.sendMessage(to === 'board' ? null : to, clean, projectId));
      return true;
    },

    markRead: (friendId) => {
      const { meId } = get();
      set({ messages: get().messages.map((m) => (m.from === friendId && m.to === meId && !m.read ? { ...m, read: true } : m)) });
      if (get().mode === 'live') live.markRead(friendId).catch(() => undefined);
    },

    createInvite: async () => {
      if (get().mode !== 'live') {
        get().notify('초대 링크는 로그인한 마을에서 만들 수 있어요');
        return null;
      }
      try {
        const token = await live.createInvite();
        return `${window.location.origin}/invite/${token}`;
      } catch (e) {
        get().notify(friendlyError(e), 'warn');
        return null;
      }
    },

    addProject: async ({ draft, ...input }) => {
      let p = createProject({ ...input, today: get().today });
      // AI 초안의 완료 기준·가중치를 살린다(날짜는 createProject가 고르게 나눈 값)
      if (draft) {
        p = {
          ...p,
          milestones: p.milestones.map((m, i) => ({
            ...m,
            criteria: draft.milestones[i]?.criteria || m.criteria,
            weight: draft.milestones[i]?.weight || m.weight,
          })),
        };
      }
      if (get().mode === 'live') {
        try {
          const id = await live.createProject(p);
          await get().reload();
          set({ view: null, selectedId: id });
          get().notify(`‘${p.title}’ 착공! 첫 퀘스트부터 시작해요`, 'good');
        } catch (e) {
          get().notify(friendlyError(e), 'warn');
        }
        return;
      }
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
        remote(() => live.reopenQuest(questId));
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
      remote(() => live.completeQuest(questId));
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
      remote(() => live.startWork(projectId, targetQuest));
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
      remote(() => live.completeMilestone(milestoneId, evidence));
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
      remote(() => live.applySchedule(p, np, scope, days, today));
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
      remote(() => live.setPaused(projectId, p.status === 'paused', today));
    },

    advanceDays: (n) => {
      if (get().mode === 'live') return;
      const today = addDays(get().today, n);
      set({
        today,
        projects: get().projects.map((p) => ({ ...p, condition: nextCondition(p, today) })),
      });
      get().notify(`검증용 시간 이동 · 오늘 ${today}`);
    },

    reset: () => {
      if (get().mode === 'live') return;
      set({ ...demoInitial(), selectedId: null, lastGrowth: null, toast: null, view: null });
    },
  };
});

/** 마을에 그릴 모든 프로젝트(내 것 + 친구 것) */
export const allTownProjects = (s: Pick<AppState, 'projects' | 'townProjects'>) => [...s.projects, ...s.townProjects];

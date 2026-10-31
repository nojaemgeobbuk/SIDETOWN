'use client';

import { create } from 'zustand';
import { sampleFriendProjects, sampleProjects, sampleTown2, SAMPLE_TODAY } from '@/lib/sample-data';
import { addDays, buildingStage, nextCondition, rebaseline, reschedule } from '@/lib/schedule';
import type { Avatar, ISODate, Milestone, Project, Quest, RescheduleScope, TownSummary } from '@/lib/types';
import { FRIENDS, ME, sampleMessages, sanitizeMessage, toFriend, type Friend, type Message } from '@/lib/social';
import { createProject, type NewProjectInput } from '@/lib/templates';
import { friendlyError, live, loadTown } from '@/lib/live';
import * as edit from '@/lib/edit';
import { DEFAULT_PREFS, type PlanPrefs } from '@/lib/plan';
import { EMPTY_PLOTS } from '@/town/map';

/** 패널에 열린 장소. 프로젝트가 아닌 곳(카페·집·빈 부지·쪽지함·명예의 전당) */
export type View =
  | { kind: 'cafe' }
  | { kind: 'home'; tab?: 'room' | 'look' }
  | { kind: 'new'; plotId: string }
  | { kind: 'inbox'; friendId?: string }
  | { kind: 'hall' };

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

/** 데모 모드에서 지금 보고 있지 않은 마을 */
interface TownData {
  id: string;
  name: string;
  ownerId: string;
  friends: Friend[];
  projects: Project[];
  townProjects: Project[];
  messages: Message[];
  expansions?: string[];
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
  towns: TownSummary[];
  /** 내 프로젝트(편집 가능) */
  projects: Project[];
  /** 같은 마을 친구의 프로젝트(읽기 전용). 공개 범위에 따라 세부 일정이 비어 있을 수 있다 */
  townProjects: Project[];
  today: ISODate;
  prefs: PlanPrefs;
  selectedId: string | null;
  xp: number;
  listMode: boolean;
  toast: Toast | null;
  /** 성장 연출을 위한 마지막 단계 변화 */
  lastGrowth: { projectId: string; stage: number; at: number } | null;
  view: View | null;
  messages: Message[];
  demoTowns: Record<string, TownData>;
  /** 이 마을에 열린 땅 구역 */
  expansions: string[];
  /** 땅 넓히기 창 */
  expandOpen: boolean;

  boot: (opts: { mode: Mode; meId?: string }) => void;
  reload: () => Promise<void>;
  tickClock: () => void;
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
  postpone: (projectId: string, days: number, scope: RescheduleScope, questId?: string) => void;
  togglePause: (projectId: string) => void;

  // 편집(기획서 8.1) — 성공하면 true
  addQuest: (projectId: string, milestoneId: string, input: edit.QuestInput) => boolean;
  updateQuest: (projectId: string, questId: string, patch: Partial<Quest>) => boolean;
  deleteQuest: (projectId: string, questId: string) => boolean;
  addMilestone: (projectId: string, input: edit.MilestoneInput) => boolean;
  updateMilestone: (projectId: string, milestoneId: string, patch: Partial<Milestone>) => boolean;
  deleteMilestone: (projectId: string, milestoneId: string) => boolean;
  updateProject: (projectId: string, patch: Partial<Pick<Project, 'title' | 'definitionOfDone' | 'color' | 'visibility'>>) => boolean;

  // 철거·명예의 전당
  startDemolition: (projectId: string) => void;
  cancelDemolition: (projectId: string) => void;
  moveToHall: (projectId: string) => void;

  // 여러 마을
  switchTown: (townId: string) => Promise<void>;
  createTown: (name: string) => Promise<void>;
  copyProject: (projectId: string, townId: string) => Promise<void>;

  setExpandOpen: (v: boolean) => void;
  /** 광고 시작 기록(서버가 자격 확인). 실패하면 null */
  startExpansionAd: () => Promise<{ session: string; slot: string } | null>;
  /** 광고를 끝까지 봤을 때 땅을 연다 */
  claimExpansion: (session: string) => Promise<string | null>;

  saveAvatar: (a: Avatar) => void;
  savePrefs: (p: PlanPrefs) => void;

  advanceDays: (n: number) => void;
  reset: () => void;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
let toastSeq = 1;
let idSeq = 1;
const localId = (k: string) => `${k}-${Date.now().toString(36)}-${idSeq++}`;
const DEMO_KEY = 'sidetown-demo-v2';

function updateProject(projects: Project[], id: string, fn: (p: Project) => Project): Project[] {
  return projects.map((p) => (p.id === id ? fn(p) : p));
}

function demoInitial() {
  const t2 = clone(sampleTown2);
  return {
    townId: 'demo-main',
    townName: '노을 마을',
    townOwnerId: ME,
    friends: FRIENDS,
    projects: clone(sampleProjects),
    townProjects: clone(sampleFriendProjects),
    messages: clone(sampleMessages),
    today: SAMPLE_TODAY,
    xp: 620,
    prefs: DEFAULT_PREFS,
    me: toFriend(ME, '나', 'online'),
    expansions: [] as string[],
    demoTowns: {
      [t2.id]: {
        id: t2.id,
        name: t2.name,
        ownerId: 'harin',
        friends: t2.friends.map((f) => toFriend(f.id, f.name, 'online')),
        projects: [],
        townProjects: t2.townProjects,
        messages: [],
      },
    } as Record<string, TownData>,
  };
}

type DemoSave = ReturnType<typeof demoInitial>;
const DEMO_FIELDS = ['townId', 'townName', 'townOwnerId', 'friends', 'projects', 'townProjects', 'messages', 'today', 'xp', 'prefs', 'me', 'demoTowns', 'expansions'] as const;
const EXPANSION_ORDER = ['e1', 's1', 'e2', 's2'];
/** 데모 광고 세션(시작 시각) */
const demoAdSessions = new Map<string, number>();

function readDemo(): Partial<DemoSave> | null {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return Array.isArray(v?.projects) && Array.isArray(v?.messages) && v?.demoTowns ? v : null;
  } catch {
    return null;
  }
}

/** 데모 마을 목록: 지금 마을 + 보관된 마을 */
function demoTownList(s: Pick<AppState, 'townId' | 'townName' | 'townOwnerId' | 'friends' | 'projects' | 'demoTowns'>): TownSummary[] {
  const live = (ps: Project[]) => ps.filter((p) => ['active', 'paused', 'demolishing'].includes(p.status)).length;
  return [
    { id: s.townId!, name: s.townName, members: s.friends.length + 1, myProjects: live(s.projects), ownerId: s.townOwnerId ?? undefined },
    ...Object.values(s.demoTowns).map((t) => ({ id: t.id, name: t.name, members: t.friends.length + 1, myProjects: live(t.projects), ownerId: t.ownerId })),
  ];
}

/** 대상 마을에서 비어 있는 첫 부지 */
function freePlot(used: string[]): string | null {
  return EMPTY_PLOTS.find((p) => !used.includes(p.id))?.id ?? null;
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
  /** 편집 규칙을 적용하고 성공하면 저장. 실패하면 이유를 알린다 */
  const applyEdit = (projectId: string, fn: (p: Project) => edit.EditResult, server: () => Promise<unknown>, okText?: string): boolean => {
    const p = get().projects.find((x) => x.id === projectId);
    if (!p) return false;
    const r = fn(p);
    if (!r.ok) {
      get().notify(r.error, 'warn');
      return false;
    }
    set({ projects: updateProject(get().projects, projectId, () => r.project) });
    if (okText) get().notify(okText);
    remote(server);
    return true;
  };
  const syncTowns = () => {
    if (get().mode === 'demo') set({ towns: demoTownList(get()) });
  };

  return {
    mode: 'demo',
    booted: false,
    meId: ME,
    ...demoInitial(),
    towns: [],
    selectedId: null,
    listMode: false,
    toast: null,
    lastGrowth: null,
    view: null,
    expandOpen: false,

    boot: ({ mode, meId }) => {
      if (get().booted) return;
      if (mode === 'live' && meId) {
        set({ mode, meId, booted: true, projects: [], messages: [], friends: [], xp: 0, townProjects: [], demoTowns: {}, towns: [] });
        void get().reload();
        return;
      }
      const saved = readDemo();
      set({ mode: 'demo', booted: true, ...(saved ?? {}) });
      syncTowns();
      get().tickClock();
      // 데모 모드는 이 브라우저에만 저장한다
      useApp.subscribe((s) => {
        try {
          const out: Record<string, unknown> = {};
          for (const k of DEMO_FIELDS) out[k] = s[k];
          localStorage.setItem(DEMO_KEY, JSON.stringify(out));
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
        // 친구 상태(접속·집중)는 Presence가 정하므로 유지(같은 마을일 때만)
        const status = prev.townId === snap.townId ? new Map(prev.friends.map((f) => [f.id, f])) : new Map<string, Friend>();
        set({
          projects: snap.projects,
          townProjects: snap.townProjects,
          messages: snap.messages,
          xp: snap.xp,
          today: snap.today,
          prefs: snap.prefs,
          townId: snap.townId,
          townName: snap.townName,
          townOwnerId: snap.ownerId,
          towns: snap.towns,
          expansions: snap.expansions,
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

    /** 1분마다: 1시간이 지난 철거를 마무리한다 */
    tickClock: () => {
      const now = Date.now();
      const ended = (p: Project) => p.status === 'demolishing' && (edit.demolishRemaining(p, now) ?? 1) <= 0;
      const s = get();
      if (![...s.projects, ...s.townProjects].some(ended)) return;
      if (s.mode === 'live') {
        void s.reload();
        return;
      }
      const finish = (p: Project): Project => (ended(p) ? { ...p, status: 'archived', plotId: '' } : p);
      set({ projects: s.projects.map(finish), townProjects: s.townProjects.map(finish) });
      get().notify('철거가 끝나 부지가 비었어요');
      syncTowns();
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
      p = { ...p, ownerId: get().meId, visibility: 'town' };
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
      syncTowns();
      get().notify(`‘${p.title}’ 착공! 첫 퀘스트부터 시작해요`, 'good');
    },

    setListMode: (on) => set({ listMode: on }),
    notify: (text, tone = 'info') => set({ toast: { id: toastSeq++, text, tone } }),

    toggleQuest: (projectId, questId) => {
      const { projects, notify } = get();
      const p = projects.find((x) => x.id === projectId);
      const q = p?.quests.find((x) => x.id === questId);
      if (!p || !q) return;
      if (p.status === 'demolishing') {
        notify('철거 중인 프로젝트예요. 철거를 취소하면 다시 할 수 있어요', 'warn');
        return;
      }
      if (q.status === 'done') {
        if (p.milestones.find((m) => m.id === q.milestoneId)?.status === 'completed') {
          notify('완료한 중간 목표의 퀘스트는 취소할 수 없어요', 'warn');
          return;
        }
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
      if (!p || !edit.editable(p)) return;
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
        let activated = false;
        const milestones = pp.milestones.map((m, i) => {
          if (m.id === milestoneId) return { ...m, status: 'completed' as const, evidence };
          if (!activated && i > idx && m.status === 'planned') {
            activated = true;
            return { ...m, status: 'active' as const };
          }
          return m;
        });
        const allDone = milestones.every((m) => m.status === 'completed');
        const np: Project = { ...pp, milestones, status: allDone ? 'completed' : pp.status };
        return { ...np, stage: buildingStage(np) };
      });
      const after = next.find((x) => x.id === projectId)!;
      const stageAfter = buildingStage(after);
      set({
        projects: next,
        xp: get().xp + 50 + (after.status === 'completed' ? 150 : 0),
        lastGrowth: stageAfter > stageBefore ? { projectId, stage: stageAfter, at: Date.now() } : get().lastGrowth,
      });
      notify(
        after.status === 'completed'
          ? '완공! 랜드마크가 됐어요 · 명예의 전당에 올릴 수 있어요 · +200 XP'
          : stageAfter > stageBefore
            ? `중간 목표 완료 · 건물이 ${stageAfter}단계로 자랐어요 · +50 XP`
            : '중간 목표 완료 · +50 XP',
        'good',
      );
      remote(() => live.completeMilestone(milestoneId, evidence));
    },

    postpone: (projectId, days, scope, questId) => {
      const { projects, today, notify } = get();
      const p = projects.find((x) => x.id === projectId);
      const q = questId ? p?.quests.find((x) => x.id === questId) : p?.quests.find((x) => x.status !== 'done');
      if (!p || !q) return;
      const r = reschedule(p, q.id, days, scope);
      const np = { ...r.project, condition: nextCondition(r.project, today) };
      set({ projects: updateProject(projects, projectId, () => np) });
      if (np.condition === 'decayed' && p.condition === 'normal') notify('누적 지연이 30일을 넘어 건물이 잠시 낡았어요', 'warn');
      else if (r.conflicts.length) notify(`고정된 일정(${r.conflicts.join(', ')})은 그대로 두고 미뤘어요`, 'warn');
      else notify(scope === 'cascade' ? `뒤 일정까지 ${days}일 함께 미뤘어요` : `‘${q.title}’만 ${days}일 미뤘어요`);
      remote(() => live.applySchedule(p, np, scope, days, today));
    },

    togglePause: (projectId) => {
      const { projects, today, notify } = get();
      const cur = projects.find((x) => x.id === projectId);
      if (!cur || !edit.editable(cur)) return;
      const next = updateProject(projects, projectId, (pp) => {
        const status = pp.status === 'paused' ? 'active' : 'paused';
        const np = { ...pp, status } as Project;
        return { ...np, condition: nextCondition(np, today) };
      });
      set({ projects: next });
      const p = next.find((x) => x.id === projectId)!;
      notify(p.status === 'paused' ? '항해 쉬기 · 이 프로젝트는 낡지 않아요' : '항해를 다시 시작했어요');
      remote(() => live.setPaused(projectId, p.status === 'paused', today));
    },

    // ───────── 편집 ─────────
    addQuest: (projectId, milestoneId, input) => {
      const id = localId('q');
      return applyEdit(projectId, (p) => edit.addQuest(p, milestoneId, input, id), () => live.addQuest(milestoneId, input), `‘${input.title.trim()}’ 퀘스트를 더했어요`);
    },
    updateQuest: (projectId, questId, patch) =>
      applyEdit(projectId, (p) => edit.updateQuest(p, questId, patch), () => live.updateQuest(questId, patch)),
    deleteQuest: (projectId, questId) =>
      applyEdit(projectId, (p) => edit.deleteQuest(p, questId), () => live.deleteQuest(questId), '퀘스트를 지웠어요'),
    addMilestone: (projectId, input) => {
      const id = localId('m');
      return applyEdit(projectId, (p) => edit.addMilestone(p, input, id), () => live.addMilestone(projectId, { ...input, criteria: input.criteria ?? '', weight: input.weight ?? 1 }), `중간 목표 ‘${input.title.trim()}’를 더했어요`);
    },
    updateMilestone: (projectId, milestoneId, patch) =>
      applyEdit(projectId, (p) => edit.updateMilestone(p, milestoneId, patch), () => live.updateMilestone(milestoneId, patch)),
    deleteMilestone: (projectId, milestoneId) =>
      applyEdit(projectId, (p) => edit.deleteMilestone(p, milestoneId), () => live.deleteMilestone(milestoneId), '중간 목표를 지웠어요'),
    updateProject: (projectId, patch) =>
      applyEdit(
        projectId,
        (p) => (patch.title !== undefined && !patch.title.trim() ? { ok: false, error: '프로젝트 이름을 적어 주세요' } : { ok: true, project: { ...p, ...patch } }),
        () => live.updateProject(projectId, patch),
      ),

    // ───────── 철거·명예의 전당 ─────────
    startDemolition: (projectId) => {
      const p = get().projects.find((x) => x.id === projectId);
      if (!p || !edit.editable(p)) return;
      const ends = new Date(Date.now() + edit.DEMOLISH_MS).toISOString();
      set({
        projects: updateProject(get().projects, projectId, (pp) => ({ ...pp, prevStatus: pp.status as 'active' | 'paused', status: 'demolishing', demolishEndsAt: ends, condition: 'normal' })),
        selectedId: projectId,
      });
      get().notify('철거를 시작했어요 · 1시간 뒤 부지가 비어요. 그 전에는 취소할 수 있어요', 'warn');
      remote(() => live.startDemolition(projectId));
    },
    cancelDemolition: (projectId) => {
      const p = get().projects.find((x) => x.id === projectId);
      if (!p || p.status !== 'demolishing') return;
      set({ projects: updateProject(get().projects, projectId, (pp) => ({ ...pp, status: pp.prevStatus ?? 'active', demolishEndsAt: undefined, prevStatus: undefined })) });
      get().notify('철거를 취소했어요 · 건물이 그대로 남아요', 'good');
      remote(() => live.cancelDemolition(projectId));
    },
    moveToHall: (projectId) => {
      const p = get().projects.find((x) => x.id === projectId);
      if (!p || p.status !== 'completed') return;
      set({ projects: updateProject(get().projects, projectId, (pp) => ({ ...pp, hallAt: new Date().toISOString(), plotId: '' })), selectedId: null, view: { kind: 'hall' } });
      get().notify(`‘${p.title}’를 명예의 전당에 올렸어요 · 부지가 비었어요`, 'good');
      remote(() => live.moveToHall(projectId));
    },

    // ───────── 여러 마을 ─────────
    switchTown: async (townId) => {
      const s = get();
      if (townId === s.townId) return;
      if (s.mode === 'live') {
        try {
          await live.switchTown(townId);
          set({ selectedId: null, view: null });
          await get().reload();
        } catch (e) {
          get().notify(friendlyError(e), 'warn');
        }
        return;
      }
      const target = s.demoTowns[townId];
      if (!target) return;
      const stash: TownData = { id: s.townId!, name: s.townName, ownerId: s.townOwnerId ?? ME, friends: s.friends, projects: s.projects, townProjects: s.townProjects, messages: s.messages, expansions: s.expansions };
      const rest = { ...s.demoTowns, [stash.id]: stash };
      delete rest[townId];
      set({
        townId: target.id,
        townName: target.name,
        townOwnerId: target.ownerId,
        friends: target.friends,
        projects: target.projects,
        townProjects: target.townProjects,
        messages: target.messages,
        expansions: target.expansions ?? [],
        demoTowns: rest,
        selectedId: null,
        view: null,
      });
      syncTowns();
      get().notify(`‘${target.name}’으로 왔어요`);
    },

    createTown: async (name) => {
      const n = name.trim().slice(0, 30);
      if (!n) return;
      if (get().mode === 'live') {
        try {
          await live.createTown(n);
          set({ selectedId: null, view: null });
          await get().reload();
          get().notify(`‘${n}’을 만들었어요 · 카페에서 친구를 초대해 보세요`, 'good');
        } catch (e) {
          get().notify(friendlyError(e), 'warn');
        }
        return;
      }
      const id = localId('town');
      set({ demoTowns: { ...get().demoTowns, [id]: { id, name: n, ownerId: get().meId, friends: [], projects: [], townProjects: [], messages: [] } } });
      await get().switchTown(id);
    },

    copyProject: async (projectId, townId) => {
      const s = get();
      const p = s.projects.find((x) => x.id === projectId);
      if (!p || townId === s.townId) return;
      const targetName = s.towns.find((t) => t.id === townId)?.name ?? '그 마을';
      if (s.mode === 'live') {
        try {
          const used = await live.usedPlots(townId);
          const plot = p.hallAt ? '' : freePlot(used);
          if (plot === null) {
            get().notify(`‘${targetName}’에 빈 부지가 없어요`, 'warn');
            return;
          }
          await live.copyProject(projectId, townId, plot);
          await get().reload();
          get().notify(`‘${p.title}’를 ‘${targetName}’에 복사했어요`, 'good');
        } catch (e) {
          get().notify(friendlyError(e), 'warn');
        }
        return;
      }
      const target = s.demoTowns[townId];
      if (!target) return;
      const used = [...target.projects, ...target.townProjects].filter((x) => edit.onMap(x)).map((x) => x.plotId);
      const plot = p.hallAt ? '' : freePlot(used);
      if (plot === null) {
        get().notify(`‘${target.name}’에 빈 부지가 없어요`, 'warn');
        return;
      }
      const copy = edit.copyProject(p, localId, plot);
      set({ demoTowns: { ...s.demoTowns, [townId]: { ...target, projects: [...target.projects, copy] } } });
      syncTowns();
      get().notify(`‘${p.title}’를 ‘${target.name}’에 복사했어요`, 'good');
    },

    setExpandOpen: (v) => set({ expandOpen: v }),

    startExpansionAd: async () => {
      const s = get();
      if (s.mode === 'live') {
        try {
          const r = await live.startExpansionAd(s.townId!);
          return { session: r.session, slot: r.slot };
        } catch (e) {
          get().notify(friendlyError(e), 'warn');
          return null;
        }
      }
      const slot = EXPANSION_ORDER.find((x) => !s.expansions.includes(x));
      if (!slot) {
        get().notify('이 마을은 더 넓힐 땅이 없어요', 'warn');
        return null;
      }
      const id = localId('ad');
      demoAdSessions.set(id, Date.now());
      return { session: id, slot };
    },

    claimExpansion: async (session) => {
      const s = get();
      if (s.mode === 'live') {
        try {
          const slot = await live.claimExpansion(session);
          await get().reload();
          return slot;
        } catch (e) {
          get().notify(friendlyError(e), 'warn');
          return null;
        }
      }
      const started = demoAdSessions.get(session);
      if (!started || Date.now() - started < 15_000) {
        get().notify('광고를 끝까지 봐야 땅이 열려요', 'warn');
        return null;
      }
      demoAdSessions.delete(session);
      const slot = EXPANSION_ORDER.find((x) => !s.expansions.includes(x));
      if (!slot) return null;
      set({ expansions: [...s.expansions, slot] });
      return slot;
    },

    saveAvatar: (a) => {
      set({ me: { ...get().me, avatar: a } });
      get().notify('캐릭터 외형을 바꿨어요', 'good');
      remote(() => live.saveAvatar(a));
    },
    savePrefs: (p) => {
      set({ prefs: p });
      remote(() => live.savePrefs(p));
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
      syncTowns();
    },
  };
});

/** 마을 지도에 서 있는 모든 프로젝트(내 것 + 친구 것) */
export const mapProjects = (s: Pick<AppState, 'projects' | 'townProjects'>, now = Date.now()) =>
  [...s.projects, ...s.townProjects].filter((p) => edit.onMap(p, now));

/** 진행 중인 내 프로젝트(완공·철거 끝 제외) */
export const activeProjects = (ps: Project[]) => ps.filter((p) => p.status !== 'archived' && !p.hallAt);

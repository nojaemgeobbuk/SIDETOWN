import { describe, expect, it } from 'vitest';
import { sampleProjects } from './sample-data';
import { allQuests, backlog, dayLoad, monthGrid, overdue, suggestMove, timelineScale, upcoming, weekDays, weekLabel, weekStats } from './plan';
import type { Project } from './types';

describe('계획 날짜', () => {
  it('주는 월요일부터, 라벨은 목요일이 속한 달 기준', () => {
    expect(weekDays('2026-10-29')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
    expect(weekLabel('2026-10-29')).toBe('10월 다섯째 주');
    expect(weekLabel('2026-11-02')).toBe('11월 첫째 주');
  });
  it('달력은 6주 42칸, 그 달 1일을 포함', () => {
    const g = monthGrid('2026-11-15');
    expect(g).toHaveLength(42);
    expect(g[0]).toBe('2026-10-26');
    expect(g).toContain('2026-11-30');
  });
  it('타임라인 눈금은 지난달 1일부터', () => {
    const s = timelineScale('2026-10-29', 6);
    expect(s.start).toBe('2026-09-01');
    expect(s.x('2026-09-01')).toBe(0);
    expect(s.months[1].label).toBe('10월');
  });
});

describe('보관함·부하·제안', () => {
  const refs = allQuests(sampleProjects);
  it('하는 날이 없는 남은 퀘스트는 보관함에, 마감 순', () => {
    const b = backlog(refs);
    expect(b.every((r) => !r.quest.scheduledStart && r.quest.status !== 'done')).toBe(true);
    const dues = b.map((r) => r.quest.due ?? '9999');
    expect([...dues].sort()).toEqual(dues);
  });
  it('하루 부하는 끝낸 일을 빼고 센다', () => {
    expect(dayLoad(refs, '2026-10-26')).toBe(45 + 15);
  });
  it('마감 지난 일', () => {
    expect(overdue(refs, '2026-10-29').map((r) => r.quest.id)).toEqual(['cq1']);
  });
  it('넘친 날의 퀘스트를 같은 주 남는 날로 옮기자고 제안한다', () => {
    const p: Project = {
      ...sampleProjects[0],
      quests: [
        { id: 'a', milestoneId: 'm3', title: '큰 일', estimatedMinutes: 80, status: 'todo', scheduledStart: '2026-10-29', due: '2026-11-01' },
        { id: 'b', milestoneId: 'm3', title: '작은 일', estimatedMinutes: 30, status: 'todo', scheduledStart: '2026-10-29', due: '2026-11-01' },
        { id: 'c', milestoneId: 'm3', title: '고정', estimatedMinutes: 30, status: 'todo', scheduledStart: '2026-10-29', pinned: true },
      ],
    };
    const r = allQuests([p]);
    const days = weekDays('2026-10-29');
    expect(weekStats(r, days).find((s) => s.date === '2026-10-29')!.over).toBe(50);
    const s = suggestMove(r, days, '2026-10-29');
    // 넘친 50분을 덮는 가장 작은 퀘스트(80분)… 고정된 건 제외
    expect(s?.ref.quest.id).toBe('a');
    expect(s?.to).toBe('2026-10-30'); // 금요일이 비어 있어(90분) 80분짜리가 들어간다
  });
});

describe('다가오는 마감', () => {
  it('친구 프로젝트도 읽기 전용으로 포함', () => {
    const u = upcoming([sampleProjects[0]], [sampleProjects[1]], '2026-10-26', 14);
    expect(u.some((x) => x.readonly)).toBe(true);
    expect(u.map((x) => x.date)).toEqual([...u.map((x) => x.date)].sort());
  });
});

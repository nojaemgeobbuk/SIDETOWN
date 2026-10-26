import { describe, expect, it } from 'vitest';
import {
  actualProgress,
  addDays,
  buildingStage,
  cumulativeDelayDays,
  daysBetween,
  DECAY_THRESHOLD_DAYS,
  expectedProgress,
  health,
  nextCondition,
  rebaseline,
  reschedule,
} from './schedule';
import { sampleProjects, SAMPLE_TODAY } from './sample-data';
import type { Project } from './types';

const clone = (p: Project): Project => JSON.parse(JSON.stringify(p));
const [sidetown, essay, cert] = sampleProjects.map(clone);

describe('날짜', () => {
  it('월말·연말을 넘어 더한다', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2027-02-27', 2)).toBe('2027-03-01');
  });
  it('일수 차이', () => {
    expect(daysBetween('2027-03-15', '2027-03-27')).toBe(12);
    expect(daysBetween('2026-10-26', '2026-10-26')).toBe(0);
  });
});

describe('진척도·상태 (6.7)', () => {
  it('실제 진척도는 완료한 중간 목표 가중치', () => {
    expect(actualProgress(sidetown)).toBe(33);
    expect(actualProgress(essay)).toBe(0);
  });
  it('계획 위치는 기준선 기준', () => {
    expect(expectedProgress(sidetown, SAMPLE_TODAY)).toBe(34);
    expect(expectedProgress(cert, SAMPLE_TODAY)).toBe(100);
  });
  it('상태 판정', () => {
    expect(health(sidetown, SAMPLE_TODAY)).toBe('ok');
    expect(health(cert, SAMPLE_TODAY)).toBe('late');
  });
});

describe('누적 지연과 건물 상태 (8.3)', () => {
  it('목표일 이동만큼 지연', () => {
    expect(cumulativeDelayDays(essay, SAMPLE_TODAY)).toBe(12);
    expect(cumulativeDelayDays(cert, SAMPLE_TODAY)).toBe(57);
  });
  it('29일은 정상, 30일부터 낡음', () => {
    const p = { ...clone(sidetown), target: addDays(sidetown.baselineTarget, DECAY_THRESHOLD_DAYS - 1) };
    expect(nextCondition(p, SAMPLE_TODAY)).toBe('normal');
    const q = { ...p, target: addDays(sidetown.baselineTarget, DECAY_THRESHOLD_DAYS) };
    expect(nextCondition(q, SAMPLE_TODAY)).toBe('decayed');
  });
  it('항해 쉬기는 낡지 않는다', () => {
    expect(nextCondition({ ...cert, status: 'paused' }, SAMPLE_TODAY)).toBe('normal');
  });
  it('수리 중은 지연이 남아 있어도 유지', () => {
    expect(nextCondition({ ...cert, condition: 'repairing' }, SAMPLE_TODAY)).toBe('repairing');
  });
  it('기준선을 다시 잡으면 지연 0 → 즉시 다시 낡지 않음', () => {
    const r = rebaseline(cert);
    expect(cumulativeDelayDays(r, SAMPLE_TODAY)).toBe(0);
    expect(nextCondition({ ...r, condition: 'normal' }, SAMPLE_TODAY)).toBe('normal');
  });
});

describe('성장 단계 (11)', () => {
  it('완료 0개는 0단계, 33%는 1단계, 60% 이상 2단계, 완료 3단계', () => {
    expect(buildingStage(essay)).toBe(0);
    expect(buildingStage(sidetown)).toBe(1);
    const four = clone(sidetown);
    four.milestones.slice(0, 4).forEach((m) => (m.status = 'completed'));
    expect(buildingStage(four)).toBe(2);
    expect(buildingStage({ ...four, status: 'completed' })).toBe(3);
  });
});

describe('일정 미루기 (8.2)', () => {
  it('이 퀘스트만: 목표일과 다른 퀘스트는 그대로', () => {
    const r = reschedule(sidetown, 'q3', 7, 'only');
    expect(r.project.target).toBe(sidetown.target);
    expect(r.project.quests.find((q) => q.id === 'q3')!.due).toBe('2026-11-07');
    expect(r.project.quests.find((q) => q.id === 'q4')!.due).toBe('2026-11-02');
    expect(r.targetShiftDays).toBe(0);
  });

  it('뒤 일정 전체: 이후 퀘스트·중간 목표·목표일이 같은 일수만큼', () => {
    const r = reschedule(sidetown, 'q3', 7, 'cascade');
    const qs = Object.fromEntries(r.project.quests.map((q) => [q.id, q]));
    expect(qs.q1.due).toBe('2026-10-25'); // 완료 항목은 그대로
    expect(qs.q2.due).toBe('2026-10-30'); // 앞선 퀘스트는 그대로
    expect(qs.q3.due).toBe('2026-11-07');
    expect(qs.q4.due).toBe('2026-11-09');
    expect(qs.q6.due).toBe('2027-01-12');
    const ms = Object.fromEntries(r.project.milestones.map((m) => [m.id, m]));
    expect(ms.m1.target).toBe('2026-10-09');
    expect(ms.m3.start).toBe('2026-10-26'); // 현재 목표는 끝 날짜만
    expect(ms.m3.target).toBe('2026-12-07');
    expect(ms.m4.start).toBe('2026-12-08');
    expect(r.project.target).toBe('2027-02-07');
    expect(r.targetShiftDays).toBe(7);
    expect(cumulativeDelayDays(r.project, SAMPLE_TODAY)).toBe(7);
  });

  it('고정 항목은 움직이지 않고 충돌로 보고', () => {
    const p = clone(sidetown);
    p.milestones.find((m) => m.id === 'm5')!.pinned = true;
    const r = reschedule(p, 'q3', 7, 'cascade');
    expect(r.project.milestones.find((m) => m.id === 'm5')!.target).toBe('2027-01-15');
    expect(r.conflicts).toContain('공개 서비스 운영');
  });

  it('목표일 고정 압축은 날짜를 바꾸지 않는다', () => {
    const r = reschedule(sidetown, 'q3', 7, 'squeeze');
    expect(r.project).toBe(sidetown);
  });

  it('미루기를 쌓아 30일을 넘기면 낡음', () => {
    let p = clone(sidetown);
    for (let i = 0; i < 5; i++) p = reschedule(p, 'q3', 7, 'cascade').project;
    expect(cumulativeDelayDays(p, SAMPLE_TODAY)).toBe(35);
    expect(nextCondition(p, SAMPLE_TODAY)).toBe('decayed');
  });
});

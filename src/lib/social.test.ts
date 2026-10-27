import { describe, expect, it } from 'vitest';
import { windAt } from '@/focus/scenes';
import { createProject } from './templates';
import { buildingStage, daysBetween } from './schedule';
import { MESSAGE_MAX, ME, sampleMessages, sanitizeMessage, thread, unreadCount } from './social';
import { EMPTY_PLOTS, isPlotFree, isWalkable, setOccupiedPlots } from '@/town/map';

describe('쪽지', () => {
  it('대화는 나와 그 친구 사이의 쪽지만 시간순', () => {
    const t = thread(sampleMessages, 'jiwoo');
    expect(t.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(t.every((m) => m.to !== 'board')).toBe(true);
  });
  it('안 읽은 수는 나에게 온 것만', () => {
    expect(unreadCount(sampleMessages)).toBe(2);
    expect(unreadCount(sampleMessages, 'jiwoo')).toBe(1);
    expect(sampleMessages.filter((m) => m.from === ME).every((m) => m.read)).toBe(true);
  });
  it('빈 쪽지는 보내지 않고 길이를 자른다', () => {
    expect(sanitizeMessage('   \n ')).toBeNull();
    expect(sanitizeMessage('  안녕  ')).toBe('안녕');
    expect(sanitizeMessage('가'.repeat(500))!.length).toBe(MESSAGE_MAX);
  });
});

describe('새 프로젝트 착공', () => {
  const p = createProject({ title: '  가계부 앱 ', building: 'workshop', definitionOfDone: '', target: '2027-01-24', milestones: ['범위', '기능', '', '공개'], firstQuest: '기능 3개 적기', plotId: 'plot-d', today: '2026-10-26' });
  it('빈 중간 목표는 빼고 목표일까지 고르게 나눈다', () => {
    expect(p.title).toBe('가계부 앱');
    expect(p.milestones.map((m) => m.title)).toEqual(['범위', '기능', '공개']);
    expect(p.milestones[0].start).toBe('2026-10-26');
    expect(p.milestones.at(-1)!.target).toBe('2027-01-24');
    for (let i = 1; i < p.milestones.length; i++) expect(daysBetween(p.milestones[i - 1].target, p.milestones[i].start)).toBe(1);
  });
  it('기준선이 잡히고 공사 부지(0단계)로 시작', () => {
    expect(p.baselineTarget).toBe(p.target);
    expect(p.milestones.every((m) => m.baselineTarget === m.target)).toBe(true);
    expect(buildingStage(p)).toBe(0);
    expect(p.quests).toHaveLength(1);
    expect(p.definitionOfDone.length).toBeGreaterThan(0);
  });
  it('빈 부지에 들어서면 그 칸은 막히고 부지는 더 이상 비어 있지 않다', () => {
    const plot = EMPTY_PLOTS.find((x) => x.id === 'plot-d')!;
    setOccupiedPlots([]);
    expect(isPlotFree('plot-d')).toBe(true);
    expect(isWalkable(plot.x + 1, plot.y + 1)).toBe(true);
    setOccupiedPlots(['plot-d']);
    expect(isPlotFree('plot-d')).toBe(false);
    expect(isWalkable(plot.x + 1, plot.y + 1)).toBe(false);
    expect(isWalkable(plot.entrance.x, plot.entrance.y)).toBe(true);
    setOccupiedPlots([]);
  });
});

describe('바람', () => {
  it('0~1 사이이고 시간에 따라 변하며 가끔 돌풍', () => {
    const vals = Array.from({ length: 600 }, (_, i) => windAt(i * 500));
    expect(Math.min(...vals)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...vals)).toBeLessThanOrEqual(1);
    expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(0.3);
    expect(vals.some((v) => v > 0.6)).toBe(true);
  });
});

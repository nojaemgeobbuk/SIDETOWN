import { describe, expect, it } from 'vitest';
import { sampleProjects } from './sample-data';
import { addMilestone, addQuest, copyProject, deleteMilestone, deleteQuest, demolishRemaining, onMap, updateMilestone, updateQuest } from './edit';

const p = sampleProjects[0];

describe('퀘스트 편집', () => {
  it('추가하면 기준선이 잡히고, 기한 변경은 기준선을 건드리지 않는다', () => {
    const a = addQuest(p, 'm3', { title: ' 랜딩 문구 ', estimatedMinutes: 25, due: '2026-11-03' }, 'nq');
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const q = a.project.quests.at(-1)!;
    expect(q).toMatchObject({ title: '랜딩 문구', baselineDue: '2026-11-03', status: 'todo' });
    const b = updateQuest(a.project, 'nq', { due: '2026-11-10', title: '랜딩 문구 2안' });
    expect(b.ok && b.project.quests.at(-1)).toMatchObject({ due: '2026-11-10', baselineDue: '2026-11-03', title: '랜딩 문구 2안' });
  });
  it('완료한 중간 목표에는 더할 수 없고, 끝낸 퀘스트는 지울 수 없다', () => {
    expect(addQuest(p, 'm1', { title: 'x' }, 'z').ok).toBe(false);
    expect(deleteQuest(p, 'q1').ok).toBe(false);
    const d = deleteQuest(p, 'q3');
    expect(d.ok && d.project.quests.some((q) => q.id === 'q3')).toBe(false);
  });
  it('완료는 편집으로 못 한다', () => {
    expect(updateQuest(p, 'q3', { status: 'done' }).ok).toBe(false);
  });
});

describe('중간 목표 편집', () => {
  it('추가하면 프로젝트 목표일이 따라 늘어난다(기준선은 그대로)', () => {
    const r = addMilestone(p, { title: '해외 출시', start: '2027-02-01', target: '2027-02-28' }, 'm7');
    expect(r.ok && r.project.target).toBe('2027-02-28');
    expect(r.ok && r.project.baselineTarget).toBe('2027-01-31');
  });
  it('날짜가 뒤집히면 거절', () => {
    expect(updateMilestone(p, 'm4', { start: '2026-12-30', target: '2026-12-01' }).ok).toBe(false);
  });
  it('완료한 일이 있는 목표는 못 지우고, 진행 중 목표를 지우면 다음 목표가 진행 중이 된다', () => {
    expect(deleteMilestone(p, 'm3').ok).toBe(false); // q1이 끝남
    const r = deleteMilestone({ ...p, quests: p.quests.filter((q) => q.id !== 'q1') }, 'm3');
    expect(r.ok && r.project.milestones.find((m) => m.id === 'm4')?.status).toBe('active');
  });
});

describe('복사·철거', () => {
  it('복사본은 새 id, 진행 상황 유지, 퀘스트가 새 중간 목표를 가리킨다', () => {
    let n = 0;
    const c = copyProject(p, (k) => `${k}${n++}`, 'plot-d');
    expect(c.id).not.toBe(p.id);
    expect(c.copiedFrom).toBe(p.id);
    expect(c.milestones.map((m) => m.status)).toEqual(p.milestones.map((m) => m.status));
    const mids = new Set(c.milestones.map((m) => m.id));
    expect(c.quests.every((q) => mids.has(q.milestoneId))).toBe(true);
  });
  it('철거는 남은 시간이 0이 되면 지도에서 사라진다', () => {
    const now = Date.parse('2026-10-29T12:00:00Z');
    const d = { ...p, status: 'demolishing' as const, demolishEndsAt: '2026-10-29T12:30:00Z' };
    expect(demolishRemaining(d, now)).toBe(30 * 60_000);
    expect(onMap(d, now)).toBe(true);
    expect(onMap(d, now + 31 * 60_000)).toBe(false);
    expect(onMap({ ...p, hallAt: '2026-10-29T00:00:00Z' }, now)).toBe(false);
  });
});

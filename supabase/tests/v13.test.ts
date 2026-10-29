// v1.3: 여러 마을, 퀘스트·중간 목표 편집, 철거 1시간, 명예의 전당, 마을 간 복사, 캐릭터 외형
import { beforeAll, describe, expect, it } from 'vitest';
import { makeDb, uid } from './harness';

const A = uid(1);
const B = uid(2);
const C = uid(3);
let t: Awaited<ReturnType<typeof makeDb>>;
let town1: string;
let town2: string;
let pid: string;
let msIds: string[];

const project = (plot: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    title: '가계부 앱', building: 'workshop', plot_id: plot,
    start_date: '2026-10-01', target_date: '2026-12-31',
    milestones: [
      { title: '범위', start_date: '2026-10-01', target_date: '2026-10-31' },
      { title: '기능', start_date: '2026-11-01', target_date: '2026-12-31' },
    ],
    first_quest: { title: '기능 3개 적기', estimated_minutes: 15, due_date: '2026-10-05' },
    ...extra,
  });

beforeAll(async () => {
  t = await makeDb([A, B, C]);
  town1 = await t.rpc<string>(A, `public.create_town('회사 동기 마을', '재민')`);
  const inv = await t.rpc<string>(A, 'public.create_invite()');
  await t.rpc(B, `public.accept_invite($1, '지우')`, [inv]);
  pid = await t.rpc<string>(A, 'public.create_project($1::jsonb)', [project('plot-a')]);
  msIds = (await t.rows<{ id: string }>(A, 'select id from public.milestones where project_id = $1 order by position', [pid])).map((r) => r.id);
}, 60_000);

describe('여러 마을', () => {
  it('한 사람이 마을을 여러 개 만들고 오갈 수 있다', async () => {
    town2 = await t.rpc<string>(A, `public.create_town('주말 스터디', '')`);
    expect(await t.rpc(A, 'public.my_town_id()')).toBe(town2);
    const towns = await t.rpc<{ id: string; current: boolean; members: number }[]>(A, 'public.my_towns()');
    expect(towns.map((x) => x.id)).toEqual([town1, town2]);
    expect(towns.find((x) => x.current)?.id).toBe(town2);
    await t.rpc(A, 'public.switch_town($1)', [town1]);
    expect(await t.rpc(A, 'public.my_town_id()')).toBe(town1);
  });

  it('속하지 않은 마을로는 전환할 수 없다', async () => {
    await expect(t.rpc(B, 'public.switch_town($1)', [town2])).rejects.toThrow(/forbidden/);
  });

  it('이미 다른 마을에 있어도 초대를 받으면 하나 더 들어간다', async () => {
    const c1 = await t.rpc<string>(C, `public.create_town('C의 마을', '세오')`);
    await t.rpc(A, 'public.switch_town($1)', [town2]);
    const inv = await t.rpc<string>(A, 'public.create_invite()');
    expect(await t.rpc(C, `public.accept_invite($1, '')`, [inv])).toBe(town2);
    const cTowns = await t.rpc<{ id: string }[]>(C, 'public.my_towns()');
    expect(cTowns.map((x) => x.id).sort()).toEqual([c1, town2].sort());
    await t.rpc(A, 'public.switch_town($1)', [town1]);
  });
});

describe('퀘스트·중간 목표 편집', () => {
  let q2: string;
  it('퀘스트를 추가·수정·삭제한다', async () => {
    q2 = await t.rpc<string>(A, `public.add_quest($1, $2::jsonb)`, [msIds[0], JSON.stringify({ title: '와이어프레임', estimated_minutes: 40, scheduled_start: '2026-10-06', due_date: '2026-10-08' })]);
    await t.rpc(A, `public.update_quest($1, $2::jsonb)`, [q2, JSON.stringify({ title: '와이어프레임 3장', due_date: '2026-10-10', note: 'Figma' })]);
    const [q] = await t.rows<{ title: string; due_date: string; baseline_due_date: string; note: string }>(A, `select title, due_date::text, baseline_due_date::text, note from public.quests where id = $1`, [q2]);
    // 기한 변경은 기준선을 건드리지 않는다(지연으로 보인다)
    expect(q).toEqual({ title: '와이어프레임 3장', due_date: '2026-10-10', baseline_due_date: '2026-10-08', note: 'Figma' });
    await t.rpc(A, 'public.delete_quest($1)', [q2]);
    expect(await t.rows(A, 'select id from public.quests where id = $1', [q2])).toEqual([]);
  });

  it('친구는 편집할 수 없고, 끝낸 퀘스트는 지울 수 없다', async () => {
    const [{ id: first }] = await t.rows<{ id: string }>(A, 'select id from public.quests where project_id = $1', [pid]);
    await expect(t.rpc(B, `public.update_quest($1, '{"title":"x"}'::jsonb)`, [first])).rejects.toThrow(/forbidden/);
    await expect(t.rpc(B, `public.add_quest($1, '{"title":"x"}'::jsonb)`, [msIds[0]])).rejects.toThrow(/forbidden/);
    await t.rpc(A, `public.complete_quest($1, 'k-first-quest')`, [first]);
    await expect(t.rpc(A, 'public.delete_quest($1)', [first])).rejects.toThrow(/quest done/);
    await expect(t.rpc(A, `public.update_quest($1, '{"status":"done"}'::jsonb)`, [first])).rejects.toThrow(/use complete_quest/);
  });

  it('중간 목표를 추가하면 목표일이 늘어나고, 완료한 일이 있는 목표는 지울 수 없다', async () => {
    const m3 = await t.rpc<string>(A, `public.add_milestone($1, $2::jsonb)`, [pid, JSON.stringify({ title: '출시', start_date: '2027-01-01', target_date: '2027-01-31' })]);
    const [p] = await t.rows<{ target_date: string; baseline_target_date: string }>(A, 'select target_date::text, baseline_target_date::text from public.projects where id = $1', [pid]);
    expect(p).toEqual({ target_date: '2027-01-31', baseline_target_date: '2026-12-31' });
    await t.rpc(A, `public.update_milestone($1, '{"title":"정식 출시","weight":2}'::jsonb)`, [m3]);
    await expect(t.rpc(A, 'public.delete_milestone($1)', [msIds[0]])).rejects.toThrow(/completed work/);
    await t.rpc(A, 'public.delete_milestone($1)', [m3]);
    expect((await t.rows(A, 'select id from public.milestones where project_id = $1', [pid])).length).toBe(2);
  });

  it('친구는 세부 일정을 읽을 수 있다', async () => {
    expect((await t.rows(B, 'select id from public.quests where project_id = $1', [pid])).length).toBe(1);
  });
});

describe('철거·명예의 전당', () => {
  it('철거는 1시간 동안 부지를 차지하고, 취소할 수 있다', async () => {
    const p2 = await t.rpc<string>(A, 'public.create_project($1::jsonb)', [project('plot-b', { title: '중단할 프로젝트' })]);
    const ends = await t.rpc<string>(A, 'public.start_demolition($1)', [p2]);
    expect(new Date(ends).getTime() - Date.now()).toBeGreaterThan(59 * 60_000);
    // 철거 중에는 그 부지에 새로 지을 수 없다
    await expect(t.rpc(B, 'public.create_project($1::jsonb)', [project('plot-b')])).rejects.toThrow(/duplicate key/);
    expect(await t.rpc(A, 'public.cancel_demolition($1)', [p2])).toBe('active');
    await t.rpc(A, 'public.start_demolition($1)', [p2]);
    // 1시간이 지난 것으로 만든다
    await t.db.query(`update public.projects set demolish_ends_at = now() - interval '1 minute' where id = $1`, [p2]);
    await t.rpc(A, `public.refresh_my_conditions('2026-10-29')`);
    const [r] = await t.rows<{ status: string; plot_id: string | null }>(A, 'select status, plot_id from public.projects where id = $1', [p2]);
    expect(r).toEqual({ status: 'archived', plot_id: null });
    // 부지가 비어 다시 지을 수 있다
    expect(await t.rpc(B, 'public.create_project($1::jsonb)', [project('plot-b', { title: '지우 프로젝트' })])).toBeTruthy();
  });

  it('완공한 프로젝트만 명예의 전당으로 옮길 수 있고, 옮기면 부지가 빈다', async () => {
    await expect(t.rpc(A, 'public.move_to_hall($1)', [pid])).rejects.toThrow(/not completed/);
    await t.rpc(A, `public.complete_milestone($1, '범위 문서', 'k-ms-0001')`, [msIds[0]]);
    const q = await t.rpc<string>(A, `public.add_quest($1, '{"title":"마무리"}'::jsonb)`, [msIds[1]]);
    await t.rpc(A, `public.complete_quest($1, 'k-last-quest')`, [q]);
    await t.rpc(A, `public.complete_milestone($1, '기능 완성', 'k-ms-0002')`, [msIds[1]]);
    await t.rpc(A, 'public.move_to_hall($1)', [pid]);
    const [r] = await t.rows<{ status: string; plot_id: string | null; hall: boolean }>(A, 'select status, plot_id, hall_at is not null as hall from public.projects where id = $1', [pid]);
    expect(r).toEqual({ status: 'completed', plot_id: null, hall: true });
    expect((await t.rows(B, 'select id from public.projects where hall_at is not null')).length).toBe(1);
  });
});

describe('마을 간 복사', () => {
  it('진행 상황을 복사하되 XP는 두 번 주지 않는다', async () => {
    const src = await t.rpc<string>(A, 'public.create_project($1::jsonb)', [project('plot-c', { title: '복사할 프로젝트' })]);
    const [{ id: q }] = await t.rows<{ id: string }>(A, 'select id from public.quests where project_id = $1', [src]);
    await t.rpc(A, `public.complete_quest($1, 'k-copy-src')`, [q]);
    const xpBefore = await t.rpc<number>(A, 'public.my_xp()');
    const copy = await t.rpc<string>(A, `public.copy_project($1, $2, 'plot-a')`, [src, town2]);
    const [cp] = await t.rows<{ town_id: string; copied_from: string }>(A, 'select town_id, copied_from from public.projects where id = $1', [copy]);
    expect(cp).toEqual({ town_id: town2, copied_from: src });
    const [{ id: cq, status }] = await t.rows<{ id: string; status: string }>(A, 'select id, status from public.quests where project_id = $1', [copy]);
    expect(status).toBe('done');
    // 복사본에서 완료 취소 → 다시 완료해도 XP 변화 없음
    await t.rpc(A, `public.reopen_quest($1, 'k-copy-reopen')`, [cq]);
    await t.rpc(A, `public.complete_quest($1, 'k-copy-again')`, [cq]);
    expect(await t.rpc<number>(A, 'public.my_xp()')).toBe(xpBefore);
  });

  it('속하지 않은 마을로는 복사할 수 없다', async () => {
    const [{ id }] = await t.rows<{ id: string }>(B, `select id from public.projects where owner_id = $1 limit 1`, [B]);
    await expect(t.rpc(B, `public.copy_project($1, $2, 'plot-d')`, [id, town2])).rejects.toThrow(/forbidden/);
  });
});

describe('캐릭터 외형', () => {
  it('정해진 키만 저장하고 친구에게 보인다', async () => {
    await t.rpc(A, `public.save_avatar($1::jsonb)`, [JSON.stringify({ hair: 'black', top: 'coral', evil: 'x', skin: '<script>' })]);
    const [p] = await t.rows<{ avatar: unknown }>(B, 'select avatar from public.profiles where user_id = $1', [A]);
    expect(p.avatar).toEqual({ hair: 'black', top: 'coral' });
  });
});

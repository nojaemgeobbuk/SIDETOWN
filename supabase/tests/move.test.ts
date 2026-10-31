// v1.7: 건물 옮기기 — 프로젝트 건물과 공용 건물(카페·내 집·명예의 전당)
import { beforeAll, describe, expect, it } from 'vitest';
import { makeDb, uid } from './harness';

const A = uid(1);
const B = uid(2);
const C = uid(3);
let t: Awaited<ReturnType<typeof makeDb>>;
let town: string;
let pa: string;
let pb: string;

const project = (plot: string, title = '프로젝트') =>
  JSON.stringify({
    title, building: 'bookstore', plot_id: plot, start_date: '2026-11-01', target_date: '2026-12-31',
    milestones: [{ title: '시작', start_date: '2026-11-01', target_date: '2026-12-31' }],
    first_quest: { title: '첫 걸음', estimated_minutes: 15, due_date: '2026-11-02' },
  });
const layout = async () => (await t.db.query<{ layout: Record<string, string> }>('select layout from public.towns where id = $1', [town])).rows[0].layout;
const plotOf = async (id: string) => (await t.db.query<{ plot_id: string }>('select plot_id from public.projects where id = $1', [id])).rows[0].plot_id;

beforeAll(async () => {
  t = await makeDb([A, B, C]);
  town = await t.rpc<string>(A, `public.create_town('옮기기 마을', '재민')`);
  const inv = await t.rpc<string>(A, 'public.create_invite()');
  await t.rpc(B, `public.accept_invite($1, '지우')`, [inv]);
  await t.rpc(C, `public.create_town('다른 마을', '서연')`);
  pa = await t.rpc<string>(A, 'public.create_project($1::jsonb)', [project('plot-a', 'A의 건물')]);
  pb = await t.rpc<string>(B, 'public.create_project($1::jsonb)', [project('plot-b', 'B의 건물')]);
}, 60_000);

describe('건물 옮기기(v1.7)', () => {
  it('처음 배치는 공용 건물 원래 자리', async () => {
    expect(await layout()).toEqual({ cafe: 'lot-cafe', home: 'lot-home', hall: 'lot-hall' });
  });

  it('내 프로젝트를 빈 부지로 옮길 수 있다', async () => {
    await t.rpc(A, 'public.move_project($1, $2)', [pa, 'plot-s1a']);
    expect(await plotOf(pa)).toBe('plot-s1a');
  });

  it('친구 건물·다른 마을 사람은 옮길 수 없다', async () => {
    await expect(t.rpc(A, 'public.move_project($1, $2)', [pb, 'plot-c'])).rejects.toThrow(/forbidden/);
    await expect(t.rpc(C, `public.move_place($1, 'cafe', 'plot-c')`, [town])).rejects.toThrow(/forbidden/);
  });

  it('이미 쓰는 부지·공용 건물 자리·없는 부지로는 못 옮긴다', async () => {
    await expect(t.rpc(A, 'public.move_project($1, $2)', [pa, 'plot-b'])).rejects.toThrow(/plot taken/);
    await expect(t.rpc(A, 'public.move_project($1, $2)', [pa, 'lot-cafe'])).rejects.toThrow(/plot taken/);
    await expect(t.rpc(A, 'public.move_project($1, $2)', [pa, 'plot-z'])).rejects.toThrow(/bad plot/);
  });

  it('주민은 공용 건물을 빈 부지로 옮길 수 있고, 빈 원래 자리에는 프로젝트를 지을 수 있다', async () => {
    await t.rpc(B, `public.move_place($1, 'cafe', 'plot-e1a')`, [town]);
    expect((await layout()).cafe).toBe('plot-e1a');
    // 카페가 떠난 자리에 새 프로젝트
    expect(await t.rpc(B, 'public.create_project($1::jsonb)', [project('lot-cafe', '카페 자리 프로젝트')])).toBeTruthy();
    // 카페가 간 자리에는 지을 수 없다
    await expect(t.rpc(A, 'public.create_project($1::jsonb)', [project('plot-e1a')])).rejects.toThrow(/plot taken/);
  });

  it('공용 건물끼리·프로젝트 위로는 못 옮긴다', async () => {
    await expect(t.rpc(A, `public.move_place($1, 'home', 'plot-e1a')`, [town])).rejects.toThrow(/plot taken/);
    await expect(t.rpc(A, `public.move_place($1, 'hall', 'plot-s1a')`, [town])).rejects.toThrow(/plot taken/);
    await expect(t.rpc(A, `public.move_place($1, 'garden', 'plot-c')`, [town])).rejects.toThrow(/cannot move/);
  });

  it('철거 중인 건물은 옮길 수 없다', async () => {
    await t.rpc(A, 'public.start_demolition($1)', [pa]);
    await expect(t.rpc(A, 'public.move_project($1, $2)', [pa, 'plot-c'])).rejects.toThrow(/cannot move/);
  });
});

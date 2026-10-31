// v1.5 땅 넓히기: 광고 세션 → 15초 뒤 보상 → 구역이 열리고 그 부지에만 지을 수 있다
import { beforeAll, describe, expect, it } from 'vitest';
import { makeDb, uid } from './harness';

const A = uid(11);
const B = uid(12);
const C = uid(13);
let t: Awaited<ReturnType<typeof makeDb>>;
let town: string;

const project = (plot: string) =>
  JSON.stringify({
    title: '새 땅 프로젝트', building: 'lab', plot_id: plot, start_date: '2026-11-01', target_date: '2026-12-01',
    milestones: [{ title: '시작', start_date: '2026-11-01', target_date: '2026-12-01' }],
  });

/** 광고 시작 시각을 과거로 돌려 ‘다 본 것’으로 만든다 */
const watched = (session: string, seconds = 20) =>
  t.db.query(`update public.ad_sessions set started_at = now() - make_interval(secs => $2) where id = $1`, [session, seconds]);

beforeAll(async () => {
  t = await makeDb([A, B, C]);
  town = await t.rpc<string>(A, `public.create_town('넓어지는 마을', '재민')`);
  const inv = await t.rpc<string>(A, 'public.create_invite()');
  await t.rpc(B, `public.accept_invite($1, '지우')`, [inv]);
  await t.rpc(C, `public.create_town('남의 마을', '세오')`);
}, 60_000);

describe('땅 넓히기', () => {
  it('열리기 전에는 구역 부지에 지을 수 없다', async () => {
    await expect(t.rpc(A, 'public.create_project($1::jsonb)', [project('plot-e1a')])).rejects.toThrow(/plot locked/);
    await expect(t.rpc(A, 'public.create_project($1::jsonb)', [project('plot-zz')])).rejects.toThrow(/plot locked/);
  });

  it('광고를 15초 안에 끝내면 보상이 없다', async () => {
    const s = await t.rpc<{ session: string; slot: string }>(A, 'public.start_expansion_ad($1)', [town]);
    expect(s.slot).toBe('e1');
    await expect(t.rpc(A, 'public.claim_expansion($1)', [s.session])).rejects.toThrow(/ad too short/);
  });

  it('다 보면 동쪽 구역이 열리고, 같은 세션으로 두 번 받을 수 없다', async () => {
    const s = await t.rpc<{ session: string }>(A, 'public.start_expansion_ad($1)', [town]);
    await watched(s.session);
    expect(await t.rpc(A, 'public.claim_expansion($1)', [s.session])).toBe('e1');
    await expect(t.rpc(A, 'public.claim_expansion($1)', [s.session])).rejects.toThrow(/already claimed/);
    // 친구에게도 보이고, 친구도 그 부지에 지을 수 있다
    expect(await t.rows(B, 'select slot from public.town_expansions where town_id = $1', [town])).toEqual([{ slot: 'e1' }]);
    expect(await t.rpc(B, 'public.create_project($1::jsonb)', [project('plot-e1b')])).toBeTruthy();
    // 아직 안 열린 남쪽은 여전히 막힘
    await expect(t.rpc(A, 'public.create_project($1::jsonb)', [project('plot-s1a')])).rejects.toThrow(/plot locked/);
  });

  it('다른 사람의 세션이나 다른 마을은 쓸 수 없다', async () => {
    const s = await t.rpc<{ session: string }>(A, 'public.start_expansion_ad($1)', [town]);
    await watched(s.session);
    await expect(t.rpc(B, 'public.claim_expansion($1)', [s.session])).rejects.toThrow(/forbidden/);
    await expect(t.rpc(C, 'public.start_expansion_ad($1)', [town])).rejects.toThrow(/forbidden/);
    expect(await t.rpc(A, 'public.claim_expansion($1)', [s.session])).toBe('s1');
  });

  it('한 사람 하루 3회, 마을당 4구역까지', async () => {
    const s3 = await t.rpc<{ session: string }>(A, 'public.start_expansion_ad($1)', [town]);
    await watched(s3.session);
    expect(await t.rpc(A, 'public.claim_expansion($1)', [s3.session])).toBe('e2');
    await expect(t.rpc(A, 'public.start_expansion_ad($1)', [town])).rejects.toThrow(/ad limit/);
    const s4 = await t.rpc<{ session: string }>(B, 'public.start_expansion_ad($1)', [town]);
    await watched(s4.session);
    expect(await t.rpc(B, 'public.claim_expansion($1)', [s4.session])).toBe('s2');
    await expect(t.rpc(B, 'public.start_expansion_ad($1)', [town])).rejects.toThrow(/no more land/);
  });

  it('직접 표에 쓸 수 없다', async () => {
    await expect(t.rows(A, `insert into public.town_expansions (town_id, slot) values ($1, 'e1')`, [town])).rejects.toThrow(/permission denied/);
  });
});

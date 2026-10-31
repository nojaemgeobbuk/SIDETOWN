// v1.6: 땅 넓히기 없이 처음부터 부지 9칸. v1.5 마이그레이션을 이미 실행한 DB도 정리된다
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { makeDb, uid } from './harness';

const A = uid(1);
const project = (plot: string, title = '새 프로젝트') =>
  JSON.stringify({
    title, building: 'lab', plot_id: plot, start_date: '2026-11-01', target_date: '2026-12-31',
    milestones: [{ title: '시작', start_date: '2026-11-01', target_date: '2026-12-31' }],
    first_quest: { title: '첫 걸음', estimated_minutes: 15, due_date: '2026-11-02' },
  });

async function setup() {
  const t = await makeDb([A]);
  await t.rpc(A, `public.create_town('우리 마을', '재민')`);
  return t;
}

describe('부지 9칸(v1.6)', () => {
  let t: Awaited<ReturnType<typeof setup>>;
  beforeAll(async () => {
    t = await setup();
  }, 60_000);

  it('새 부지 4칸에 광고 없이 바로 지을 수 있다', async () => {
    for (const p of ['plot-e1a', 'plot-e1b', 'plot-s1a', 'plot-s1b']) {
      expect(await t.rpc(A, 'public.create_project($1::jsonb)', [project(p, p)]), p).toBeTruthy();
    }
  });

  it('지도에 없는 부지 이름은 막는다', async () => {
    await expect(t.rpc(A, 'public.create_project($1::jsonb)', [project('plot-e2a')])).rejects.toThrow(/bad plot/);
    await expect(t.rpc(A, 'public.create_project($1::jsonb)', [project('anywhere')])).rejects.toThrow(/bad plot/);
  });

  it('땅 넓히기 표·함수가 남아 있지 않다', async () => {
    const r = await t.db.query<{ n: number }>(`select count(*)::int n from pg_tables where schemaname='public' and tablename in ('town_expansions','ad_sessions')`);
    expect(r.rows[0].n).toBe(0);
  });

  it('v1.5 마이그레이션을 이미 실행한 DB에 v1.6을 다시 실행해도 정리된다', async () => {
    const t = await setup();
    // 앞 테스트에서 s1a를 썼으므로 새 마을
    // v1.5 상태로 되돌린 뒤 v1.6 파일을 다시 실행
    await t.db.exec(readFileSync(path.join(import.meta.dirname, 'fixtures-v15-land.sql'), 'utf8'));
    await expect(t.rpc(A, 'public.create_project($1::jsonb)', [project('plot-s1a')])).rejects.toThrow(/plot locked/);
    await t.db.exec(readFileSync(path.join(import.meta.dirname, '../migrations/20261101000000_fixed_land.sql'), 'utf8'));
    expect(await t.rpc(A, 'public.create_project($1::jsonb)', [project('plot-s1a')])).toBeTruthy();
    const r = await t.db.query<{ n: number }>(`select count(*)::int n from pg_tables where schemaname='public' and tablename in ('town_expansions','ad_sessions')`);
    expect(r.rows[0].n).toBe(0);
  }, 60_000);
});

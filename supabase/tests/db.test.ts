// 마이그레이션을 실제 Postgres(PGlite)에 올려 RLS·보상·정원 규칙을 확인한다.
// Supabase의 auth 스키마와 역할은 최소한으로 흉내 낸다.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

const MIGRATION = readFileSync(
  path.resolve(import.meta.dirname, '../migrations/20261027000000_init.sql'),
  'utf8',
);

const PRELUDE = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
`;

const U = {
  a: '00000000-0000-4000-8000-00000000000a',
  b: '00000000-0000-4000-8000-00000000000b',
  c: '00000000-0000-4000-8000-00000000000c',
  d: '00000000-0000-4000-8000-00000000000d',
};
const extra = Array.from({ length: 7 }, (_, i) => `00000000-0000-4000-8000-1000000000${String(i).padStart(2, '0')}`);

let db: PGlite;

async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]);
  await db.exec('set role authenticated');
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
  }
}
async function rpc<T = unknown>(uid: string, sql: string, params: unknown[] = []): Promise<T> {
  return as(uid, async () => {
    const r = await db.query<{ v: T }>(`select ${sql} as v`, params);
    return r.rows[0].v;
  });
}
async function rows<T = Record<string, unknown>>(uid: string, sql: string, params: unknown[] = []) {
  return as(uid, async () => (await db.query<T>(sql, params)).rows);
}

let townA: string;
let projectId: string;
let questId: string;
let milestoneIds: string[];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(PRELUDE);
  await db.exec(MIGRATION);
  for (const id of [...Object.values(U), ...extra]) {
    await db.query('insert into auth.users (id) values ($1)', [id]);
  }
  townA = await rpc<string>(U.a, `public.create_town('노을 마을', '재민')`);
  const token = await rpc<string>(U.a, 'public.create_invite()');
  await rpc(U.b, `public.accept_invite($1, '지우')`, [token]);
  await rpc(U.d, `public.accept_invite($1, '민')`, [token]);
  await rpc(U.c, `public.create_town('다른 마을', '세오')`);

  projectId = await rpc<string>(U.a, 'public.create_project($1::jsonb)', [
    JSON.stringify({
      title: '에세이 출간', building: 'bookstore', plot_id: 'plot-b',
      start_date: '2026-10-01', target_date: '2026-12-31',
      milestones: [
        { title: '목차', start_date: '2026-10-01', target_date: '2026-10-31' },
        { title: '초고', start_date: '2026-11-01', target_date: '2026-12-31' },
      ],
      first_quest: { title: '목차 10줄', estimated_minutes: 20, due_date: '2026-10-10' },
    }),
  ]);
  const q = await rows<{ id: string }>(U.a, 'select id from public.quests where project_id = $1', [projectId]);
  questId = q[0].id;
  milestoneIds = (await rows<{ id: string }>(U.a, 'select id from public.milestones where project_id = $1 order by position', [projectId])).map((r) => r.id);
}, 60_000);

describe('RLS', () => {
  it('같은 마을 친구는 프로젝트 겉모습만, 다른 마을은 아무것도 못 본다', async () => {
    expect(await rows(U.b, 'select title, stage from public.projects')).toEqual([{ title: '에세이 출간', stage: 0 }]);
    expect(await rows(U.b, 'select id from public.milestones')).toEqual([]);
    expect(await rows(U.b, 'select id from public.quests')).toEqual([]);
    expect(await rows(U.c, 'select id from public.projects')).toEqual([]);
    expect((await rows(U.a, 'select id from public.milestones')).length).toBe(2);
  });

  it('표에 직접 쓸 수 없다', async () => {
    await expect(rows(U.a, `update public.projects set stage = 3`)).rejects.toThrow(/permission denied/);
    await expect(rows(U.a, `insert into public.reward_ledger (event_id, user_id, amount) values (gen_random_uuid(), $1, 9999)`, [U.a])).rejects.toThrow(/permission denied/);
  });

  it('내부 도우미 함수는 직접 부를 수 없다', async () => {
    await expect(rpc(U.b, 'public.rebaseline($1)', [projectId])).rejects.toThrow(/permission denied/);
  });

  it('남의 퀘스트는 완료할 수 없다', async () => {
    await expect(rpc(U.b, `public.complete_quest($1, 'key-steal-0001')`, [questId])).rejects.toThrow(/forbidden/);
  });
});

describe('보상 원장', () => {
  it('같은 키로 두 번 완료해도 XP는 한 번만', async () => {
    await rpc(U.a, `public.complete_quest($1, 'key-quest-0001')`, [questId]);
    const again = await rpc<{ replayed: boolean }>(U.a, `public.complete_quest($1, 'key-quest-0001')`, [questId]);
    expect(again.replayed).toBe(true);
    expect(await rpc<number>(U.a, 'public.my_xp()')).toBe(10);
  });

  it('완료 취소는 반대 사건으로 역산된다', async () => {
    await rpc(U.a, `public.reopen_quest($1, 'key-reopen-0001')`, [questId]);
    expect(await rpc<number>(U.a, 'public.my_xp()')).toBe(0);
    const ledger = await rows<{ amount: number }>(U.a, 'select amount from public.reward_ledger order by created_at');
    expect(ledger.map((r) => r.amount)).toEqual([10, -10]);
  });

  it('중간 목표 완료는 성과 기록이 있어야 하고 단계를 올린다', async () => {
    await rpc(U.a, `public.complete_quest($1, 'key-quest-0002')`, [questId]);
    await expect(rpc(U.a, `public.complete_milestone($1, '', 'key-ms-0001')`, [milestoneIds[0]])).rejects.toThrow(/evidence/);
    const r = await rpc<{ xp: number; stage_after: number }>(U.a, `public.complete_milestone($1, '목차 확정', 'key-ms-0002')`, [milestoneIds[0]]);
    expect(r).toMatchObject({ xp: 50, stage_before: 0, stage_after: 1 });
    expect(await rpc<number>(U.a, 'public.my_xp()')).toBe(60);
    // 친구 화면에도 단계 캐시가 보인다
    expect(await rows(U.b, 'select stage from public.projects')).toEqual([{ stage: 1 }]);
  });

  it('마지막 중간 목표를 끝내면 프로젝트 완료 보상이 붙는다', async () => {
    const r = await rpc<{ xp: number; stage_after: number }>(U.a, `public.complete_milestone($1, '초고 완성', 'key-ms-0003')`, [milestoneIds[1]]);
    expect(r).toMatchObject({ xp: 200, stage_after: 3 });
    expect(await rpc<number>(U.a, 'public.my_xp()')).toBe(260);
  });
});

describe('낡음·복구', () => {
  it('30일 넘게 밀리면 낡고, 퀘스트 1개로 복구된다', async () => {
    const pid = await rpc<string>(U.b, 'public.create_project($1::jsonb)', [
      JSON.stringify({
        title: '정보처리기사', building: 'lab', plot_id: 'plot-c',
        start_date: '2026-07-01', target_date: '2026-09-01',
        milestones: [{ title: '필기', start_date: '2026-07-01', target_date: '2026-09-01' }],
        first_quest: { title: '기출 1회', estimated_minutes: 15, due_date: '2026-07-10' },
      }),
    ]);
    expect(await rpc<number>(U.b, `public.refresh_my_conditions('2026-10-27')`)).toBe(1);
    await rpc(U.b, 'public.start_work($1, null)', [pid]);
    expect((await rows<{ condition: string }>(U.b, 'select condition from public.projects where id = $1', [pid]))[0].condition).toBe('repairing');
    const [{ id: q }] = await rows<{ id: string }>(U.b, 'select id from public.quests where project_id = $1', [pid]);
    const r = await rpc<{ restored: boolean }>(U.b, `public.complete_quest($1, 'key-restore-01')`, [q]);
    expect(r.restored).toBe(true);
    const [p] = await rows<{ condition: string; baseline_target_date: string }>(U.b, `select condition, baseline_target_date::text from public.projects where id = $1`, [pid]);
    expect(p.condition).toBe('normal');
  });

  it('계획 버전이 다르면 일정 적용을 거절한다', async () => {
    await expect(rpc(U.a, `public.apply_schedule($1, 99, 'cascade', 7, '{}'::jsonb, '2026-10-27')`, [projectId])).rejects.toThrow(/version conflict/);
  });
});

describe('마을 정원', () => {
  it('8명을 넘길 수 없고 한 사람은 한 마을에만', async () => {
    // 지금 a·b·d = 3명. 5명 더 → 8명
    const t1 = await rpc<string>(U.a, 'public.create_invite()');
    for (const id of extra.slice(0, 5)) await rpc(id, `public.accept_invite($1, '이웃')`, [t1]);
    expect(await rows(U.a, 'select user_id from public.town_members')).toHaveLength(8);
    await expect(rpc(extra[5], `public.accept_invite($1, '이웃')`, [t1])).rejects.toThrow(/town full/);
    const t2 = await rpc<string>(U.a, 'public.create_invite()');
    await expect(rpc(U.c, `public.accept_invite($1, '세오')`, [t2])).rejects.toThrow(/already in a town|town full/);
  });

  it('초대 미리보기는 로그인 전에도 이름만 보인다', async () => {
    const t = await rpc<string>(U.a, 'public.create_invite()');
    await db.exec('set role anon');
    try {
      const r = await db.query<{ v: { town_name: string } }>('select public.invite_preview($1) as v', [t]);
      expect(r.rows[0].v.town_name).toBe('노을 마을');
      await expect(db.query('select * from public.towns')).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec('reset role');
    }
  });
});

describe('쪽지·게시판', () => {
  it('쪽지는 보낸 사람·받는 사람만, 게시판은 마을 사람 모두', async () => {
    // 응원은 받는 사람의 프로젝트에만 붙일 수 있다
    await expect(rpc(U.a, `public.send_message($1, '응원', $2)`, [U.b, projectId])).rejects.toThrow(/project not visible/);
    const [{ id: bProject }] = await rows<{ id: string }>(U.a, 'select id from public.projects where owner_id = $1', [U.b]);
    await rpc(U.a, `public.send_message($1, '기출 응원해요', $2)`, [U.b, bProject]);
    await rpc(U.b, `public.send_message(null, '오늘 카페에서 집중해요', null)`);
    expect((await rows(U.b, 'select body from public.messages where recipient_id is not null')).length).toBe(1);
    expect((await rows(U.d, 'select body from public.messages where recipient_id is not null')).length).toBe(0);
    expect((await rows(U.d, 'select body from public.messages where recipient_id is null')).length).toBe(1);
    expect(await rows(U.c, 'select body from public.messages')).toEqual([]);
  });

  it('다른 마을 사람에게는 보낼 수 없고, 1분에 5번까지', async () => {
    await expect(rpc(U.a, `public.send_message($1, '안녕', null)`, [U.c])).rejects.toThrow(/recipient not in town/);
    for (let i = 0; i < 4; i++) await rpc(U.a, `public.send_message(null, $1, null)`, [`글 ${i}`]);
    await expect(rpc(U.a, `public.send_message(null, '여섯 번째', null)`)).rejects.toThrow(/rate limited/);
  });

  it('읽음 표시', async () => {
    expect(await rpc<number>(U.b, 'public.mark_read($1)', [U.a])).toBe(1);
    expect(await rpc<number>(U.b, 'public.mark_read($1)', [U.a])).toBe(0);
  });
});

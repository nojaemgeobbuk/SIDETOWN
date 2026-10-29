// 마이그레이션 전체를 실제 Postgres(PGlite)에 순서대로 올린다. Supabase의 auth 스키마·역할은 최소한으로 흉내 낸다.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const DIR = path.resolve(import.meta.dirname, '../migrations');

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

export const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export async function makeDb(users: string[]) {
  const db = new PGlite();
  await db.exec(PRELUDE);
  for (const f of readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(path.join(DIR, f), 'utf8'));
  }
  for (const id of users) await db.query('insert into auth.users (id) values ($1)', [id]);

  async function as<T>(user: string, fn: () => Promise<T>): Promise<T> {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user]);
    await db.exec('set role authenticated');
    try {
      return await fn();
    } finally {
      await db.exec('reset role');
    }
  }
  async function rpc<T = unknown>(user: string, sql: string, params: unknown[] = []): Promise<T> {
    return as(user, async () => {
      const r = await db.query<{ v: T }>(`select ${sql} as v`, params);
      return r.rows[0].v;
    });
  }
  async function rows<T = Record<string, unknown>>(user: string, sql: string, params: unknown[] = []) {
    return as(user, async () => (await db.query<T>(sql, params)).rows);
  }
  return { db, as, rpc, rows };
}

-- SideTown v1.5 — 땅 넓히기: 보상형 광고를 보면 마을에 프로젝트 부지 2칸짜리 구역이 하나 열린다.
-- 구역은 정해진 순서(e1 동쪽 → s1 남쪽 → e2 → s2)로 열리고, 마을 사람 모두가 함께 쓴다.
--
-- 웹 보상형 광고(Google Ad Manager GPT)는 서버에서 시청을 확인할 방법이 없다(서버 측 확인은 모바일 앱 전용).
-- 그래서 서버는 이렇게만 지킨다: 광고 시작을 먼저 기록하고(start), 최소 15초가 지나야 보상(claim),
-- 한 사람 하루 3회, 마을당 4구역까지. 조작으로 얻을 수 있는 건 ‘조금 빨리 열린 땅’ 정도다.

create table public.town_expansions (
  town_id uuid not null references public.towns (id) on delete cascade,
  slot text not null check (slot in ('e1', 's1', 'e2', 's2')),
  unlocked_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (town_id, slot)
);

create table public.ad_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  town_id uuid not null references public.towns (id) on delete cascade,
  purpose text not null default 'expansion' check (purpose in ('expansion')),
  started_at timestamptz not null default now(),
  claimed_at timestamptz
);
create index ad_sessions_user_idx on public.ad_sessions (user_id, started_at);

alter table public.town_expansions enable row level security;
alter table public.ad_sessions enable row level security;
create policy town_expansions_read on public.town_expansions for select to authenticated using (public.is_town_member(town_id));
create policy ad_sessions_read on public.ad_sessions for select to authenticated using (user_id = auth.uid());
revoke all on public.town_expansions, public.ad_sessions from anon, authenticated;
grant select on public.town_expansions, public.ad_sessions to authenticated;

-- 다음에 열 구역(다 열렸으면 null)
create or replace function public.next_expansion(t uuid) returns text
language sql stable security definer set search_path = public as $$
  select s from unnest(array['e1', 's1', 'e2', 's2']) with ordinality as o(s, i)
   where not exists (select 1 from public.town_expansions e where e.town_id = t and e.slot = o.s)
   order by i limit 1
$$;

-- 그 마을에서 쓸 수 있는 부지인가: 기본 5칸 + 열린 구역의 a·b
create or replace function public.plot_allowed(t uuid, plot text) returns boolean
language sql stable security definer set search_path = public as $$
  select plot in ('plot-a', 'plot-b', 'plot-c', 'plot-d', 'plot-e')
      or (plot ~ '^plot-(e1|s1|e2|s2)[ab]$'
          and exists (select 1 from public.town_expansions e where e.town_id = t and e.slot = substring(plot from 6 for 2)))
$$;

-- 착공·복사 등 어떤 경로로든 열리지 않은 부지에 건물을 세울 수 없게
create or replace function public.check_plot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.plot_id is not null and new.town_id is not null and not public.plot_allowed(new.town_id, new.plot_id) then
    raise exception 'plot locked' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists projects_check_plot on public.projects;
create trigger projects_check_plot before insert or update of plot_id, town_id on public.projects
  for each row execute function public.check_plot();

-- 광고 시작: 보상받을 자격을 확인하고 세션을 연다
create or replace function public.start_expansion_ad(p_town uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); slot text; sid uuid;
begin
  if not public.is_town_member(p_town) then raise exception 'forbidden' using errcode = '42501'; end if;
  slot := public.next_expansion(p_town);
  if slot is null then raise exception 'no more land' using errcode = '22023'; end if;
  if (select count(*) from public.ad_sessions where user_id = uid and claimed_at > now() - interval '1 day') >= 3 then
    raise exception 'ad limit' using errcode = '53400';
  end if;
  -- 너무 자주 시작하는 것도 막는다(1분 5회)
  if (select count(*) from public.ad_sessions where user_id = uid and started_at > now() - interval '1 minute') >= 5 then
    raise exception 'rate limited' using errcode = '53400';
  end if;
  insert into public.ad_sessions (user_id, town_id) values (uid, p_town) returning id into sid;
  return jsonb_build_object('session', sid, 'slot', slot, 'min_seconds', 15);
end $$;

-- 광고를 끝까지 봤다: 다음 구역을 연다(그 사이 친구가 먼저 열었으면 그다음 구역)
create or replace function public.claim_expansion(p_session uuid) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); s public.ad_sessions; slot text;
begin
  select * into s from public.ad_sessions where id = p_session for update;
  if s.id is null or s.user_id <> uid then raise exception 'forbidden' using errcode = '42501'; end if;
  if s.claimed_at is not null then raise exception 'already claimed' using errcode = '22023'; end if;
  if now() - s.started_at < interval '15 seconds' then raise exception 'ad too short' using errcode = '22023'; end if;
  if now() - s.started_at > interval '1 hour' then raise exception 'ad expired' using errcode = '22023'; end if;
  perform 1 from public.towns where id = s.town_id for update;
  slot := public.next_expansion(s.town_id);
  if slot is null then raise exception 'no more land' using errcode = '22023'; end if;
  insert into public.town_expansions (town_id, slot, unlocked_by) values (s.town_id, slot, uid);
  update public.ad_sessions set claimed_at = now() where id = s.id;
  return slot;
end $$;

grant execute on function public.start_expansion_ad(uuid), public.claim_expansion(uuid), public.next_expansion(uuid) to authenticated;
revoke execute on function public.plot_allowed(uuid, text), public.check_plot() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.town_expansions;
  end if;
end $$;

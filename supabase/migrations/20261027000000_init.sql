-- SideTown 단계 1 스키마 — 기획서 v1.2 16·17·18절
-- 원칙
--  * 클라이언트는 표(table)를 직접 쓰지 않는다. 모든 쓰기는 아래 security definer 함수(RPC)로만 한다.
--    그래야 보상·성장 단계·마을 정원 같은 규칙을 우회할 수 없다.
--  * 읽기는 RLS로 막는다. 같은 마을 친구는 프로젝트의 겉모습(이름·건물·단계·상태)만 볼 수 있고
--    중간 목표·퀘스트·성과 메모는 소유자만 볼 수 있다.
--  * 보상은 원장(reward_ledger)에 쌓기만 한다. 취소는 반대 사건을 추가해 역산한다.

-- ───────────────────────── 표 ─────────────────────────

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  timezone text not null default 'Asia/Seoul',
  delay_visuals_enabled boolean not null default true,
  focus_prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.towns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  name text not null check (char_length(name) between 1 and 30),
  created_at timestamptz not null default now()
);

create table public.town_members (
  town_id uuid not null references public.towns (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (town_id, user_id),
  -- 첫 버전은 한 사람이 한 마을에만 속한다
  unique (user_id)
);
create index town_members_town_idx on public.town_members (town_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  town_id uuid not null references public.towns (id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references auth.users (id),
  expires_at timestamptz not null default now() + interval '7 days',
  max_uses int not null default 7 check (max_uses between 1 and 7),
  uses int not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index invites_town_idx on public.invites (town_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  town_id uuid references public.towns (id) on delete set null,
  plot_id text,
  building text not null check (building in ('workshop', 'bookstore', 'lab')),
  color text not null default '#F4B03E' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  title text not null check (char_length(title) between 1 and 60),
  definition_of_done text not null default '' check (char_length(definition_of_done) <= 200),
  start_date date not null,
  target_date date not null,
  baseline_target_date date not null,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'archived')),
  condition text not null default 'normal' check (condition in ('normal', 'decayed', 'repairing')),
  -- 친구 화면에 건물을 그리기 위한 캐시. 원본은 milestones 완료 상태(compute_stage로 재계산 가능)
  stage smallint not null default 0 check (stage between 0 and 3),
  visibility text not null default 'town' check (visibility in ('private', 'town')),
  plan_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (town_id, plot_id)
);
create index projects_owner_idx on public.projects (owner_id);
create index projects_town_idx on public.projects (town_id);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  criteria text not null default '',
  weight int not null default 1 check (weight between 1 and 10),
  position int not null,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed')),
  start_date date not null,
  target_date date not null,
  baseline_start_date date not null,
  baseline_target_date date not null,
  pinned boolean not null default false,
  evidence text check (char_length(evidence) <= 500),
  completed_at timestamptz,
  unique (project_id, position)
);
create index milestones_project_idx on public.milestones (project_id, position);

create table public.quests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  milestone_id uuid not null references public.milestones (id) on delete cascade,
  assignee_id uuid not null references auth.users (id),
  title text not null check (char_length(title) between 1 and 80),
  estimated_minutes int not null default 30 check (estimated_minutes between 1 and 600),
  actual_minutes int not null default 0,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  position int not null default 0,
  scheduled_start date,
  due_date date,
  baseline_due_date date,
  pinned boolean not null default false,
  completed_at timestamptz
);
create index quests_project_idx on public.quests (project_id);
create index quests_milestone_idx on public.quests (milestone_id, position);
create index quests_assignee_sched_idx on public.quests (assignee_id, scheduled_start);

create table public.completion_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('quest', 'milestone', 'project')),
  entity_id uuid not null,
  actor_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('complete', 'reopen')),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 100),
  reversal_of uuid references public.completion_events (id),
  created_at timestamptz not null default now(),
  unique (actor_id, idempotency_key)
);
create index completion_events_entity_idx on public.completion_events (entity_type, entity_id, created_at);

create table public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.completion_events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reward_type text not null default 'xp' check (reward_type in ('xp')),
  amount int not null,
  rule_version int not null default 1,
  created_at timestamptz not null default now(),
  unique (event_id, user_id, reward_type)
);
create index reward_ledger_user_idx on public.reward_ledger (user_id);

create table public.schedule_changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  actor_id uuid not null references auth.users (id),
  scope text not null check (scope in ('only', 'cascade', 'squeeze', 'rebaseline', 'pause', 'resume')),
  days int not null default 0,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index schedule_changes_project_idx on public.schedule_changes (project_id, created_at);

-- 기획서 13.5 쪽지·게시판: recipient_id가 null이면 마을 게시판
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  town_id uuid not null references public.towns (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index messages_recipient_idx on public.messages (recipient_id, created_at);
create index messages_town_board_idx on public.messages (town_id, created_at) where recipient_id is null;
create index messages_sender_idx on public.messages (sender_id, created_at);

create table public.message_reads (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'plan_draft',
  status text not null default 'ok',
  created_at timestamptz not null default now()
);
create index ai_usage_user_idx on public.ai_usage (user_id, created_at);

-- ───────────────────────── 도우미 ─────────────────────────

create or replace function public.require_user() returns uuid
language plpgsql stable as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  return uid;
end $$;

-- RLS 안에서 쓰므로 security definer(재귀 방지)
create or replace function public.my_town_id() returns uuid
language sql stable security definer set search_path = public as $$
  select town_id from public.town_members where user_id = auth.uid()
$$;

create or replace function public.is_town_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.town_members where town_id = t and user_id = auth.uid())
$$;

create or replace function public.owns_project(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects where id = p and owner_id = auth.uid())
$$;

-- 기획서 11절 성장 4단계
create or replace function public.compute_stage(p uuid) returns smallint
language sql stable as $$
  select case
    when pr.status = 'completed' then 3
    when coalesce(sum(m.weight) filter (where m.status = 'completed'), 0) = 0 then 0
    when count(m.*) <= 1 then 1
    when sum(m.weight) filter (where m.status = 'completed')::numeric / nullif(sum(m.weight), 0) >= 0.6 then 2
    else 1
  end::smallint
  from public.projects pr left join public.milestones m on m.project_id = pr.id
  where pr.id = p
  group by pr.status
$$;

-- 기획서 8.3 누적 지연(일)
create or replace function public.delay_days(p public.projects, today date) returns int
language sql immutable as $$
  select case when p.status = 'completed' then 0
    else greatest(0, p.target_date - p.baseline_target_date) + greatest(0, today - p.target_date) end
$$;

create or replace function public.rebaseline(p uuid) returns void
language sql security definer set search_path = public as $$
  update public.projects set baseline_target_date = target_date where id = p;
  update public.milestones set baseline_start_date = start_date, baseline_target_date = target_date where project_id = p;
  update public.quests set baseline_due_date = due_date where project_id = p;
$$;

-- ───────────────────────── RLS ─────────────────────────

alter table public.profiles enable row level security;
alter table public.towns enable row level security;
alter table public.town_members enable row level security;
alter table public.invites enable row level security;
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.quests enable row level security;
alter table public.completion_events enable row level security;
alter table public.reward_ledger enable row level security;
alter table public.schedule_changes enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;
alter table public.ai_usage enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from public.town_members a join public.town_members b on a.town_id = b.town_id
    where a.user_id = auth.uid() and b.user_id = profiles.user_id));

create policy towns_read on public.towns for select to authenticated using (public.is_town_member(id));
create policy town_members_read on public.town_members for select to authenticated using (public.is_town_member(town_id));
create policy invites_read on public.invites for select to authenticated using (public.is_town_member(town_id));

create policy projects_read on public.projects for select to authenticated
  using (owner_id = auth.uid() or (visibility = 'town' and status <> 'archived' and public.is_town_member(town_id)));
create policy milestones_read on public.milestones for select to authenticated using (public.owns_project(project_id));
create policy quests_read on public.quests for select to authenticated using (public.owns_project(project_id));
create policy schedule_changes_read on public.schedule_changes for select to authenticated using (public.owns_project(project_id));

create policy completion_events_read on public.completion_events for select to authenticated using (actor_id = auth.uid());
create policy reward_ledger_read on public.reward_ledger for select to authenticated using (user_id = auth.uid());

create policy messages_read on public.messages for select to authenticated
  using (deleted_at is null and (
    sender_id = auth.uid() or recipient_id = auth.uid()
    or (recipient_id is null and public.is_town_member(town_id))));
create policy message_reads_read on public.message_reads for select to authenticated using (user_id = auth.uid());
create policy ai_usage_read on public.ai_usage for select to authenticated using (user_id = auth.uid());

-- 쓰기는 함수로만: 표 권한을 읽기로 제한
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;

-- ───────────────────────── 함수(RPC) ─────────────────────────

-- 닉네임 저장(처음이면 만든다)
create or replace function public.save_profile(p_nickname text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user();
begin
  insert into public.profiles (user_id, nickname) values (uid, trim(p_nickname))
  on conflict (user_id) do update set nickname = excluded.nickname;
end $$;

create or replace function public.create_town(p_name text, p_nickname text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); t uuid;
begin
  perform public.save_profile(p_nickname);
  if exists (select 1 from public.town_members where user_id = uid) then
    raise exception 'already in a town' using errcode = '23505';
  end if;
  insert into public.towns (owner_id, name) values (uid, trim(p_name)) returning id into t;
  insert into public.town_members (town_id, user_id, role) values (t, uid, 'owner');
  return t;
end $$;

-- 초대 링크 토큰: 원문은 한 번만 돌려주고 해시만 저장(기획서 13.1)
create or replace function public.create_invite() returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); t uuid := public.my_town_id(); token text;
begin
  if t is null then raise exception 'no town' using errcode = '42501'; end if;
  token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.invites (town_id, token_hash, created_by)
  values (t, encode(sha256(convert_to(token, 'UTF8')), 'hex'), uid);
  return token;
end $$;

-- 초대 미리보기(로그인 전 화면용 이름·정원). anon도 호출 가능
create or replace function public.invite_preview(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'town_name', t.name,
    'members', (select count(*) from public.town_members m where m.town_id = t.id),
    'valid', i.revoked_at is null and i.expires_at > now() and i.uses < i.max_uses)
  from public.invites i join public.towns t on t.id = i.town_id
  where i.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
$$;

-- 초대 수락: 정원 8명을 동시 수락에서도 넘지 않도록 마을 행을 잠근다(AC-02)
create or replace function public.accept_invite(p_token text, p_nickname text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); inv public.invites; n int;
begin
  select * into inv from public.invites
   where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') for update;
  if inv.id is null or inv.revoked_at is not null or inv.expires_at <= now() or inv.uses >= inv.max_uses then
    raise exception 'invite invalid' using errcode = '22023';
  end if;
  perform 1 from public.towns where id = inv.town_id for update;
  if exists (select 1 from public.town_members where user_id = uid) then
    raise exception 'already in a town' using errcode = '23505';
  end if;
  select count(*) into n from public.town_members where town_id = inv.town_id;
  if n >= 8 then raise exception 'town full' using errcode = '53400'; end if;
  perform public.save_profile(p_nickname);
  insert into public.town_members (town_id, user_id) values (inv.town_id, uid);
  update public.invites set uses = uses + 1 where id = inv.id;
  return inv.town_id;
end $$;

-- 착공: 프로젝트·중간 목표·첫 퀘스트를 한 번에(기획서 6.8)
-- p: {title, building, color, definition_of_done, plot_id, start_date, target_date,
--     milestones:[{title, criteria, weight, start_date, target_date}], first_quest:{title, estimated_minutes, due_date}}
create or replace function public.create_project(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); pid uuid; m jsonb; mid uuid; first_mid uuid; i int := 0;
begin
  if jsonb_array_length(coalesce(p->'milestones', '[]'::jsonb)) not between 1 and 12 then
    raise exception 'milestones 1..12' using errcode = '22023';
  end if;
  insert into public.projects (owner_id, town_id, plot_id, building, color, title, definition_of_done,
    start_date, target_date, baseline_target_date)
  values (uid, public.my_town_id(), p->>'plot_id', p->>'building', coalesce(p->>'color', '#F4B03E'),
    trim(p->>'title'), coalesce(p->>'definition_of_done', ''),
    (p->>'start_date')::date, (p->>'target_date')::date, (p->>'target_date')::date)
  returning id into pid;
  for m in select * from jsonb_array_elements(p->'milestones') loop
    insert into public.milestones (project_id, title, criteria, weight, position, status,
      start_date, target_date, baseline_start_date, baseline_target_date)
    values (pid, trim(m->>'title'), coalesce(m->>'criteria', ''), coalesce((m->>'weight')::int, 1), i,
      case when i = 0 then 'active' else 'planned' end,
      (m->>'start_date')::date, (m->>'target_date')::date, (m->>'start_date')::date, (m->>'target_date')::date)
    returning id into mid;
    if i = 0 then first_mid := mid; end if;
    i := i + 1;
  end loop;
  if p ? 'first_quest' and coalesce(trim(p->'first_quest'->>'title'), '') <> '' then
    insert into public.quests (project_id, milestone_id, assignee_id, title, estimated_minutes,
      scheduled_start, due_date, baseline_due_date)
    values (pid, first_mid, uid, trim(p->'first_quest'->>'title'),
      coalesce((p->'first_quest'->>'estimated_minutes')::int, 20),
      (p->>'start_date')::date, (p->'first_quest'->>'due_date')::date, (p->'first_quest'->>'due_date')::date);
  end if;
  return pid;
end $$;

-- 퀘스트 추가(AI 나누기·직접 추가)
create or replace function public.add_quest(p_milestone uuid, p_title text, p_minutes int, p_due date) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); ms public.milestones; qid uuid;
begin
  select * into ms from public.milestones where id = p_milestone;
  if ms.id is null or not public.owns_project(ms.project_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.quests (project_id, milestone_id, assignee_id, title, estimated_minutes, position, due_date, baseline_due_date)
  values (ms.project_id, ms.id, uid, trim(p_title), coalesce(p_minutes, 30),
    (select coalesce(max(position), -1) + 1 from public.quests where milestone_id = ms.id), p_due, p_due)
  returning id into qid;
  return qid;
end $$;

-- 퀘스트 완료(+10 XP). 같은 Idempotency-Key로 다시 불러도 결과가 같다(AC-06)
create or replace function public.complete_quest(p_quest uuid, p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); q public.quests; pr public.projects; ev uuid; restored boolean := false;
begin
  select id into ev from public.completion_events where actor_id = uid and idempotency_key = p_key;
  if ev is not null then return jsonb_build_object('event', ev, 'replayed', true); end if;
  select * into q from public.quests where id = p_quest for update;
  if q.id is null or not public.owns_project(q.project_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if q.status = 'done' then return jsonb_build_object('already_done', true); end if;
  select * into pr from public.projects where id = q.project_id for update;
  update public.quests set status = 'done', completed_at = now() where id = q.id;
  insert into public.completion_events (entity_type, entity_id, actor_id, action, idempotency_key)
  values ('quest', q.id, uid, 'complete', p_key) returning id into ev;
  insert into public.reward_ledger (event_id, user_id, amount) values (ev, uid, 10);
  -- 기획서 8.3: 낡았거나 수리 중이면 퀘스트 1개 완료로 복구하고 기준선을 다시 잡는다
  if pr.condition <> 'normal' then
    update public.projects set condition = 'normal', updated_at = now() where id = pr.id;
    perform public.rebaseline(pr.id);
    insert into public.schedule_changes (project_id, actor_id, scope) values (pr.id, uid, 'rebaseline');
    restored := true;
  end if;
  return jsonb_build_object('event', ev, 'xp', 10, 'restored', restored);
end $$;

-- 완료 취소(−10 XP): 지급 사건의 반대 사건을 남긴다(AC-07)
create or replace function public.reopen_quest(p_quest uuid, p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); q public.quests; last_ev uuid; ev uuid;
begin
  select id into ev from public.completion_events where actor_id = uid and idempotency_key = p_key;
  if ev is not null then return jsonb_build_object('event', ev, 'replayed', true); end if;
  select * into q from public.quests where id = p_quest for update;
  if q.id is null or not public.owns_project(q.project_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if q.status <> 'done' then return jsonb_build_object('not_done', true); end if;
  if exists (select 1 from public.milestones where id = q.milestone_id and status = 'completed') then
    raise exception 'milestone already completed' using errcode = '22023';
  end if;
  select id into last_ev from public.completion_events
   where entity_type = 'quest' and entity_id = q.id and action = 'complete' order by created_at desc limit 1;
  update public.quests set status = 'todo', completed_at = null where id = q.id;
  insert into public.completion_events (entity_type, entity_id, actor_id, action, idempotency_key, reversal_of)
  values ('quest', q.id, uid, 'reopen', p_key, last_ev) returning id into ev;
  if last_ev is not null then
    insert into public.reward_ledger (event_id, user_id, amount)
    select ev, uid, -amount from public.reward_ledger where event_id = last_ev and user_id = uid;
  end if;
  return jsonb_build_object('event', ev, 'xp', -10);
end $$;

-- 작업 시작: 이 퀘스트를 진행 중으로, 낡은 건물은 수리 중으로
create or replace function public.start_work(p_project uuid, p_quest uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_user();
  if not public.owns_project(p_project) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.quests set status = 'todo' where project_id = p_project and status = 'doing' and id is distinct from p_quest;
  if p_quest is not null then
    update public.quests set status = 'doing' where id = p_quest and project_id = p_project and status = 'todo';
  end if;
  update public.projects set condition = 'repairing', updated_at = now() where id = p_project and condition = 'decayed';
end $$;

-- 중간 목표 완료(+50 XP, 최종 완료면 +150 추가). 성과 기록 필수
create or replace function public.complete_milestone(p_milestone uuid, p_evidence text, p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); ms public.milestones; ev uuid; ev2 uuid; before smallint; after smallint; all_done boolean;
begin
  select id into ev from public.completion_events where actor_id = uid and idempotency_key = p_key;
  if ev is not null then return jsonb_build_object('event', ev, 'replayed', true); end if;
  select * into ms from public.milestones where id = p_milestone for update;
  if ms.id is null or not public.owns_project(ms.project_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if ms.status = 'completed' then return jsonb_build_object('already_done', true); end if;
  if coalesce(trim(p_evidence), '') = '' then raise exception 'evidence required' using errcode = '22023'; end if;
  if exists (select 1 from public.quests where milestone_id = ms.id and status <> 'done') then
    raise exception 'open quests remain' using errcode = '22023';
  end if;
  perform 1 from public.projects where id = ms.project_id for update;
  before := public.compute_stage(ms.project_id);
  update public.milestones set status = 'completed', evidence = trim(p_evidence), completed_at = now() where id = ms.id;
  update public.milestones set status = 'active'
   where project_id = ms.project_id and status = 'planned'
     and position = (select min(position) from public.milestones where project_id = ms.project_id and status = 'planned');
  insert into public.completion_events (entity_type, entity_id, actor_id, action, idempotency_key)
  values ('milestone', ms.id, uid, 'complete', p_key) returning id into ev;
  insert into public.reward_ledger (event_id, user_id, amount) values (ev, uid, 50);
  select bool_and(status = 'completed') into all_done from public.milestones where project_id = ms.project_id;
  if all_done then
    update public.projects set status = 'completed', condition = 'normal' where id = ms.project_id;
    insert into public.completion_events (entity_type, entity_id, actor_id, action, idempotency_key)
    values ('project', ms.project_id, uid, 'complete', p_key || ':project') returning id into ev2;
    insert into public.reward_ledger (event_id, user_id, amount) values (ev2, uid, 150);
  end if;
  after := public.compute_stage(ms.project_id);
  update public.projects set stage = after, updated_at = now() where id = ms.project_id;
  return jsonb_build_object('event', ev, 'xp', case when all_done then 200 else 50 end, 'stage_before', before, 'stage_after', after);
end $$;

-- 일정 적용(기획서 8.2). 날짜 계산은 앱의 순수 함수(schedule.ts)가 하고, 여기서는 권한·버전·범위를 검사해 한 번에 적용한다
-- p_changes: {target_date, milestones:[{id,start_date,target_date}], quests:[{id,scheduled_start,due_date}]}
create or replace function public.apply_schedule(p_project uuid, p_version int, p_scope text, p_days int, p_changes jsonb, p_today date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); pr public.projects; x jsonb; new_condition text;
begin
  select * into pr from public.projects where id = p_project for update;
  if pr.id is null or pr.owner_id <> uid then raise exception 'forbidden' using errcode = '42501'; end if;
  if pr.plan_version <> p_version then raise exception 'version conflict' using errcode = '40001'; end if;
  for x in select * from jsonb_array_elements(coalesce(p_changes->'milestones', '[]'::jsonb)) loop
    update public.milestones set start_date = (x->>'start_date')::date, target_date = (x->>'target_date')::date
     where id = (x->>'id')::uuid and project_id = p_project and status <> 'completed' and not pinned;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p_changes->'quests', '[]'::jsonb)) loop
    update public.quests set scheduled_start = (x->>'scheduled_start')::date, due_date = (x->>'due_date')::date
     where id = (x->>'id')::uuid and project_id = p_project and status <> 'done' and not pinned;
  end loop;
  if p_changes ? 'target_date' then
    update public.projects set target_date = (p_changes->>'target_date')::date where id = p_project;
  end if;
  select * into pr from public.projects where id = p_project;
  new_condition := case
    when pr.status <> 'active' then 'normal'
    when public.delay_days(pr, p_today) < 30 then 'normal'
    when pr.condition = 'repairing' then 'repairing'
    else 'decayed' end;
  update public.projects set plan_version = plan_version + 1, condition = new_condition, updated_at = now() where id = p_project;
  insert into public.schedule_changes (project_id, actor_id, scope, days, snapshot) values (p_project, uid, p_scope, p_days, p_changes);
  return jsonb_build_object('plan_version', pr.plan_version + 1, 'condition', new_condition, 'delay_days', public.delay_days(pr, p_today));
end $$;

-- 항해 쉬기·재개(쉬는 동안은 낡지 않는다)
create or replace function public.set_paused(p_project uuid, p_paused boolean, p_today date) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); pr public.projects;
begin
  select * into pr from public.projects where id = p_project for update;
  if pr.id is null or pr.owner_id <> uid then raise exception 'forbidden' using errcode = '42501'; end if;
  if pr.status not in ('active', 'paused') then return pr.status; end if;
  update public.projects set status = case when p_paused then 'paused' else 'active' end,
    condition = case when p_paused then 'normal'
      when public.delay_days(pr, p_today) >= 30 then 'decayed' else 'normal' end,
    updated_at = now()
   where id = p_project;
  insert into public.schedule_changes (project_id, actor_id, scope) values (p_project, uid, case when p_paused then 'pause' else 'resume' end);
  return case when p_paused then 'paused' else 'active' end;
end $$;

-- 접속 시 내 프로젝트의 낡음 상태를 오늘 날짜로 다시 판정(매일 배치 대신 쓸 수 있음)
create or replace function public.refresh_my_conditions(p_today date) returns int
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); n int;
begin
  update public.projects p set condition = 'decayed', updated_at = now()
   where p.owner_id = uid and p.status = 'active' and p.condition = 'normal' and public.delay_days(p, p_today) >= 30;
  get diagnostics n = row_count;
  return n;
end $$;

-- 쪽지·게시판(기획서 13.5). 1분 5회, 하루 100회
create or replace function public.send_message(p_to uuid, p_body text, p_project uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); t uuid := public.my_town_id(); mid uuid; body text := trim(p_body);
begin
  if t is null then raise exception 'no town' using errcode = '42501'; end if;
  if body is null or char_length(body) = 0 then raise exception 'empty' using errcode = '22023'; end if;
  if char_length(body) > 200 then body := left(body, 200); end if;
  if p_to is not null and not exists (select 1 from public.town_members where town_id = t and user_id = p_to) then
    raise exception 'recipient not in town' using errcode = '42501';
  end if;
  if p_to = uid then raise exception 'cannot message self' using errcode = '22023'; end if;
  if p_project is not null and not exists (
    select 1 from public.projects where id = p_project and town_id = t and visibility = 'town'
      and (p_to is null or owner_id = p_to)) then
    raise exception 'project not visible' using errcode = '42501';
  end if;
  if (select count(*) from public.messages where sender_id = uid and created_at > now() - interval '1 minute') >= 5
     or (select count(*) from public.messages where sender_id = uid and created_at > now() - interval '1 day') >= 100 then
    raise exception 'rate limited' using errcode = '53400';
  end if;
  insert into public.messages (town_id, sender_id, recipient_id, project_id, body)
  values (t, uid, p_to, p_project, body) returning id into mid;
  return mid;
end $$;

create or replace function public.mark_read(p_from uuid) returns int
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); n int;
begin
  insert into public.message_reads (message_id, user_id)
  select m.id, uid from public.messages m
   where m.recipient_id = uid and m.sender_id = p_from and m.deleted_at is null
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- 게시판 글 삭제: 작성자 본인 또는 마을 주인
create or replace function public.delete_message(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); m public.messages;
begin
  select * into m from public.messages where id = p_id;
  if m.id is null then return; end if;
  if m.sender_id <> uid and not exists (select 1 from public.towns where id = m.town_id and owner_id = uid) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.messages set deleted_at = now() where id = p_id;
end $$;

-- AI 계획 초안 사용량(사용자 하루 20회). 서버 경로에서 호출
create or replace function public.consume_ai_quota(p_limit int default 20) returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user();
begin
  if (select count(*) from public.ai_usage where user_id = uid and created_at > now() - interval '1 day') >= p_limit then
    return false;
  end if;
  insert into public.ai_usage (user_id) values (uid);
  return true;
end $$;

create or replace function public.my_xp() returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)::int from public.reward_ledger where user_id = auth.uid()
$$;

-- 함수 실행 권한: 로그인 사용자만(초대 미리보기는 로그인 전에도)
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.save_profile(text), public.create_town(text, text), public.create_invite(), public.accept_invite(text, text),
  public.create_project(jsonb), public.add_quest(uuid, text, int, date), public.complete_quest(uuid, text),
  public.reopen_quest(uuid, text), public.start_work(uuid, uuid), public.complete_milestone(uuid, text, text),
  public.apply_schedule(uuid, int, text, int, jsonb, date), public.set_paused(uuid, boolean, date),
  public.refresh_my_conditions(date), public.send_message(uuid, text, uuid), public.mark_read(uuid),
  public.delete_message(uuid), public.consume_ai_quota(int), public.my_xp(),
  public.my_town_id(), public.is_town_member(uuid), public.owns_project(uuid), public.compute_stage(uuid)
  to authenticated;
grant execute on function public.invite_preview(text) to anon, authenticated;

-- 실시간: 쪽지·프로젝트 외관 변화(Supabase에만 있는 publication)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.projects;
  end if;
end $$;

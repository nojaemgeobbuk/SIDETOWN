-- SideTown v1.3 — 계획 화면·퀘스트 편집·친구 세부 일정·철거/명예의 전당·캐릭터 외형·여러 마을
-- 20261027000000_init.sql 위에 덧붙여 실행한다. 원칙은 그대로: 쓰기는 RPC로만, 읽기는 RLS.

-- ───────────────────────── 표 변경 ─────────────────────────

-- 여러 마을: 한 사람이 여러 마을(친구 그룹)에 속할 수 있다. 지금 보고 있는 마을은 프로필에 기억
alter table public.town_members drop constraint if exists town_members_user_id_key;
create index if not exists town_members_user_idx on public.town_members (user_id);

alter table public.profiles
  add column if not exists current_town_id uuid references public.towns (id) on delete set null,
  -- 캐릭터 외형 {hair, skin, top, bottom} — 각각 팔레트 키
  add column if not exists avatar jsonb not null default '{}'::jsonb,
  -- 계획 화면 하루 가용 시간(분)
  add column if not exists plan_prefs jsonb not null default '{"weekday": 90, "weekend": 180}'::jsonb;

-- 프로젝트: 철거 중(1시간) 상태, 명예의 전당, 복사 원본, 공개 범위 3단계
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check
  check (status in ('active', 'paused', 'completed', 'archived', 'demolishing'));
alter table public.projects drop constraint if exists projects_visibility_check;
alter table public.projects add constraint projects_visibility_check
  check (visibility in ('private', 'exterior', 'town'));
alter table public.projects
  add column if not exists demolish_ends_at timestamptz,
  add column if not exists status_before_demolish text,
  add column if not exists hall_at timestamptz,
  add column if not exists copied_from uuid references public.projects (id) on delete set null;

alter table public.quests add column if not exists note text check (char_length(note) <= 1000);

-- ───────────────────────── 도우미 ─────────────────────────

-- 지금 보고 있는 마을. 프로필에 저장된 마을에 아직 속해 있으면 그 마을, 아니면 가장 먼저 들어간 마을
create or replace function public.my_town_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.current_town_id from public.profiles p
       join public.town_members m on m.town_id = p.current_town_id and m.user_id = p.user_id
      where p.user_id = auth.uid()),
    (select town_id from public.town_members where user_id = auth.uid() order by joined_at limit 1))
$$;

-- 겉모습(이름·건물·단계·상태): 소유자, 또는 공개 범위가 exterior/town이고 같은 마을
create or replace function public.can_view_project(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects pr
     where pr.id = p and (pr.owner_id = auth.uid()
       or (pr.visibility in ('exterior', 'town') and pr.status <> 'archived' and public.is_town_member(pr.town_id))))
$$;

-- 세부 일정(중간 목표·퀘스트·성과 기록): 소유자, 또는 공개 범위가 town이고 같은 마을
create or replace function public.can_view_detail(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects pr
     where pr.id = p and (pr.owner_id = auth.uid()
       or (pr.visibility = 'town' and pr.status <> 'archived' and public.is_town_member(pr.town_id))))
$$;

-- 1시간이 지난 철거를 마무리한다: 기록은 남기고(archived) 부지는 비운다
create or replace function public.finalize_demolitions(t uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.projects set status = 'archived', plot_id = null, updated_at = now()
   where town_id = t and status = 'demolishing' and demolish_ends_at <= now();
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.bump_plan(p uuid) returns void
language sql security definer set search_path = public as $$
  update public.projects set plan_version = plan_version + 1, updated_at = now() where id = p;
$$;

create or replace function public.require_owner(p uuid) returns public.projects
language plpgsql security definer set search_path = public as $$
declare pr public.projects;
begin
  select * into pr from public.projects where id = p for update;
  if pr.id is null or pr.owner_id is distinct from auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return pr;
end $$;

-- ───────────────────────── RLS 교체 ─────────────────────────

drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select to authenticated using (public.can_view_project(id));
drop policy if exists milestones_read on public.milestones;
create policy milestones_read on public.milestones for select to authenticated using (public.can_view_detail(project_id));
drop policy if exists quests_read on public.quests;
create policy quests_read on public.quests for select to authenticated using (public.can_view_detail(project_id));

-- ───────────────────────── 여러 마을 ─────────────────────────

create or replace function public.create_town(p_name text, p_nickname text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); t uuid;
begin
  if coalesce(trim(p_nickname), '') <> '' then perform public.save_profile(p_nickname);
  elsif not exists (select 1 from public.profiles where user_id = uid) then
    raise exception 'nickname required' using errcode = '22023';
  end if;
  if (select count(*) from public.town_members where user_id = uid) >= 10 then
    raise exception 'too many towns' using errcode = '53400';
  end if;
  insert into public.towns (owner_id, name) values (uid, trim(p_name)) returning id into t;
  insert into public.town_members (town_id, user_id, role) values (t, uid, 'owner');
  update public.profiles set current_town_id = t where user_id = uid;
  return t;
end $$;

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
  if coalesce(trim(p_nickname), '') <> '' then perform public.save_profile(p_nickname);
  elsif not exists (select 1 from public.profiles where user_id = uid) then
    raise exception 'nickname required' using errcode = '22023';
  end if;
  if exists (select 1 from public.town_members where town_id = inv.town_id and user_id = uid) then
    update public.profiles set current_town_id = inv.town_id where user_id = uid;
    return inv.town_id;
  end if;
  if (select count(*) from public.town_members where user_id = uid) >= 10 then
    raise exception 'too many towns' using errcode = '53400';
  end if;
  select count(*) into n from public.town_members where town_id = inv.town_id;
  if n >= 8 then raise exception 'town full' using errcode = '53400'; end if;
  insert into public.town_members (town_id, user_id) values (inv.town_id, uid);
  update public.invites set uses = uses + 1 where id = inv.id;
  update public.profiles set current_town_id = inv.town_id where user_id = uid;
  return inv.town_id;
end $$;

create or replace function public.switch_town(p_town uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user();
begin
  if not public.is_town_member(p_town) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.profiles set current_town_id = p_town where user_id = uid;
end $$;

-- 내가 속한 마을 목록(마을 전환 메뉴용)
create or replace function public.my_towns() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id, 'name', t.name, 'owner_id', t.owner_id, 'role', m.role,
      'members', (select count(*) from public.town_members x where x.town_id = t.id),
      'my_projects', (select count(*) from public.projects p where p.town_id = t.id and p.owner_id = auth.uid() and p.status in ('active', 'paused', 'demolishing')),
      'current', t.id = public.my_town_id()
    ) order by m.joined_at), '[]'::jsonb)
  from public.town_members m join public.towns t on t.id = m.town_id
  where m.user_id = auth.uid()
$$;

-- ───────────────────────── 프로젝트 ─────────────────────────

create or replace function public.create_project(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); t uuid := public.my_town_id(); pid uuid; m jsonb; mid uuid; first_mid uuid; i int := 0;
begin
  if t is null then raise exception 'no town' using errcode = '42501'; end if;
  if jsonb_array_length(coalesce(p->'milestones', '[]'::jsonb)) not between 1 and 12 then
    raise exception 'milestones 1..12' using errcode = '22023';
  end if;
  perform public.finalize_demolitions(t);
  insert into public.projects (owner_id, town_id, plot_id, building, color, title, definition_of_done,
    start_date, target_date, baseline_target_date, visibility)
  values (uid, t, p->>'plot_id', p->>'building', coalesce(p->>'color', '#F4B03E'),
    trim(p->>'title'), coalesce(p->>'definition_of_done', ''),
    (p->>'start_date')::date, (p->>'target_date')::date, (p->>'target_date')::date,
    coalesce(p->>'visibility', 'town'))
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

-- 이름·완료 조건·색·공개 범위 (날짜는 apply_schedule/update_milestone)
create or replace function public.update_project(p_project uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare pr public.projects := public.require_owner(p_project);
begin
  update public.projects set
    title = case when p ? 'title' then trim(p->>'title') else title end,
    definition_of_done = case when p ? 'definition_of_done' then coalesce(p->>'definition_of_done', '') else definition_of_done end,
    color = case when p ? 'color' then p->>'color' else color end,
    visibility = case when p ? 'visibility' then p->>'visibility' else visibility end,
    updated_at = now()
   where id = pr.id;
end $$;

-- ───────────────────────── 중간 목표 편집 ─────────────────────────

create or replace function public.add_milestone(p_project uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare pr public.projects := public.require_owner(p_project); mid uuid; has_open boolean;
begin
  if pr.status not in ('active', 'paused') then raise exception 'project not editable' using errcode = '22023'; end if;
  if (select count(*) from public.milestones where project_id = pr.id) >= 12 then
    raise exception 'milestones 1..12' using errcode = '22023';
  end if;
  select exists (select 1 from public.milestones where project_id = pr.id and status in ('active', 'planned')) into has_open;
  insert into public.milestones (project_id, title, criteria, weight, position, status,
    start_date, target_date, baseline_start_date, baseline_target_date)
  values (pr.id, trim(p->>'title'), coalesce(p->>'criteria', ''), coalesce((p->>'weight')::int, 1),
    (select coalesce(max(position), -1) + 1 from public.milestones where project_id = pr.id),
    case when has_open then 'planned' else 'active' end,
    (p->>'start_date')::date, (p->>'target_date')::date, (p->>'start_date')::date, (p->>'target_date')::date)
  returning id into mid;
  -- 마지막 중간 목표가 프로젝트 목표일보다 늦으면 목표일도 따라간다(기준선은 그대로 → 지연으로 보인다)
  update public.projects set target_date = greatest(target_date, (p->>'target_date')::date) where id = pr.id;
  update public.projects set stage = public.compute_stage(pr.id) where id = pr.id;
  perform public.bump_plan(pr.id);
  return mid;
end $$;

create or replace function public.update_milestone(p_milestone uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare ms public.milestones; pr public.projects;
begin
  select * into ms from public.milestones where id = p_milestone;
  if ms.id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  pr := public.require_owner(ms.project_id);
  update public.milestones set
    title = case when p ? 'title' then trim(p->>'title') else title end,
    criteria = case when p ? 'criteria' then coalesce(p->>'criteria', '') else criteria end,
    weight = case when p ? 'weight' then (p->>'weight')::int else weight end,
    start_date = case when p ? 'start_date' and status <> 'completed' then (p->>'start_date')::date else start_date end,
    target_date = case when p ? 'target_date' and status <> 'completed' then (p->>'target_date')::date else target_date end,
    pinned = case when p ? 'pinned' then (p->>'pinned')::boolean else pinned end
   where id = ms.id;
  if exists (select 1 from public.milestones where id = ms.id and target_date < start_date) then
    raise exception 'invalid dates' using errcode = '22023';
  end if;
  update public.projects set target_date = greatest(target_date, (select max(target_date) from public.milestones where project_id = pr.id)) where id = pr.id;
  update public.projects set stage = public.compute_stage(pr.id) where id = pr.id;
  perform public.bump_plan(pr.id);
end $$;

-- 완료된 중간 목표, 완료한 퀘스트가 있는 중간 목표는 지울 수 없다(보상·성장 기록 보호)
create or replace function public.delete_milestone(p_milestone uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ms public.milestones; pr public.projects;
begin
  select * into ms from public.milestones where id = p_milestone;
  if ms.id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  pr := public.require_owner(ms.project_id);
  if ms.status = 'completed' or exists (select 1 from public.quests where milestone_id = ms.id and status = 'done') then
    raise exception 'milestone has completed work' using errcode = '22023';
  end if;
  if (select count(*) from public.milestones where project_id = pr.id) <= 1 then
    raise exception 'last milestone' using errcode = '22023';
  end if;
  delete from public.milestones where id = ms.id;
  if ms.status = 'active' then
    update public.milestones set status = 'active'
     where project_id = pr.id and status = 'planned'
       and position = (select min(position) from public.milestones where project_id = pr.id and status = 'planned');
  end if;
  update public.projects set stage = public.compute_stage(pr.id) where id = pr.id;
  perform public.bump_plan(pr.id);
end $$;

-- ───────────────────────── 퀘스트 편집 ─────────────────────────

drop function if exists public.add_quest(uuid, text, int, date);

-- p: {title, estimated_minutes, scheduled_start, due_date, note}
create or replace function public.add_quest(p_milestone uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); ms public.milestones; pr public.projects; qid uuid;
begin
  select * into ms from public.milestones where id = p_milestone;
  if ms.id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  pr := public.require_owner(ms.project_id);
  if ms.status = 'completed' then raise exception 'milestone already completed' using errcode = '22023'; end if;
  if (select count(*) from public.quests where project_id = pr.id) >= 300 then
    raise exception 'too many quests' using errcode = '53400';
  end if;
  insert into public.quests (project_id, milestone_id, assignee_id, title, estimated_minutes, position,
    scheduled_start, due_date, baseline_due_date, note)
  values (pr.id, ms.id, uid, trim(p->>'title'), coalesce((p->>'estimated_minutes')::int, 30),
    (select coalesce(max(position), -1) + 1 from public.quests where milestone_id = ms.id),
    (p->>'scheduled_start')::date, (p->>'due_date')::date, (p->>'due_date')::date, nullif(p->>'note', ''))
  returning id into qid;
  perform public.bump_plan(pr.id);
  return qid;
end $$;

-- p에 들어 있는 키만 바꾼다(값이 null이면 비운다). 완료는 complete_quest로만
create or replace function public.update_quest(p_quest uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare q public.quests; pr public.projects; target_ms public.milestones;
begin
  select * into q from public.quests where id = p_quest;
  if q.id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  pr := public.require_owner(q.project_id);
  if p ? 'milestone_id' then
    select * into target_ms from public.milestones where id = (p->>'milestone_id')::uuid and project_id = pr.id;
    if target_ms.id is null then raise exception 'forbidden' using errcode = '42501'; end if;
    if target_ms.status = 'completed' and q.status <> 'done' then raise exception 'milestone already completed' using errcode = '22023'; end if;
  end if;
  if p ? 'status' and p->>'status' not in ('todo', 'doing') then raise exception 'use complete_quest' using errcode = '22023'; end if;
  update public.quests set
    title = case when p ? 'title' then trim(p->>'title') else title end,
    estimated_minutes = case when p ? 'estimated_minutes' then (p->>'estimated_minutes')::int else estimated_minutes end,
    scheduled_start = case when p ? 'scheduled_start' then (p->>'scheduled_start')::date else scheduled_start end,
    due_date = case when p ? 'due_date' then (p->>'due_date')::date else due_date end,
    -- 기한을 처음 정하는 경우에만 기준선으로 삼는다(그 뒤 변경은 지연으로 보인다)
    baseline_due_date = case when p ? 'due_date' and baseline_due_date is null then (p->>'due_date')::date else baseline_due_date end,
    milestone_id = case when p ? 'milestone_id' then (p->>'milestone_id')::uuid else milestone_id end,
    pinned = case when p ? 'pinned' then (p->>'pinned')::boolean else pinned end,
    note = case when p ? 'note' then nullif(p->>'note', '') else note end,
    status = case when p ? 'status' and status <> 'done' then p->>'status' else status end
   where id = q.id;
  perform public.bump_plan(pr.id);
end $$;

-- 끝낸 퀘스트는 지울 수 없다(보상 기록 보호). 먼저 완료를 취소해야 한다
create or replace function public.delete_quest(p_quest uuid) returns void
language plpgsql security definer set search_path = public as $$
declare q public.quests; pr public.projects;
begin
  select * into q from public.quests where id = p_quest;
  if q.id is null then raise exception 'forbidden' using errcode = '42501'; end if;
  pr := public.require_owner(q.project_id);
  if q.status = 'done' then raise exception 'quest done' using errcode = '22023'; end if;
  delete from public.quests where id = q.id;
  perform public.bump_plan(pr.id);
end $$;

-- ───────────────────────── 철거·명예의 전당 ─────────────────────────

-- 프로젝트 중지: 1시간 동안 철거 공사가 보이고, 끝나면 부지가 비고 기록만 남는다. 그 사이엔 취소 가능
create or replace function public.start_demolition(p_project uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare pr public.projects := public.require_owner(p_project); ends timestamptz := now() + interval '1 hour';
begin
  if pr.status not in ('active', 'paused') then raise exception 'cannot demolish' using errcode = '22023'; end if;
  update public.projects set status = 'demolishing', status_before_demolish = pr.status,
    demolish_ends_at = ends, condition = 'normal', updated_at = now()
   where id = pr.id;
  insert into public.schedule_changes (project_id, actor_id, scope) values (pr.id, auth.uid(), 'pause');
  return ends;
end $$;

create or replace function public.cancel_demolition(p_project uuid) returns text
language plpgsql security definer set search_path = public as $$
declare pr public.projects := public.require_owner(p_project);
begin
  if pr.status <> 'demolishing' then return pr.status; end if;
  if pr.demolish_ends_at <= now() then raise exception 'demolition finished' using errcode = '22023'; end if;
  update public.projects set status = coalesce(status_before_demolish, 'active'), demolish_ends_at = null,
    status_before_demolish = null, updated_at = now()
   where id = pr.id;
  return coalesce(pr.status_before_demolish, 'active');
end $$;

-- 완공한 프로젝트를 명예의 전당으로 옮기고 부지를 비운다
create or replace function public.move_to_hall(p_project uuid) returns void
language plpgsql security definer set search_path = public as $$
declare pr public.projects := public.require_owner(p_project);
begin
  if pr.status <> 'completed' then raise exception 'not completed' using errcode = '22023'; end if;
  update public.projects set hall_at = coalesce(hall_at, now()), plot_id = null, updated_at = now() where id = pr.id;
end $$;

-- ───────────────────────── 마을 간 복사 ─────────────────────────

-- 진행 상황(중간 목표·퀘스트 상태)까지 그대로 복사한다. 보상 사건은 복사하지 않는다(XP 중복 없음)
create or replace function public.copy_project(p_project uuid, p_town uuid, p_plot text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); src public.projects; np uuid; m public.milestones; nm uuid;
begin
  select * into src from public.projects where id = p_project;
  if src.id is null or src.owner_id <> uid then raise exception 'forbidden' using errcode = '42501'; end if;
  if src.status in ('archived', 'demolishing') then raise exception 'cannot copy' using errcode = '22023'; end if;
  if not public.is_town_member(p_town) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform public.finalize_demolitions(p_town);
  insert into public.projects (owner_id, town_id, plot_id, building, color, title, definition_of_done,
    start_date, target_date, baseline_target_date, status, condition, stage, visibility, copied_from, hall_at)
  values (uid, p_town, case when src.hall_at is not null then null else p_plot end, src.building, src.color, src.title,
    src.definition_of_done, src.start_date, src.target_date, src.baseline_target_date, src.status, src.condition,
    src.stage, src.visibility, src.id, src.hall_at)
  returning id into np;
  for m in select * from public.milestones where project_id = src.id order by position loop
    insert into public.milestones (project_id, title, criteria, weight, position, status, start_date, target_date,
      baseline_start_date, baseline_target_date, pinned, evidence, completed_at)
    values (np, m.title, m.criteria, m.weight, m.position, m.status, m.start_date, m.target_date,
      m.baseline_start_date, m.baseline_target_date, m.pinned, m.evidence, m.completed_at)
    returning id into nm;
    insert into public.quests (project_id, milestone_id, assignee_id, title, estimated_minutes, actual_minutes, status,
      position, scheduled_start, due_date, baseline_due_date, pinned, completed_at, note)
    select np, nm, uid, q.title, q.estimated_minutes, q.actual_minutes, q.status, q.position, q.scheduled_start,
      q.due_date, q.baseline_due_date, q.pinned, q.completed_at, q.note
      from public.quests q where q.milestone_id = m.id;
  end loop;
  return np;
end $$;

-- 복사본 퀘스트의 완료 취소: 그 퀘스트에 지급 사건이 없으면(복사로 생긴 완료) 다시 완료해도 XP를 주지 않는다
create or replace function public.complete_quest(p_quest uuid, p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); q public.quests; pr public.projects; ev uuid; restored boolean := false; xp int := 10;
begin
  select id into ev from public.completion_events where actor_id = uid and idempotency_key = p_key;
  if ev is not null then return jsonb_build_object('event', ev, 'replayed', true); end if;
  select * into q from public.quests where id = p_quest for update;
  if q.id is null or not public.owns_project(q.project_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if q.status = 'done' then return jsonb_build_object('already_done', true); end if;
  select * into pr from public.projects where id = q.project_id for update;
  if pr.status in ('demolishing', 'archived') then raise exception 'project not editable' using errcode = '22023'; end if;
  update public.quests set status = 'done', completed_at = now() where id = q.id;
  insert into public.completion_events (entity_type, entity_id, actor_id, action, idempotency_key)
  values ('quest', q.id, uid, 'complete', p_key) returning id into ev;
  if q.completed_at is not null and not exists (
    select 1 from public.completion_events where entity_type = 'quest' and entity_id = q.id and action = 'complete' and id <> ev) then
    xp := 0; -- 복사본에서 이미 끝났던 퀘스트
  end if;
  if xp > 0 then insert into public.reward_ledger (event_id, user_id, amount) values (ev, uid, xp); end if;
  if pr.condition <> 'normal' then
    update public.projects set condition = 'normal', updated_at = now() where id = pr.id;
    perform public.rebaseline(pr.id);
    insert into public.schedule_changes (project_id, actor_id, scope) values (pr.id, uid, 'rebaseline');
    restored := true;
  end if;
  return jsonb_build_object('event', ev, 'xp', xp, 'restored', restored);
end $$;

-- 완료 취소 시 completed_at은 남겨 둔다(위 판정에 쓰임)
create or replace function public.reopen_quest(p_quest uuid, p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); q public.quests; last_ev uuid; ev uuid; back int := 0;
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
  update public.quests set status = 'todo' where id = q.id;
  insert into public.completion_events (entity_type, entity_id, actor_id, action, idempotency_key, reversal_of)
  values ('quest', q.id, uid, 'reopen', p_key, last_ev) returning id into ev;
  if last_ev is not null then
    insert into public.reward_ledger (event_id, user_id, amount)
    select ev, uid, -amount from public.reward_ledger where event_id = last_ev and user_id = uid;
    select coalesce(sum(amount), 0) into back from public.reward_ledger where event_id = ev;
  end if;
  return jsonb_build_object('event', ev, 'xp', back);
end $$;

-- ───────────────────────── 프로필 ─────────────────────────

create or replace function public.save_avatar(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); k text; clean jsonb := '{}'::jsonb;
begin
  -- 정해진 키·짧은 값만 저장한다(임의 데이터 저장 방지)
  foreach k in array array['hair', 'skin', 'top', 'bottom', 'style'] loop
    if p ? k and char_length(p->>k) between 1 and 16 and (p->>k) ~ '^[a-z0-9-]+$' then
      clean := clean || jsonb_build_object(k, p->>k);
    end if;
  end loop;
  update public.profiles set avatar = clean where user_id = uid;
end $$;

create or replace function public.save_plan_prefs(p_weekday int, p_weekend int) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user();
begin
  if p_weekday not between 0 and 960 or p_weekend not between 0 and 960 then raise exception 'invalid' using errcode = '22023'; end if;
  update public.profiles set plan_prefs = jsonb_build_object('weekday', p_weekday, 'weekend', p_weekend) where user_id = uid;
end $$;

-- 접속 시: 끝난 철거 마무리 + 낡음 판정
create or replace function public.refresh_my_conditions(p_today date) returns int
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); n int; t uuid;
begin
  for t in select town_id from public.town_members where user_id = uid loop
    perform public.finalize_demolitions(t);
  end loop;
  update public.projects p set condition = 'decayed', updated_at = now()
   where p.owner_id = uid and p.status = 'active' and p.condition = 'normal' and public.delay_days(p, p_today) >= 30;
  get diagnostics n = row_count;
  return n;
end $$;

-- ───────────────────────── 실행 권한 ─────────────────────────

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.save_profile(text), public.create_town(text, text), public.create_invite(), public.accept_invite(text, text),
  public.switch_town(uuid), public.my_towns(),
  public.create_project(jsonb), public.update_project(uuid, jsonb),
  public.add_milestone(uuid, jsonb), public.update_milestone(uuid, jsonb), public.delete_milestone(uuid),
  public.add_quest(uuid, jsonb), public.update_quest(uuid, jsonb), public.delete_quest(uuid),
  public.complete_quest(uuid, text), public.reopen_quest(uuid, text), public.start_work(uuid, uuid),
  public.complete_milestone(uuid, text, text),
  public.apply_schedule(uuid, int, text, int, jsonb, date), public.set_paused(uuid, boolean, date),
  public.start_demolition(uuid), public.cancel_demolition(uuid), public.move_to_hall(uuid),
  public.copy_project(uuid, uuid, text),
  public.save_avatar(jsonb), public.save_plan_prefs(int, int),
  public.refresh_my_conditions(date), public.send_message(uuid, text, uuid), public.mark_read(uuid),
  public.delete_message(uuid), public.consume_ai_quota(int), public.my_xp(),
  public.my_town_id(), public.is_town_member(uuid), public.owns_project(uuid), public.compute_stage(uuid),
  public.can_view_project(uuid), public.can_view_detail(uuid)
  to authenticated;
grant execute on function public.invite_preview(text) to anon, authenticated;

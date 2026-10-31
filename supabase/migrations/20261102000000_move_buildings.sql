-- SideTown v1.7: 건물 옮기기. 프로젝트 건물과 공용 건물(카페·내 집·명예의 전당)을 빈 부지로 옮길 수 있다.
-- 부지는 12칸: 프로젝트 부지 9칸 + 공용 건물의 처음 자리 3칸(lot-cafe·lot-home·lot-hall).
-- 공용 건물 위치는 마을마다 towns.layout에 저장한다. 여러 번 실행해도 안전하다.

alter table public.towns add column if not exists layout jsonb not null
  default '{"cafe":"lot-cafe","home":"lot-home","hall":"lot-hall"}'::jsonb;

-- 부지 이름 12칸
create or replace function public.valid_plot(plot text) returns boolean
language sql immutable as $$
  select plot is null or plot in ('plot-a', 'plot-b', 'plot-c', 'plot-d', 'plot-e', 'plot-e1a', 'plot-e1b', 'plot-s1a', 'plot-s1b',
    'lot-cafe', 'lot-home', 'lot-hall')
$$;

-- 그 마을 공용 건물이 서 있는 부지인가
create or replace function public.place_on_plot(t uuid, plot text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.towns tw, jsonb_each_text(tw.layout) e where tw.id = t and e.value = plot)
$$;

-- 프로젝트를 세우거나 옮길 때: 지도에 있는 부지 + 공용 건물이 없는 자리만
create or replace function public.check_plot_name() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.valid_plot(new.plot_id) then
    raise exception 'bad plot' using errcode = '22023';
  end if;
  if new.plot_id is not null and new.town_id is not null and public.place_on_plot(new.town_id, new.plot_id) then
    raise exception 'plot taken' using errcode = '23505';
  end if;
  return new;
end $$;

drop trigger if exists projects_check_plot_name on public.projects;
create trigger projects_check_plot_name before insert or update of plot_id, town_id on public.projects
  for each row execute function public.check_plot_name();

-- 내 프로젝트 건물 옮기기
create or replace function public.move_project(p_project uuid, p_plot text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); pr public.projects;
begin
  select * into pr from public.projects where id = p_project for update;
  if pr.id is null or pr.owner_id <> uid or not public.is_town_member(pr.town_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if pr.status not in ('active', 'paused') or pr.hall_at is not null or pr.plot_id is null then
    raise exception 'cannot move' using errcode = '22023';
  end if;
  if p_plot is null or not public.valid_plot(p_plot) then raise exception 'bad plot' using errcode = '22023'; end if;
  if pr.plot_id = p_plot then return; end if;
  -- 같은 마을에서 동시에 옮겨도 겹치지 않게 마을 행을 잠근다
  perform 1 from public.towns where id = pr.town_id for update;
  perform public.finalize_demolitions(pr.town_id);
  if exists (select 1 from public.projects where town_id = pr.town_id and plot_id = p_plot and id <> pr.id) then
    raise exception 'plot taken' using errcode = '23505';
  end if;
  update public.projects set plot_id = p_plot, updated_at = now() where id = pr.id;
end $$;

-- 공용 건물 옮기기(마을 주민 누구나)
create or replace function public.move_place(p_town uuid, p_place text, p_plot text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_user(); lay jsonb;
begin
  if not public.is_town_member(p_town) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_place not in ('cafe', 'home', 'hall') then raise exception 'cannot move' using errcode = '22023'; end if;
  if p_plot is null or not public.valid_plot(p_plot) then raise exception 'bad plot' using errcode = '22023'; end if;
  select layout into lay from public.towns where id = p_town for update;
  if lay ->> p_place = p_plot then return; end if;
  perform public.finalize_demolitions(p_town);
  if exists (select 1 from public.projects where town_id = p_town and plot_id = p_plot)
     or exists (select 1 from jsonb_each_text(lay) e where e.key <> p_place and e.value = p_plot) then
    raise exception 'plot taken' using errcode = '23505';
  end if;
  update public.towns set layout = jsonb_set(lay, array[p_place], to_jsonb(p_plot)) where id = p_town;
end $$;

revoke execute on function public.place_on_plot(uuid, text), public.check_plot_name() from public, anon, authenticated;
revoke execute on function public.move_project(uuid, text), public.move_place(uuid, text, text) from public, anon;
grant execute on function public.move_project(uuid, text), public.move_place(uuid, text, text) to authenticated;

-- 친구가 옮긴 결과를 바로 보도록
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'towns') then
    alter publication supabase_realtime add table public.towns;
  end if;
end $$;

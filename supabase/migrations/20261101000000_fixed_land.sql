-- SideTown v1.6: 땅 넓히기(보상형 광고)를 없애고, 모든 마을이 처음부터 부지 9칸을 가진다.
-- 예전 v1.5 마이그레이션(20261031000000_land_expansion.sql)을 이미 실행했어도, 실행하지 않았어도
-- 이 파일 하나만 실행하면 된다(있으면 지우고, 없으면 넘어간다). 여러 번 실행해도 안전하다.

-- 1) v1.5 땅 넓히기 정리
do $$ begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'town_expansions') then
    alter publication supabase_realtime drop table public.town_expansions;
  end if;
end $$;
drop trigger if exists projects_check_plot on public.projects;
drop function if exists public.start_expansion_ad(uuid);
drop function if exists public.claim_expansion(uuid);
drop function if exists public.next_expansion(uuid);
drop function if exists public.check_plot();
drop function if exists public.plot_allowed(uuid, text);
drop table if exists public.ad_sessions;
drop table if exists public.town_expansions;

-- 2) 부지 이름은 마을 지도에 있는 9칸만 허용(앱 밖에서 엉뚱한 자리에 짓지 못하게)
create or replace function public.valid_plot(plot text) returns boolean
language sql immutable as $$
  select plot is null or plot in ('plot-a', 'plot-b', 'plot-c', 'plot-d', 'plot-e', 'plot-e1a', 'plot-e1b', 'plot-s1a', 'plot-s1b')
$$;

create or replace function public.check_plot_name() returns trigger
language plpgsql as $$
begin
  if not public.valid_plot(new.plot_id) then
    raise exception 'bad plot' using errcode = '22023';
  end if;
  return new;
end $$;

drop trigger if exists projects_check_plot_name on public.projects;
create trigger projects_check_plot_name before insert or update of plot_id on public.projects
  for each row execute function public.check_plot_name();

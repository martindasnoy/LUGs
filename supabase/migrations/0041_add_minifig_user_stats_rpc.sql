create or replace function public.get_minifig_user_stats_current(p_user_id uuid default auth.uid())
returns table (
  complete_count integer,
  missing_count integer,
  total_count integer,
  favorites_count integer
)
language sql
security definer
set search_path = public
as $$
with inventory as (
  select set_num, is_owned, is_favorite
  from public.minifig_user_inventory
  where user_id = p_user_id
),
owned_sets as (
  select distinct set_num
  from inventory
  where is_owned is true
),
tracked_sets as (
  select distinct set_num
  from public.minifig_user_part_inventory
  where user_id = p_user_id
),
candidate_sets as (
  select set_num from inventory
  union
  select set_num from tracked_sets
),
required_parts as (
  select
    p.set_num,
    p.part_num,
    p.color_name,
    sum(p.quantity)::integer as required_qty
  from public.minifigure_set_parts_catalog p
  inner join candidate_sets c on c.set_num = p.set_num
  group by p.set_num, p.part_num, p.color_name
),
owned_parts as (
  select
    i.set_num,
    i.part_num,
    i.color_name,
    sum(i.owned_quantity)::integer as owned_qty
  from public.minifig_user_part_inventory i
  inner join candidate_sets c on c.set_num = i.set_num
  where i.user_id = p_user_id
  group by i.set_num, i.part_num, i.color_name
),
missing_by_set as (
  select
    r.set_num,
    bool_or(
      greatest(
        0,
        r.required_qty - coalesce(op.owned_qty, case when ts.set_num is not null then 0 else r.required_qty end)
      ) > 0
    ) as has_missing
  from required_parts r
  left join owned_parts op
    on op.set_num = r.set_num
   and op.part_num = r.part_num
   and op.color_name = r.color_name
  left join tracked_sets ts
    on ts.set_num = r.set_num
  group by r.set_num
),
stats as (
  select
    (select count(*)::integer from owned_sets) as total_count,
    (select count(*)::integer from inventory where is_favorite is true) as favorites_count,
    (select count(*)::integer from missing_by_set where has_missing is true) as missing_count,
    (
      select count(*)::integer
      from missing_by_set m
      inner join owned_sets o on o.set_num = m.set_num
      where m.has_missing is true
    ) as missing_owned_count
)
select
  greatest(0, stats.total_count - stats.missing_owned_count) as complete_count,
  stats.missing_count,
  stats.total_count,
  stats.favorites_count
from stats;
$$;

revoke all on function public.get_minifig_user_stats_current(uuid) from public;
grant execute on function public.get_minifig_user_stats_current(uuid) to authenticated;
grant execute on function public.get_minifig_user_stats_current(uuid) to service_role;

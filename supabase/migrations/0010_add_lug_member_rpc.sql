create or replace function public.get_lug_member_counts_current()
returns table (lug_id uuid, members_count bigint)
language sql
security definer
set search_path = public
as $$
  select p.current_lug_id as lug_id, count(*)::bigint as members_count
  from public.profiles p
  where p.current_lug_id is not null
  group by p.current_lug_id;
$$;

revoke all on function public.get_lug_member_counts_current() from public;
grant execute on function public.get_lug_member_counts_current() to authenticated;

create or replace function public.get_lug_members_current(target_lug_id uuid)
returns table (
  id uuid,
  full_name text,
  social_platform text,
  social_handle text
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.username), ''), 'Usuario') as full_name,
    p.social_platform,
    p.social_handle
  from public.profiles p
  where p.current_lug_id = target_lug_id
  order by coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.username), ''), 'Usuario');
$$;

revoke all on function public.get_lug_members_current(uuid) from public;
grant execute on function public.get_lug_members_current(uuid) to authenticated;

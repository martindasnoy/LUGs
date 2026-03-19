create or replace function public.get_profile_names_by_ids(p_ids text[])
returns table (
  id text,
  display_name text
)
language sql
security definer
set search_path = public
as $$
  select
    p.id::text as id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.username), ''), 'Usuario') as display_name
  from public.profiles p
  where p.id::text = any(coalesce(p_ids, array[]::text[]));
$$;

revoke all on function public.get_profile_names_by_ids(text[]) from public;
grant execute on function public.get_profile_names_by_ids(text[]) to authenticated;

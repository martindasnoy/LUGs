create or replace function public.get_profile_avatars_by_ids(p_ids text[])
returns table (
  id text,
  avatar_key text
)
language sql
security definer
set search_path = public
as $$
  select
    p.id::text as id,
    p.avatar_key
  from public.profiles p
  where p.id::text = any(coalesce(p_ids, array[]::text[]))
    and nullif(trim(coalesce(p.avatar_key, '')), '') is not null;
$$;

revoke all on function public.get_profile_avatars_by_ids(text[]) from public;
grant execute on function public.get_profile_avatars_by_ids(text[]) to authenticated;

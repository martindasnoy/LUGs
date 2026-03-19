drop function if exists public.get_lug_members_current(uuid);

create or replace function public.get_lug_members_current(target_lug_id uuid)
returns table (
  id uuid,
  full_name text,
  avatar_key text,
  social_platform text,
  social_handle text,
  rol_lug text
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.username), ''), 'Usuario') as full_name,
    p.avatar_key,
    p.social_platform,
    p.social_handle,
    p.rol_lug
  from public.profiles p
  where p.current_lug_id = target_lug_id
  order by coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.username), ''), 'Usuario');
$$;

revoke all on function public.get_lug_members_current(uuid) from public;
grant execute on function public.get_lug_members_current(uuid) to authenticated;

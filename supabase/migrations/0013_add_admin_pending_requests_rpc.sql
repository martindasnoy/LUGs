create or replace function public.get_lug_pending_requests(target_lug_id uuid)
returns table (
  request_id uuid,
  requester_id uuid,
  full_name text,
  social_platform text,
  social_handle text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    r.request_id,
    r.requester_id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.username), ''), 'Usuario') as full_name,
    p.social_platform,
    p.social_handle,
    r.created_at
  from public.lug_join_requests r
  join public.profiles p on p.id = r.requester_id
  where r.lug_id = target_lug_id
    and r.status = 'pending'
    and exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.rol_lug = 'admin'
        and admin_profile.current_lug_id = target_lug_id
    )
  order by r.created_at desc;
$$;

revoke all on function public.get_lug_pending_requests(uuid) from public;
grant execute on function public.get_lug_pending_requests(uuid) to authenticated;

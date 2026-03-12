drop function if exists public.get_lug_pending_requests(uuid);

create or replace function public.get_lug_pending_requests(target_lug_id uuid)
returns table (
  request_id uuid,
  requester_id uuid,
  lug_id uuid,
  full_name text,
  social_platform text,
  social_handle text,
  request_message text,
  contact_social text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    r.request_id,
    r.requester_id,
    r.lug_id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.username), ''), 'Usuario') as full_name,
    p.social_platform,
    p.social_handle,
    r.request_message,
    r.contact_social,
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

create or replace function public.resolve_lug_join_request(target_request_id uuid, decision_value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
begin
  if decision_value not in ('accepted', 'rejected') then
    raise exception 'Decision invalida';
  end if;

  select r.request_id, r.requester_id, r.lug_id, r.status
  into req
  from public.lug_join_requests r
  where r.request_id = target_request_id
  for update;

  if not found then
    raise exception 'Solicitud no encontrada';
  end if;

  if req.status <> 'pending' then
    return;
  end if;

  if not exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid()
      and admin_profile.rol_lug = 'admin'
      and admin_profile.current_lug_id = req.lug_id
  ) then
    raise exception 'No autorizado para resolver esta solicitud';
  end if;

  update public.lug_join_requests
  set status = decision_value
  where request_id = req.request_id;

  if decision_value = 'accepted' then
    update public.profiles
    set current_lug_id = req.lug_id,
        rol_lug = 'common'
    where id = req.requester_id;
  end if;
end;
$$;

revoke all on function public.resolve_lug_join_request(uuid, text) from public;
grant execute on function public.resolve_lug_join_request(uuid, text) to authenticated;

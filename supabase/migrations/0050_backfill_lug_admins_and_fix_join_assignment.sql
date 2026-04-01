-- Ensure each non-empty LUG has at least one admin.
with lugs_without_admin as (
  select p.current_lug_id as lug_id
  from public.profiles p
  where p.current_lug_id is not null
  group by p.current_lug_id
  having count(*) filter (where p.rol_lug = 'admin') = 0
), ranked_members as (
  select
    p.id,
    p.current_lug_id as lug_id,
    row_number() over (
      partition by p.current_lug_id
      order by coalesce(p.lug_joined_at, p.created_at), p.created_at, p.id
    ) as rn
  from public.profiles p
  inner join lugs_without_admin lwa on lwa.lug_id = p.current_lug_id
)
update public.profiles p
set rol_lug = 'admin'
from ranked_members rm
where rm.rn = 1
  and p.id = rm.id;

-- Keep current members with null role as common.
update public.profiles
set rol_lug = 'common'
where current_lug_id is not null
  and rol_lug is null;

-- When accepting a pending request, assign admin if the LUG currently has none.
create or replace function public.resolve_lug_join_request(target_request_id uuid, decision_value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
  lug_has_admin boolean;
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
    select exists (
      select 1
      from public.profiles p
      where p.current_lug_id = req.lug_id
        and p.rol_lug = 'admin'
    ) into lug_has_admin;

    update public.profiles
    set current_lug_id = req.lug_id,
        rol_lug = case when lug_has_admin then 'common' else 'admin' end
    where id = req.requester_id;
  end if;
end;
$$;
